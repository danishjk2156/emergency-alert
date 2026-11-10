from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .database import Base, SessionLocal, engine
from .routers import analytics, auth, categories, dashboard, incidents, teams
from .seed import seed_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Create tables if not existing
    Base.metadata.create_all(bind=engine)
    # 2. Seed initial categories, admin user, and 12 realistic incidents
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="Emergency Response & Disaster Management Platform",
    description="Backend API for Emergency Response & Disaster Management (Code Clash 2026 Round 1).",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Ensure consistent JSON error structure: {'detail': '...'} with HTTP 422."""
    errors = exc.errors()
    if errors:
        first = errors[0]
        field_loc = " -> ".join([str(loc) for loc in first.get("loc", []) if loc != "body"])
        msg = first.get("msg", "Validation error")
        detail_text = f"{field_loc}: {msg}" if field_loc else msg
    else:
        detail_text = "Unprocessable Entity"

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": detail_text, "errors": errors},
    )


# Include all routers under /api prefix
app.include_router(categories.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(incidents.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(teams.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")


@app.get("/", tags=["Health"])
def health_check():
    """Root health check endpoint."""
    return {
        "status": "ok",
        "message": "Emergency Response & Disaster Management API is running",
        "docs": "/docs",
    }


@app.get("/api/health", tags=["Health"])
def api_health():
    """API health check endpoint."""
    return {"status": "ok", "service": "emergency-backend"}
