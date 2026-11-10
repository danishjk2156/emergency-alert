from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from sqlalchemy import inspect, text

from .database import Base, SessionLocal, engine
from .routers import analytics, auth, categories, dashboard, incidents, teams
from .seed import seed_database


def add_missing_columns() -> None:
    """create_all() never alters existing tables, so a database made by an older
    version would lack newer columns (e.g. incidents.assigned_team_id) and crash.
    Add any missing nullable columns in place; data is kept."""
    insp = inspect(engine)
    existing_tables = set(insp.get_table_names())
    with engine.begin() as conn:
        for table in Base.metadata.tables.values():
            if table.name not in existing_tables:
                continue
            have = {c["name"] for c in insp.get_columns(table.name)}
            for col in table.columns:
                if col.name in have:
                    continue
                col_type = col.type.compile(dialect=engine.dialect)
                conn.execute(text(f'ALTER TABLE "{table.name}" ADD COLUMN "{col.name}" {col_type}'))


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Create tables if not existing, then bring older tables up to date
    Base.metadata.create_all(bind=engine)
    add_missing_columns()
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
    # Let the browser read the 429 wait time (needed for the frontend countdown)
    expose_headers=["Retry-After"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Ensure consistent JSON error structure: {'detail': '...'} with HTTP 422."""
    # Keep only JSON-safe fields. Raw errors from custom validators carry the
    # original ValueError in "ctx", which json.dumps cannot serialise (-> 500).
    errors = [
        {
            "loc": [str(part) for part in err.get("loc", [])],
            "msg": str(err.get("msg", "Validation error")).removeprefix("Value error, "),
            "type": str(err.get("type", "value_error")),
        }
        for err in exc.errors()
    ]
    if errors:
        first = errors[0]
        field_loc = " -> ".join(loc for loc in first["loc"] if loc != "body")
        detail_text = f"{field_loc}: {first['msg']}" if field_loc else first["msg"]
    else:
        detail_text = "Unprocessable Entity"

    return JSONResponse(
        status_code=422,
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
