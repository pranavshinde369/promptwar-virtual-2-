"""
conftest.py – Shared pytest fixtures for the LokMate test suite.

Centralising fixtures here eliminates duplication across test files and
makes the test suite easier to extend (one place to update the async client
setup, mock objects, or test data constants).
"""

import pytest
from httpx import AsyncClient, ASGITransport
from backend.main import app


# ---------------------------------------------------------------------------
# Constants — reused across multiple test modules
# ---------------------------------------------------------------------------

MOCK_ANSWER_EN = "To register as a new voter, fill out Form 6 on the NVSP portal."
MOCK_ANSWER_HI = "नए मतदाता के रूप में पंजीकरण के लिए, NVSP पोर्टल पर Form 6 भरें।"
MOCK_SESSION_ID = "550e8400-e29b-41d4-a716-446655440000"
MOCK_FORMS = ["Form 6"]


# ---------------------------------------------------------------------------
# Async HTTP client fixture
# ---------------------------------------------------------------------------

@pytest.fixture
async def async_client() -> AsyncClient:
    """
    Async HTTP client wired directly to the FastAPI ASGI app via ASGITransport.

    No real network calls are made — all traffic stays in-process.
    This enables fast, deterministic tests without a running server.
    """
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client


# ---------------------------------------------------------------------------
# Mock Gemini response fixture
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_gemini_en():
    """Return value tuple mimicking a successful English Gemini response."""
    return (MOCK_ANSWER_EN, MOCK_FORMS, MOCK_SESSION_ID)


@pytest.fixture
def mock_gemini_hi():
    """Return value tuple mimicking a successful Hindi Gemini response."""
    return (MOCK_ANSWER_HI, MOCK_FORMS, MOCK_SESSION_ID)
