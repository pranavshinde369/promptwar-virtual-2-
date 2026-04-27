"""
test_main.py – Comprehensive pytest test suite for LokMate FastAPI backend.

Philosophy:
  - Tests NEVER call the real Gemini API. The service layer is patched with
    unittest.mock so tests are fast, offline, and consume zero API quota.
  - conftest.py provides shared fixtures (async_client, mock data).
  - asyncio_mode = auto (set in pytest.ini) removes boilerplate decorators.

Run:
    pytest backend/ -v --tb=short
"""

import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient

# All constants come from conftest.py fixtures
CHAT_PATH = "/api/v1/helpdesk/chat"
HEALTH_PATH = "/api/v1/helpdesk/health"
FORMS_PATH = "/api/v1/forms"

MOCK_SESSION_ID = "550e8400-e29b-41d4-a716-446655440000"
MOCK_ANSWER_EN = "To register as a new voter, fill out Form 6 on the NVSP portal."
MOCK_FORMS = ["Form 6"]


# ===========================================================================
# Health-check tests
# ===========================================================================

async def test_health_check_returns_ok(async_client: AsyncClient):
    """GET /health → HTTP 200 with correct JSON keys."""
    response = await async_client.get(HEALTH_PATH)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data
    assert isinstance(data["edge_mode"], bool)
    assert isinstance(data["active_sessions"], int)


async def test_health_check_edge_mode_default_false(async_client: AsyncClient, monkeypatch):
    """Edge mode defaults to False when USE_LOCAL_MODEL env var is absent."""
    monkeypatch.delenv("USE_LOCAL_MODEL", raising=False)
    response = await async_client.get(HEALTH_PATH)
    assert response.json()["edge_mode"] is False


async def test_health_check_edge_mode_true(async_client: AsyncClient, monkeypatch):
    """Edge mode returns True when USE_LOCAL_MODEL=true."""
    monkeypatch.setenv("USE_LOCAL_MODEL", "true")
    response = await async_client.get(HEALTH_PATH)
    assert response.json()["edge_mode"] is True


async def test_health_response_has_x_process_time_header(async_client: AsyncClient):
    """Timing middleware must add X-Process-Time-Ms header to every response."""
    response = await async_client.get(HEALTH_PATH)
    assert "x-process-time-ms" in response.headers


# ===========================================================================
# Helpdesk chat endpoint – success cases
# ===========================================================================

async def test_chat_returns_valid_structure(async_client: AsyncClient):
    """POST /chat → HTTP 200 with answer, language, form_references, session_id."""
    with patch(
        "backend.routers.helpdesk.get_helpdesk_response",
        new_callable=AsyncMock,
        return_value=(MOCK_ANSWER_EN, MOCK_FORMS, MOCK_SESSION_ID),
    ):
        response = await async_client.post(
            CHAT_PATH,
            json={"query": "How do I register to vote?", "language": "en"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["answer"] == MOCK_ANSWER_EN
    assert data["language"] == "en"
    assert isinstance(data["form_references"], list)
    assert "session_id" in data
    assert data["form_references"] == MOCK_FORMS


async def test_chat_returns_hindi_language(async_client: AsyncClient):
    """Language field in response must echo the requested language code."""
    with patch(
        "backend.routers.helpdesk.get_helpdesk_response",
        new_callable=AsyncMock,
        return_value=("फॉर्म 6 भरें।", ["Form 6"], MOCK_SESSION_ID),
    ):
        response = await async_client.post(
            CHAT_PATH,
            json={"query": "मतदान कैसे करूं?", "language": "hi"},
        )

    assert response.status_code == 200
    assert response.json()["language"] == "hi"


async def test_chat_session_id_is_echoed(async_client: AsyncClient):
    """session_id returned must match the one resolved by the service."""
    with patch(
        "backend.routers.helpdesk.get_helpdesk_response",
        new_callable=AsyncMock,
        return_value=(MOCK_ANSWER_EN, MOCK_FORMS, MOCK_SESSION_ID),
    ):
        response = await async_client.post(
            CHAT_PATH,
            json={"query": "What is Form 8?", "language": "en", "session_id": MOCK_SESSION_ID},
        )

    assert response.status_code == 200
    assert response.json()["session_id"] == MOCK_SESSION_ID


async def test_chat_marathi_language(async_client: AsyncClient):
    """Marathi (mr) should be accepted and echoed."""
    with patch(
        "backend.routers.helpdesk.get_helpdesk_response",
        new_callable=AsyncMock,
        return_value=("फॉर्म 8 भरा.", ["Form 8"], MOCK_SESSION_ID),
    ):
        response = await async_client.post(
            CHAT_PATH,
            json={"query": "मला फॉर्म 8 भरायचा आहे", "language": "mr"},
        )
    assert response.status_code == 200
    assert response.json()["language"] == "mr"


# ===========================================================================
# Helpdesk chat – Pydantic validation (security / input sanitisation)
# ===========================================================================

async def test_chat_empty_query_rejected(async_client: AsyncClient):
    """Whitespace-only query must be rejected with HTTP 422."""
    response = await async_client.post(CHAT_PATH, json={"query": "   ", "language": "en"})
    assert response.status_code == 422


async def test_chat_query_too_long_rejected(async_client: AsyncClient):
    """Query exceeding 1000 chars must be rejected with HTTP 422."""
    response = await async_client.post(CHAT_PATH, json={"query": "x" * 1001, "language": "en"})
    assert response.status_code == 422


async def test_chat_invalid_language_rejected(async_client: AsyncClient):
    """Unsupported language code must be rejected with HTTP 422."""
    response = await async_client.post(CHAT_PATH, json={"query": "Hello", "language": "fr"})
    assert response.status_code == 422


async def test_chat_invalid_session_id_format_rejected(async_client: AsyncClient):
    """Malformed session_id (not UUID v4) must be rejected with HTTP 422."""
    response = await async_client.post(
        CHAT_PATH,
        json={"query": "How to vote?", "language": "en", "session_id": "not-a-uuid"},
    )
    assert response.status_code == 422


# ===========================================================================
# Helpdesk chat – service failure
# ===========================================================================

async def test_chat_gemini_failure_returns_503(async_client: AsyncClient):
    """RuntimeError from the Gemini service must surface as HTTP 503."""
    with patch(
        "backend.routers.helpdesk.get_helpdesk_response",
        new_callable=AsyncMock,
        side_effect=RuntimeError("Gemini unavailable"),
    ):
        response = await async_client.post(
            CHAT_PATH, json={"query": "Help!", "language": "en"}
        )
    assert response.status_code == 503


# ===========================================================================
# Form Knowledge Base (offline) endpoint tests
# ===========================================================================

async def test_forms_list_returns_all_forms(async_client: AsyncClient):
    """GET /forms → list of dicts each with form_id, form_number, title, purpose."""
    response = await async_client.get(FORMS_PATH)
    assert response.status_code == 200
    forms = response.json()
    assert isinstance(forms, list)
    assert len(forms) >= 4   # At minimum: form-6, form-7, form-8, form-8a
    for form in forms:
        assert "form_id" in form
        assert "form_number" in form
        assert "title" in form
        assert "purpose" in form


async def test_form_6_detail_has_steps(async_client: AsyncClient):
    """GET /forms/form-6 → structured object with non-empty steps list."""
    response = await async_client.get(f"{FORMS_PATH}/form-6")
    assert response.status_code == 200
    data = response.json()
    assert data["form_number"] == "Form 6"
    assert isinstance(data["steps"], list)
    assert len(data["steps"]) >= 4
    # Each step must have the required fields
    for step in data["steps"]:
        assert "step_number" in step
        assert "title" in step
        assert "description" in step


async def test_form_8_detail_has_steps(async_client: AsyncClient):
    """GET /forms/form-8 → structured guide for shifting residence."""
    response = await async_client.get(f"{FORMS_PATH}/form-8")
    assert response.status_code == 200
    data = response.json()
    assert data["form_number"] == "Form 8"
    assert len(data["steps"]) >= 3


async def test_invalid_form_returns_404(async_client: AsyncClient):
    """GET /forms/form-99 → HTTP 404 with helpful error message."""
    response = await async_client.get(f"{FORMS_PATH}/form-99")
    assert response.status_code == 404
    assert "form-99" in response.json()["detail"].lower() or "not found" in response.json()["detail"].lower()


async def test_forms_endpoint_works_without_gemini_key(async_client: AsyncClient, monkeypatch):
    """
    The forms knowledge base must work even if GEMINI_API_KEY is missing,
    proving offline/edge resilience of this endpoint.
    """
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    response = await async_client.get(FORMS_PATH)
    assert response.status_code == 200   # no Gemini call → no failure
