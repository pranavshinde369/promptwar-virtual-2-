"""
models.py – Pydantic data models for LokMate API request/response validation.

All API route handlers must accept and return these typed models to:
  - Prevent injection (strict max_length, enum, strip validators).
  - Power auto-generated interactive OpenAPI docs at /api/docs.
  - Guarantee API contract safety across frontend ↔ backend.
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal


# ---------------------------------------------------------------------------
# Shared types
# ---------------------------------------------------------------------------

SUPPORTED_LANGUAGES = Literal["en", "hi", "mr", "bho"]  # English, Hindi, Marathi, Bhojpuri


# ---------------------------------------------------------------------------
# Helpdesk (Gemini ChatSession) Models
# ---------------------------------------------------------------------------

class HelpdeskRequest(BaseModel):
    """
    Request body for POST /helpdesk/chat.

    Attributes:
        query:      The voter's plain-language question (1–1000 chars).
        language:   BCP-47 style language code. Supports en, hi, mr, bho.
        session_id: Optional UUID from a prior response. When supplied, the
                    request continues an existing Gemini ChatSession so the AI
                    has full conversation history. Omit to start fresh.
    """

    query: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="Voter's question or message.",
        examples=["मुझे Form 8 कैसे भरना है?", "How do I register to vote for the first time?"],
    )
    language: SUPPORTED_LANGUAGES = Field(
        default="en",
        description="Language code for the AI response (en | hi | mr | bho).",
    )
    session_id: Optional[str] = Field(
        default=None,
        max_length=36,          # UUID v4 is exactly 36 chars
        description="Existing session UUID for multi-turn conversation continuity.",
        examples=["550e8400-e29b-41d4-a716-446655440000"],
    )

    @field_validator("query")
    @classmethod
    def strip_and_validate_query(cls, v: str) -> str:
        """Strip surrounding whitespace; reject queries that are only whitespace."""
        stripped = v.strip()
        if not stripped:
            raise ValueError("query must not be empty or whitespace only.")
        return stripped

    @field_validator("session_id")
    @classmethod
    def validate_session_id_format(cls, v: str | None) -> str | None:
        """Accept only UUID v4 format or None to prevent enumeration attacks."""
        if v is None:
            return v
        import re
        uuid_re = re.compile(
            r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
            re.IGNORECASE,
        )
        if not uuid_re.match(v):
            raise ValueError("session_id must be a valid UUID v4.")
        return v


class HelpdeskResponse(BaseModel):
    """
    Response body for POST /helpdesk/chat.

    Attributes:
        answer:          Gemini-generated response in the requested language.
        language:        Echoes the language used for the response.
        form_references: ECI form IDs extracted from the answer (e.g. ['Form 6', 'Form 8']).
        session_id:      UUID of the active ChatSession. Pass this back on the
                         next request to maintain conversation continuity.
    """

    answer: str
    language: SUPPORTED_LANGUAGES
    form_references: list[str] = Field(
        default_factory=list,
        description="ECI forms mentioned in the AI response.",
    )
    session_id: str = Field(
        description="Pass this value in subsequent requests to continue this conversation."
    )


# ---------------------------------------------------------------------------
# Form Data Models (static knowledge base / offline-capable)
# ---------------------------------------------------------------------------

class FormStep(BaseModel):
    """A single step in a form-filling procedure."""

    step_number: int
    title: str
    description: str
    tip: Optional[str] = Field(
        default=None,
        description="Helpful tip or common mistake to avoid at this step.",
    )


class FormInfo(BaseModel):
    """
    Structured information about a single ECI election form.

    Designed for offline / edge consumption — no Gemini call required.
    """

    form_id: str = Field(description="URL-safe identifier, e.g. 'form-6'.")
    form_number: str = Field(description="Official ECI form number, e.g. 'Form 6'.")
    title: str
    purpose: str
    who_should_fill: str
    deadline_note: str
    steps: list[FormStep]
    official_url: str = "https://voters.eci.gov.in"


class FormListItem(BaseModel):
    """Summary of a form for list display."""

    form_id: str
    form_number: str
    title: str
    purpose: str


# ---------------------------------------------------------------------------
# Health Check Model
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    """Standard health-check response."""

    status: str = "ok"
    version: str
    edge_mode: bool = Field(
        description="True when local/offline models are active; False for cloud Gemini."
    )
    active_sessions: int = Field(
        default=0,
        description="Number of active Gemini ChatSessions in memory (diagnostic).",
    )
