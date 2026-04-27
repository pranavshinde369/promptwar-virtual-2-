"""
main.py – LokMate FastAPI application entry point.

Responsibilities:
  - Create and configure the FastAPI application instance.
  - Register CORS middleware (origins from environment, never hardcoded).
  - Apply slowapi rate limiting on AI endpoints to prevent abuse.
  - Register request-timing middleware for observability.
  - Mount all APIRouter instances (helpdesk, form_data).
"""

import os
import time
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv

from backend.routers import helpdesk, form_data

load_dotenv()

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("lokmate")

# ---------------------------------------------------------------------------
# Rate limiter — 30 chat requests per minute per IP
# Prevents Gemini quota exhaustion and API abuse.
# ---------------------------------------------------------------------------
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])

# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------
app = FastAPI(
    title="LokMate – Voter Helpdesk API",
    description=(
        "Multilingual, voice-first Election Process Education platform "
        "powered by Google Gemini 1.5 Flash. Supports English, Hindi, Marathi, Bhojpuri. "
        "\n\n**Edge-resilient**: `/api/v1/forms` endpoints work fully offline."
    ),
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    contact={"name": "LokMate Support", "url": "https://voters.eci.gov.in"},
    license_info={"name": "MIT"},
)

# Attach rate limiter to the app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Request timing middleware – logs latency for every request
# ---------------------------------------------------------------------------
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """
    Measure and log end-to-end request processing time.

    Also adds an X-Process-Time header to every response so the frontend
    can surface latency diagnostics in developer mode.
    """
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000
    response.headers["X-Process-Time-Ms"] = f"{elapsed_ms:.1f}"
    logger.debug("%s %s → %d | %.1fms", request.method, request.url.path, response.status_code, elapsed_ms)
    return response

# ---------------------------------------------------------------------------
# Router registration
# ---------------------------------------------------------------------------
app.include_router(helpdesk.router, prefix="/api/v1")
app.include_router(form_data.router, prefix="/api/v1")

# ---------------------------------------------------------------------------
# Root
# ---------------------------------------------------------------------------
@app.get("/", include_in_schema=False)
async def root() -> RedirectResponse:
    """Redirect root to interactive Swagger UI."""
    return RedirectResponse(url="/api/docs")
