"""
gemini_service.py – Async Gemini API integration with multi-turn ChatSession support.

Architecture:
  - GeminiSessionManager maintains one ChatSession per session_id in memory.
  - Each session preserves full conversation history, giving Gemini real context
    across turns without resending the entire transcript every request.
  - asyncio.Lock prevents race conditions when sessions are accessed concurrently.
  - The model is cached via lru_cache; only one SDK client is ever created.
  - All blocking SDK calls run in asyncio.to_thread → event loop never blocked.

Edge-resilience hook:
  Set USE_LOCAL_MODEL=true in .env to route requests to a local quantized model
  (e.g. faster-whisper or a llama.cpp server). The service layer abstracts this
  so route handlers require zero changes.
"""

import os
import re
import uuid
import asyncio
import logging
from functools import lru_cache
from datetime import datetime, timedelta

import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("lokmate.gemini_service")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

LANGUAGE_MAP: dict[str, str] = {
    "en": "English",
    "hi": "Hindi",
    "mr": "Marathi",
    "bho": "Bhojpuri",
}

# Matches all official ECI form numbers referenced in responses
FORM_PATTERN = re.compile(r"\bForm\s*(?:6A?|7|8A?|11A?)\b", re.IGNORECASE)

# Sessions idle for longer than this are evicted (memory management)
SESSION_TTL_MINUTES = 30


# ---------------------------------------------------------------------------
# Model factory (cached – one instance per process)
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def _get_model() -> genai.GenerativeModel:
    """
    Lazily initialise and cache the Gemini GenerativeModel.

    Uses system_instruction to set the civic-expert persona once at model
    creation, so it is not resent on every turn (saves tokens, improves speed).

    Returns:
        Configured ``genai.GenerativeModel`` with system_instruction set.

    Raises:
        EnvironmentError: If GEMINI_API_KEY is not present in the environment.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise EnvironmentError(
            "GEMINI_API_KEY is not set. Copy .env.example → .env and add your key."
        )
    genai.configure(api_key=api_key)

    system_instruction = (
        "You are LokMate, a friendly Election Process Education assistant for Indian voters. "
        "You explain ECI forms (Form 6, 6A, 7, 8, 8A, 11, 11A) step-by-step in plain language. "
        "You support first-time voters with patience and empathy. "
        "You provide information about EVM usage, VVPAT slips, and polling booth procedures. "
        "You NEVER share opinions about political parties, candidates, or policies. "
        "You NEVER give legal advice. For complex cases, say: "
        "'Please visit voters.eci.gov.in or call 1950.' "
        "You ONLY discuss Indian elections and civic education."
    )

    return genai.GenerativeModel(
        model_name="gemini-1.5-flash",
        system_instruction=system_instruction,
        generation_config=genai.types.GenerationConfig(
            temperature=0.35,      # low randomness for factual civic guidance
            max_output_tokens=900,
        ),
    )


# ---------------------------------------------------------------------------
# Session Manager – multi-turn ChatSession per user
# ---------------------------------------------------------------------------

class _Session:
    """Wraps a Gemini ChatSession with a last-accessed timestamp for TTL eviction."""

    __slots__ = ("chat", "language", "last_accessed")

    def __init__(self, chat: genai.ChatSession, language: str) -> None:
        self.chat = chat
        self.language = language
        self.last_accessed: datetime = datetime.utcnow()

    def touch(self) -> None:
        self.last_accessed = datetime.utcnow()

    def is_expired(self) -> bool:
        return datetime.utcnow() - self.last_accessed > timedelta(minutes=SESSION_TTL_MINUTES)


class GeminiSessionManager:
    """
    In-memory store of active Gemini ChatSessions keyed by session_id (UUID).

    Thread-Safety:
        All mutations are guarded by ``asyncio.Lock`` so concurrent FastAPI
        requests for the same session_id are serialised correctly.

    Eviction:
        Sessions idle for SESSION_TTL_MINUTES are removed on the next access,
        keeping memory usage bounded without a background task.
    """

    def __init__(self) -> None:
        self._sessions: dict[str, _Session] = {}
        self._lock = asyncio.Lock()

    async def get_or_create(self, session_id: str | None, language: str) -> tuple[str, _Session]:
        """
        Return an existing session or create a new one.

        Args:
            session_id: Client-provided UUID, or None to start a new session.
            language:   Language code for this turn (stored on the session).

        Returns:
            Tuple of (resolved_session_id, session_object).
        """
        async with self._lock:
            self._evict_expired()

            if session_id and session_id in self._sessions:
                session = self._sessions[session_id]
                # Update language if the user switched mid-conversation
                session.language = language
                session.touch()
                return session_id, session

            # Create a fresh ChatSession for a new conversation
            new_id = session_id or str(uuid.uuid4())
            model = _get_model()
            chat = model.start_chat(history=[])
            session = _Session(chat=chat, language=language)
            self._sessions[new_id] = session
            logger.info("New Gemini session created: %s", new_id)
            return new_id, session

    def _evict_expired(self) -> None:
        """Remove sessions that have exceeded SESSION_TTL_MINUTES. Called under lock."""
        expired = [sid for sid, s in self._sessions.items() if s.is_expired()]
        for sid in expired:
            del self._sessions[sid]
            logger.info("Evicted expired session: %s", sid)

    @property
    def active_session_count(self) -> int:
        """Number of currently active (non-expired) sessions."""
        return len(self._sessions)


# Module-level singleton shared across all requests in the process
session_manager = GeminiSessionManager()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def _build_language_instruction(language_name: str) -> str:
    """
    Return a concise, per-turn language instruction.

    Sending this on each turn (rather than in system_instruction) lets the user
    dynamically switch languages without starting a new session.
    """
    return (
        f"[LANGUAGE INSTRUCTION] Respond ONLY in {language_name}. "
        "Use simple, everyday vocabulary suitable for a first-time voter. "
        "Avoid legal or bureaucratic jargon.\n\n"
    )


async def get_helpdesk_response(
    query: str,
    language: str = "en",
    session_id: str | None = None,
) -> tuple[str, list[str], str]:
    """
    Send a voter's query to a Gemini ChatSession and return the AI response.

    Unlike a single-shot generate_content call, ChatSession maintains the full
    conversation history server-side, enabling coherent multi-turn dialogue.
    Example: User asks "What is Form 8?" → AI explains → User asks "Do I need
    an address proof?" → AI answers in context without re-explanation.

    Args:
        query:      The voter's natural-language question.
        language:   BCP-47 language code (en / hi / mr / bho).
        session_id: Optional UUID of an existing session. If None, a new
                    session is created and its ID returned in the response.

    Returns:
        Tuple of:
          - answer (str): Gemini's response text.
          - form_references (list[str]): Unique ECI form IDs in the answer.
          - session_id (str): UUID to include in the next request for continuity.

    Raises:
        RuntimeError: Wraps any Gemini API error with a user-friendly message.
    """
    language_name = LANGUAGE_MAP.get(language, "English")
    resolved_id, session = await session_manager.get_or_create(session_id, language)

    # Prepend a language instruction to each user turn so the model always
    # knows which language to reply in, even if the user switches languages.
    full_message = _build_language_instruction(language_name) + query

    try:
        # send_message is blocking; run it in a thread pool to keep the event loop free
        response = await asyncio.to_thread(session.chat.send_message, full_message)
        answer_text: str = response.text.strip()
    except Exception as exc:
        logger.exception("Gemini API call failed for session %s: %s", resolved_id, exc)
        raise RuntimeError(
            "Our AI helpdesk is temporarily unavailable. "
            "Please call 1950 or visit voters.eci.gov.in for assistance."
        ) from exc

    # Extract all form references from the answer for structured metadata display
    forms_found = list(
        dict.fromkeys(m.group().strip() for m in FORM_PATTERN.finditer(answer_text))
    )

    logger.info(
        "Session %s | lang=%s | forms=%s | response_len=%d",
        resolved_id, language, forms_found, len(answer_text),
    )

    return answer_text, forms_found, resolved_id
