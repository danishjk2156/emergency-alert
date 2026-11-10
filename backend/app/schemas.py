from datetime import datetime
import json
import re
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------
class CategoryNested(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str
    name: str
    icon: str


class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    icon: str
    base_weight: int


# ---------------------------------------------------------------------------
# Auth & Users
# ---------------------------------------------------------------------------
class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    role: str


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    token: str
    user: UserResponse


# ---------------------------------------------------------------------------
# Incidents
# ---------------------------------------------------------------------------
VALID_CATEGORIES = {"FIRE", "ROAD", "MEDICAL", "FLOOD", "COLLAPSE", "OTHER"}
VALID_STATUSES = {"Reported", "Assigned", "Pending", "In Progress", "Resolved", "False Alarm"}
VALID_SEVERITIES = {"Low", "Medium", "High", "Critical"}
VALID_VERIFICATION = {"Unverified", "Corroborated", "Verified", "False Alarm"}

PHONE_REGEX = re.compile(r"^\+?[0-9]{7,15}$")
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


class IncidentCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=120)
    description: str = Field(..., min_length=3, max_length=2000)
    category_code: str
    location: str = Field(default="", max_length=200)
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    # Location metadata
    location_accuracy_m: Optional[float] = None
    location_source: Optional[str] = "manual"

    people_affected: int = Field(default=0, ge=0, le=100000)
    contact_name: Optional[str] = Field(default=None, max_length=80)
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None

    # Anti-bot honeypot
    website: Optional[str] = None

    @field_validator("category_code")
    @classmethod
    def validate_category(cls, v: str) -> str:
        code = v.strip().upper()
        if code not in VALID_CATEGORIES:
            raise ValueError(f"category_code must be one of: {', '.join(sorted(VALID_CATEGORIES))}")
        return code

    @field_validator("contact_phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        cleaned = v.strip()
        if not cleaned:
            return None
        if not PHONE_REGEX.match(cleaned):
            raise ValueError("contact_phone must contain 7-15 digits (optional leading +)")
        return cleaned

    @field_validator("contact_email")
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        cleaned = v.strip()
        if not cleaned:
            return None
        if not EMAIL_REGEX.match(cleaned):
            raise ValueError("contact_email must be a valid email address")
        return cleaned


class IncidentTrackResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ref_code: str
    title: str
    status: str
    severity: str
    trust_score: int = 50
    verification_status: str = "Unverified"
    created_at: datetime
    updated_at: datetime


class IncidentStatusHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    incident_id: int
    from_status: Optional[str] = None
    to_status: str
    note: Optional[str] = None
    changed_by: Optional[int] = None
    changed_by_name: Optional[str] = None
    changed_at: datetime


class TeamNested(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    category: str
    latitude: float
    longitude: float
    location_label: str
    availability: str


class IncidentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ref_code: Optional[str] = None
    title: str
    description: str
    category: CategoryNested
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_accuracy_m: Optional[float] = None
    location_source: str = "manual"
    location_mismatch_km: Optional[float] = None

    people_affected: int
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None

    severity: str
    severity_score: int
    severity_reasons: list[str]
    severity_overridden: bool
    status: str
    is_duplicate: bool

    # Response Team Assignment
    assigned_team_id: Optional[int] = None
    assigned_at: Optional[datetime] = None
    assignment_distance_km: Optional[float] = None
    eta_minutes: Optional[int] = None
    assigned_team: Optional[TeamNested] = None

    # Trust Layer
    trust_score: int = 50
    trust_reasons: list[str] = []
    verification_status: str = "Unverified"
    verification: Optional[str] = None

    # Corroboration & Clustering
    duplicate_of: Optional[int] = None
    cluster_id: Optional[int] = None
    cluster_size: int = 1
    cluster_people_affected: Optional[int] = None
    corroborating_ids: list[int] = []
    duplicate_ids: list[int] = []

    # LLM Assessment
    llm_assessment: Optional[dict] = None

    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None

    @field_validator("severity_reasons", mode="before")
    @classmethod
    def parse_reasons(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return [v]
        return v or []

    @field_validator("trust_reasons", mode="before")
    @classmethod
    def parse_trust_reasons(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return [v]
        return v or []

    @field_validator("llm_assessment", mode="before")
    @classmethod
    def parse_llm(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return {"raw": v}
        return v


class IncidentDetailResponse(IncidentResponse):
    history: list[IncidentStatusHistoryResponse] = []


class IncidentListResponse(BaseModel):
    items: list[IncidentResponse]
    total: int


class StatusUpdateRequest(BaseModel):
    status: str
    note: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        s = v.strip()
        if s not in VALID_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(sorted(VALID_STATUSES))}")
        return s


class VerifyRequest(BaseModel):
    verification_status: str  # "Verified" | "False Alarm"
    note: Optional[str] = None

    @field_validator("verification_status")
    @classmethod
    def validate_verification(cls, v: str) -> str:
        s = v.strip().title()
        if s not in {"Verified", "False Alarm"}:
            raise ValueError("verification_status must be 'Verified' or 'False Alarm'")
        return s


class SeverityUpdateRequest(BaseModel):
    severity: str

    @field_validator("severity")
    @classmethod
    def validate_severity(cls, v: str) -> str:
        s = v.strip()
        if s not in VALID_SEVERITIES:
            raise ValueError(f"severity must be one of: {', '.join(sorted(VALID_SEVERITIES))}")
        return s


# ---------------------------------------------------------------------------
# Related & Corroborating Incidents
# ---------------------------------------------------------------------------
class RelatedIncidentItem(BaseModel):
    id: int
    ref_code: Optional[str] = None
    title: str
    location: str
    distance_m: Optional[float] = None
    minutes_apart: int
    verification_status: str
    is_duplicate: bool


class RelatedIncidentsResponse(BaseModel):
    corroborating: list[RelatedIncidentItem]
    duplicates: list[RelatedIncidentItem]


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
class DashboardCategoryStat(BaseModel):
    code: str
    name: str
    icon: str
    count: int


class RecentCriticalIncident(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ref_code: Optional[str] = None
    title: str
    location: str
    created_at: datetime


class LargestClusterStat(BaseModel):
    root_id: int
    title: str
    size: int


class DashboardStatsResponse(BaseModel):
    total: int
    critical: int
    critical_active: int
    pending: int
    resolved: int
    by_status: dict[str, int]
    by_severity: dict[str, int]
    by_category: list[DashboardCategoryStat]
    recent_critical: list[RecentCriticalIncident]

    # Trust Layer stats
    unverified: int = 0
    corroborated: int = 0
    verified: int = 0
    false_alarms: int = 0
    suspicious: int = 0  # trust < 30
    active_clusters: int = 0
    largest_cluster: Optional[LargestClusterStat] = None
    rate_limited_today: int = 0


# ---------------------------------------------------------------------------
# AI / Gemini Flash Lite Triage Schemas
# ---------------------------------------------------------------------------
class AIClassifyRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=120)
    description: str = Field(..., min_length=3, max_length=2000)
    category_code: str = "OTHER"
    people_affected: int = Field(default=0, ge=0)


class AIAnalysisResponse(BaseModel):
    model: str
    severity: str
    confidence: float
    severity_score: int
    summary: str
    extracted_hazards: list[str]
    recommended_dispatch: list[str]
    reasons: list[str]


# ---------------------------------------------------------------------------
# Response Teams
# ---------------------------------------------------------------------------
VALID_TEAM_CATEGORIES = {"Fire", "Medical", "Rescue", "Police"}
VALID_TEAM_AVAILABILITIES = {"Available", "Busy"}


class IncidentBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ref_code: Optional[str] = None
    title: str


class TeamBase(BaseModel):
    code: str = Field(..., min_length=2, max_length=20)
    name: str = Field(..., min_length=2, max_length=80)
    category: str
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    location_label: str = Field(..., min_length=2, max_length=100)

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        s = v.strip().title()
        if s not in VALID_TEAM_CATEGORIES:
            raise ValueError(f"category must be one of: {', '.join(sorted(VALID_TEAM_CATEGORIES))}")
        return s


class TeamCreate(TeamBase):
    availability: Optional[str] = "Available"

    @field_validator("availability")
    @classmethod
    def validate_avail(cls, v: Optional[str]) -> str:
        if not v:
            return "Available"
        s = v.strip().title()
        if s not in VALID_TEAM_AVAILABILITIES:
            raise ValueError(f"availability must be one of: {', '.join(sorted(VALID_TEAM_AVAILABILITIES))}")
        return s


class TeamUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=2, max_length=20)
    name: Optional[str] = Field(None, min_length=2, max_length=80)
    category: Optional[str] = None
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    location_label: Optional[str] = Field(None, min_length=2, max_length=100)
    availability: Optional[str] = None

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        s = v.strip().title()
        if s not in VALID_TEAM_CATEGORIES:
            raise ValueError(f"category must be one of: {', '.join(sorted(VALID_TEAM_CATEGORIES))}")
        return s

    @field_validator("availability")
    @classmethod
    def validate_avail(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        s = v.strip().title()
        if s not in VALID_TEAM_AVAILABILITIES:
            raise ValueError(f"availability must be one of: {', '.join(sorted(VALID_TEAM_AVAILABILITIES))}")
        return s


class TeamAvailabilityUpdate(BaseModel):
    availability: str

    @field_validator("availability")
    @classmethod
    def validate_avail(cls, v: str) -> str:
        s = v.strip().title()
        if s not in VALID_TEAM_AVAILABILITIES:
            raise ValueError(f"availability must be one of: {', '.join(sorted(VALID_TEAM_AVAILABILITIES))}")
        return s


class TeamOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    category: str
    latitude: float
    longitude: float
    location_label: str
    availability: str
    current_incident_id: Optional[int] = None
    current_incident: Optional[IncidentBrief] = None
    updated_at: datetime


class TeamWithDistance(TeamOut):
    distance_km: float
    eta_minutes: int


class AssignTeamRequest(BaseModel):
    team_id: Optional[int] = None


# ---------------------------------------------------------------------------
# Priority Scoring
# ---------------------------------------------------------------------------
class PriorityBreakdown(BaseModel):
    severity_score: int
    severity_component: float
    people_affected: int
    people_score: float
    people_component: float
    minutes_active: float
    time_score: float
    time_component: float
    category_code: str
    category_base_weight: int
    category_score: float
    category_component: float


class PrioritizedIncidentResponse(IncidentResponse):
    priority_score: float
    priority_label: str
    priority_breakdown: PriorityBreakdown
    rank: int


# ---------------------------------------------------------------------------
# Analytics Summary
# ---------------------------------------------------------------------------
class CategoryCount(BaseModel):
    code: str
    name: str
    count: int


class StatusCount(BaseModel):
    status: str
    count: int


class DailyCount(BaseModel):
    date: str
    count: int


class AnalyticsSummaryResponse(BaseModel):
    total_incidents: int
    critical_incidents: int
    available_teams: int
    busy_teams: int
    assigned_incidents: int
    resolved_incidents: int
    by_category: list[CategoryCount]
    by_status: list[StatusCount]
    incidents_over_time: list[DailyCount]
