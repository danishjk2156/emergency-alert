from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from .database import Base


def utc_now() -> datetime:
    """Return timezone-aware current UTC datetime."""
    return datetime.now(timezone.utc)


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, index=True, nullable=False)
    name = Column(String(50), nullable=False)
    icon = Column(String(8), nullable=False)
    base_weight = Column(Integer, nullable=False)

    incidents = relationship("Incident", back_populates="category")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(80), nullable=False)
    email = Column(String(120), unique=True, index=True, nullable=False)
    password_hash = Column(String(200), nullable=False)
    role = Column(String(20), default="admin", nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    status_changes = relationship("IncidentStatusHistory", back_populates="user")


class ReporterReputation(Base):
    __tablename__ = "reporter_reputation"

    device_hash = Column(String(64), primary_key=True)
    total_reports = Column(Integer, default=0, nullable=False)
    verified_count = Column(Integer, default=0, nullable=False)
    false_alarm_count = Column(Integer, default=0, nullable=False)
    last_report_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


class ResponseTeam(Base):
    __tablename__ = "response_teams"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, index=True, nullable=False)
    name = Column(String(80), nullable=False)
    category = Column(String(20), nullable=False)  # Fire | Medical | Rescue | Police
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    location_label = Column(String(100), nullable=False)
    availability = Column(String(20), default="Available", nullable=False)  # Available | Busy
    current_incident_id = Column(
        Integer, ForeignKey("incidents.id", ondelete="SET NULL"), nullable=True
    )
    updated_at = Column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    current_incident = relationship(
        "Incident",
        foreign_keys=[current_incident_id],
        post_update=True,
    )


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    ref_code = Column(String(20), unique=True, index=True, nullable=True)
    title = Column(String(120), nullable=False)
    description = Column(Text, nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False, index=True)
    location = Column(String(200), nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    # Location & Geocoding metadata
    location_accuracy_m = Column(Float, nullable=True)
    location_source = Column(String(20), default="manual", nullable=False)  # gps | manual | ip
    location_mismatch_km = Column(Float, nullable=True)

    people_affected = Column(Integer, default=0, nullable=False)
    contact_name = Column(String(80), nullable=True)
    contact_phone = Column(String(15), nullable=True)
    contact_email = Column(String(120), nullable=True)

    # Severity Engine fields
    severity = Column(String(20), nullable=False, index=True)  # Low | Medium | High | Critical
    severity_score = Column(Integer, nullable=False)
    severity_reasons = Column(Text, nullable=False, default="[]")  # JSON-encoded list of strings
    severity_overridden = Column(Boolean, default=False, nullable=False)

    # Status & Trust Layer
    status = Column(String(20), default="Reported", nullable=False, index=True)  # Reported | Pending | In Progress | Resolved | False Alarm
    is_duplicate = Column(Boolean, default=False, nullable=False)

    # Trust Score & Verification
    trust_score = Column(Integer, default=50, nullable=False)
    trust_reasons = Column(Text, default="[]", nullable=False)  # JSON-encoded list of strings
    verification_status = Column(
        String(20), default="Unverified", nullable=False, index=True
    )  # Unverified | Corroborated | Verified | False Alarm

    # Reporter & Network Hashing
    device_hash = Column(String(64), nullable=True, index=True)
    ip_hash = Column(String(64), nullable=True, index=True)
    phone_given = Column(Boolean, default=False, nullable=False)
    duplicate_of = Column(Integer, ForeignKey("incidents.id"), nullable=True)

    # Corroboration & Clustering
    cluster_id = Column(Integer, nullable=True, index=True)
    cluster_size = Column(Integer, default=1, nullable=False)
    cluster_people_affected = Column(Integer, nullable=True)

    # LLM Plausibility Assessment
    llm_assessment = Column(Text, nullable=True)
    llm_checked_at = Column(DateTime(timezone=True), nullable=True)

    # Response Team Assignment
    assigned_team_id = Column(
        Integer, ForeignKey("response_teams.id", ondelete="SET NULL"), nullable=True
    )
    assigned_at = Column(DateTime(timezone=True), nullable=True)
    assignment_distance_km = Column(Float, nullable=True)
    eta_minutes = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    category = relationship("Category", back_populates="incidents")
    assigned_team = relationship(
        "ResponseTeam",
        foreign_keys=[assigned_team_id],
        post_update=True,
    )
    history = relationship(
        "IncidentStatusHistory",
        back_populates="incident",
        cascade="all, delete-orphan",
        order_by="desc(IncidentStatusHistory.changed_at)",
    )


class IncidentStatusHistory(Base):
    __tablename__ = "incident_status_history"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(
        Integer,
        ForeignKey("incidents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    from_status = Column(String(20), nullable=True)
    to_status = Column(String(20), nullable=False)
    note = Column(Text, nullable=True)
    changed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    changed_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    incident = relationship("Incident", back_populates="history")
    user = relationship("User", back_populates="status_changes")

    @property
    def changed_by_name(self):
        return self.user.name if self.user else None


Index("ix_incidents_created_at_desc", Incident.created_at.desc())
Index("ix_incidents_status_severity", Incident.status, Incident.severity)
