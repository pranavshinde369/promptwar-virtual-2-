"""
routers/helpdesk.py – FastAPI route handlers for the Voter Helpdesk.

Routes are on a separate APIRouter (mounted in main.py) so that:
  - Business logic lives in gemini_service.py (testable in isolation).
  - Rate limiting decorators are applied per-route.
  - OpenAPI docs auto-generate accurate per-endpoint metadata.
"""

import os
import logging

from fastapi import APIRouter, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address

from backend.models import HelpdeskRequest, HelpdeskResponse, HealthResponse
from backend.gemini_service import get_helpdesk_response, session_manager

logger = logging.getLogger("lokmate.routers.helpdesk")
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/helpdesk", tags=["Voter Helpdesk (AI-Powered)"])

APP_VERSION = "1.0.0"


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check",
    description=(
        "Liveness probe. Returns service status, version, edge mode flag, "
        "and number of active Gemini ChatSessions in memory."
    ),
)
async def health_check() -> HealthResponse:
    """
    Lightweight liveness probe with operational diagnostics.

    No external API calls are made so load-balancers and CI pipelines
    can poll this endpoint without consuming Gemini quota.
    """
    use_local = os.getenv("USE_LOCAL_MODEL", "false").lower() == "true"
    return HealthResponse(
        version=APP_VERSION,
        edge_mode=use_local,
        active_sessions=session_manager.active_session_count,
    )


@router.post(
    "/chat",
    response_model=HelpdeskResponse,
    status_code=status.HTTP_200_OK,
    summary="Ask the AI Voter Helpdesk",
    description=(
        "Send a voter question and receive a Gemini 1.5 Flash–powered explanation "
        "of election forms or procedures in the requested language. "
        "Include `session_id` from a prior response to continue the conversation."
    ),
)
@limiter.limit("30/minute")
async def chat_with_helpdesk(request: Request, payload: HelpdeskRequest) -> HelpdeskResponse:
    """
    Core AI conversational endpoint for LokMate.

    Multi-turn conversation:
        On the first call, omit `session_id`. The response includes a new
        `session_id`. Pass this in subsequent requests to continue the same
        Gemini ChatSession, giving the AI full conversation history.

    Rate limiting:
        30 requests per minute per IP (enforced by slowapi).
        Exceeding this returns HTTP 429 Too Many Requests.

    Args:
        request: FastAPI Request object (required by slowapi limiter decorator).
        payload: Validated ``HelpdeskRequest`` with query, language, session_id.

    Returns:
        ``HelpdeskResponse`` with answer, language, form references, session_id.

    Raises:
        HTTPException 503: When the Gemini API call fails.
    """
    logger.info(
        "Chat request | lang=%s | session=%s | query_len=%d",
        payload.language,
        payload.session_id or "new",
        len(payload.query),
    )

    try:
        answer, form_refs, resolved_session_id = await get_helpdesk_response(
            query=payload.query,
            language=payload.language,
            session_id=payload.session_id,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    return HelpdeskResponse(
        answer=answer,
        language=payload.language,
        form_references=form_refs,
        session_id=resolved_session_id,
    )
