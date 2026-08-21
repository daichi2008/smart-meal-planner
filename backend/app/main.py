import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import init_db
from app.utils.cache import cache

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)


def _rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please slow down."},
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await cache.connect()
    logger.info("%s started (env=%s)", settings.APP_NAME, settings.ENVIRONMENT)
    yield
    await cache.close()


docs_url = None if settings.is_production else "/api/docs"
openapi_url = None if settings.is_production else "/api/openapi.json"

app = FastAPI(
    title=f"{settings.APP_NAME} API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=docs_url,
    openapi_url=openapi_url,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

SECURITY_HEADERS = [
    {"key": "X-Content-Type-Options", "value": "nosniff"},
    {"key": "X-Frame-Options", "value": "DENY"},
    {"key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload"},
    {"key": "Referrer-Policy", "value": "strict-origin-when-cross-origin"},
    {"key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()"},
    {"key": "X-XSS-Protection", "value": "1; mode=block"},
]

if settings.is_production:
    SECURITY_HEADERS.append({"key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'none'"})


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    for header in SECURITY_HEADERS:
        response.headers.append(header["key"], header["value"])
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.resolved_cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health", tags=["health"])
@limiter.exempt
async def health() -> dict:
    return {"status": "ok", "app": settings.APP_NAME, "version": "1.0.0"}
