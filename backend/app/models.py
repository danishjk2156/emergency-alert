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
    people_affected = Column(Integer, default=0, nullable=False)
    contact_name = Column(String(80), nullable=True)
    contact_phone = Column(String(15), nullable=True)
    contact_email = Column(String(120), nullable=True)

    severity = Column(String(20), nullable=False, index=True)  # Low | Medium | High | Critical
    severity_score = Column(Integer, nullable=False)
    severity_reasons = Column(Text, nullable=False, default="[]")  # JSON-encoded list of strings
    severity_overridden = Column(Boolean, default=False, nullable=False)

    status = Column(String(20), default="Reported", nullable=False, index=True)  # Reported | Pending | In Progress | Resolved
    is_duplicate = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    category = relationship("Category", back_populates="incidents")
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
