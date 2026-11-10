from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr

from .models import IncidentCategory, IncidentSeverity, IncidentStatus, UserRole


# ── User Schemas ──────────────────────────────────────────────────────────────


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: Optional[UserRole] = UserRole.REPORTER


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: UserRole
    created_at: datetime
    is_active: bool

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ── Incident Schemas ──────────────────────────────────────────────────────────


class IncidentCreate(BaseModel):
    title: str
    description: str
    category: IncidentCategory
    severity: IncidentSeverity
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    media_urls: Optional[List[str]] = []


class IncidentUpdateSchema(BaseModel):
    """Schema for updating an existing incident (not to be confused with IncidentUpdate model)."""

    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[IncidentCategory] = None
    severity: Optional[IncidentSeverity] = None
    status: Optional[IncidentStatus] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    assigned_to_id: Optional[int] = None
    media_urls: Optional[List[str]] = None


class IncidentResponse(BaseModel):
    id: int
    title: str
    description: str
    category: IncidentCategory
    severity: IncidentSeverity
    status: IncidentStatus
    latitude: Optional[float]
    longitude: Optional[float]
    address: Optional[str]
    reporter_id: int
    reporter: UserResponse
    assigned_to_id: Optional[int]
    assigned_to: Optional[UserResponse]
    media_urls: List[str]
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime]

    model_config = {"from_attributes": True}


class IncidentListResponse(BaseModel):
    incidents: List[IncidentResponse]
    total: int
    page: int
    per_page: int


# ── Incident Update (Timeline) Schemas ────────────────────────────────────────


class IncidentUpdateCreate(BaseModel):
    message: str
    status_change: Optional[str] = None


class IncidentUpdateResponse(BaseModel):
    id: int
    incident_id: int
    user_id: int
    user: UserResponse
    message: str
    status_change: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class IncidentDetailResponse(IncidentResponse):
    updates: List[IncidentUpdateResponse] = []

    model_config = {"from_attributes": True}


# ── Dashboard Schemas ─────────────────────────────────────────────────────────


class DashboardStats(BaseModel):
    total_incidents: int
    by_status: dict[str, int]
    by_severity: dict[str, int]
    by_category: dict[str, int]
