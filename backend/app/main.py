from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routers import auth, dashboard, incidents

app = FastAPI(
    title="CobotEx - Emergency Incident Reporting & Monitoring",
    description="Backend API for emergency incident reporting, tracking, and monitoring.",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(incidents.router)
app.include_router(dashboard.router)


@app.on_event("startup")
def on_startup():
    """Create database tables on startup."""
    Base.metadata.create_all(bind=engine)


@app.get("/", tags=["Health"])
def health_check():
    """Root health check endpoint."""
    return {"status": "ok", "message": "CobotEx API is running"}
