from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import Incident, IncidentCategory, IncidentSeverity, IncidentStatus
from ..schemas import DashboardStats, IncidentResponse

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db)):
    """Get aggregated dashboard statistics."""
    total = db.query(func.count(Incident.id)).scalar()

    # Count by status
    by_status_rows = (
        db.query(Incident.status, func.count(Incident.id))
        .group_by(Incident.status)
        .all()
    )
    by_status = {s.value: 0 for s in IncidentStatus}
    for status_val, count in by_status_rows:
        by_status[status_val.value if hasattr(status_val, "value") else status_val] = count

    # Count by severity
    by_severity_rows = (
        db.query(Incident.severity, func.count(Incident.id))
        .group_by(Incident.severity)
        .all()
    )
    by_severity = {s.value: 0 for s in IncidentSeverity}
    for sev_val, count in by_severity_rows:
        by_severity[sev_val.value if hasattr(sev_val, "value") else sev_val] = count

    # Count by category
    by_category_rows = (
        db.query(Incident.category, func.count(Incident.id))
        .group_by(Incident.category)
        .all()
    )
    by_category = {c.value: 0 for c in IncidentCategory}
    for cat_val, count in by_category_rows:
        by_category[cat_val.value if hasattr(cat_val, "value") else cat_val] = count

    return DashboardStats(
        total_incidents=total or 0,
        by_status=by_status,
        by_severity=by_severity,
        by_category=by_category,
    )


@router.get("/recent", response_model=list[IncidentResponse])
def get_recent_incidents(db: Session = Depends(get_db)):
    """Get the 10 most recent incidents."""
    incidents = (
        db.query(Incident)
        .options(joinedload(Incident.reporter), joinedload(Incident.assigned_to))
        .order_by(Incident.created_at.desc())
        .limit(10)
        .all()
    )
    return incidents
