from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import require_admin
from ..database import get_db
from ..models import Category, Incident, User
from ..schemas import DashboardCategoryStat, DashboardStatsResponse, RecentCriticalIncident

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStatsResponse)
def get_dashboard_stats(
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Admin endpoint: Retrieve aggregated summary metrics, status and severity distributions,
    category counts across all 6 categories, and recent active critical incidents.
    """
    total = db.query(Incident).count()
    critical_total = db.query(Incident).filter(Incident.severity == "Critical").count()
    critical_active = (
        db.query(Incident)
        .filter(Incident.severity == "Critical", Incident.status != "Resolved")
        .count()
    )
    pending_total = db.query(Incident).filter(Incident.status != "Resolved").count()
    resolved_total = db.query(Incident).filter(Incident.status == "Resolved").count()

    # Status distribution (ensure all 4 keys exist even if 0)
    by_status: dict[str, int] = {
        "Reported": 0,
        "Pending": 0,
        "In Progress": 0,
        "Resolved": 0,
    }
    status_counts = (
        db.query(Incident.status, func.count(Incident.id))
        .group_by(Incident.status)
        .all()
    )
    for st, count in status_counts:
        if st in by_status:
            by_status[st] = count

    # Severity distribution (ensure all 4 keys exist even if 0)
    by_severity: dict[str, int] = {
        "Low": 0,
        "Medium": 0,
        "High": 0,
        "Critical": 0,
    }
    severity_counts = (
        db.query(Incident.severity, func.count(Incident.id))
        .group_by(Incident.severity)
        .all()
    )
    for sev, count in severity_counts:
        if sev in by_severity:
            by_severity[sev] = count

    # Category breakdown (ensure all 6 categories are represented)
    all_categories = db.query(Category).order_by(Category.id.asc()).all()
    incident_cat_counts = dict(
        db.query(Incident.category_id, func.count(Incident.id))
        .group_by(Incident.category_id)
        .all()
    )

    by_category: list[DashboardCategoryStat] = []
    for cat in all_categories:
        by_category.append(
            DashboardCategoryStat(
                code=cat.code,
                name=cat.name,
                icon=cat.icon,
                count=incident_cat_counts.get(cat.id, 0),
            )
        )

    # Last 5 unresolved Critical incidents
    recent_critical_rows = (
        db.query(Incident)
        .filter(Incident.severity == "Critical", Incident.status != "Resolved")
        .order_by(Incident.created_at.desc())
        .limit(5)
        .all()
    )
    recent_critical = [
        RecentCriticalIncident.model_validate(inc) for inc in recent_critical_rows
    ]

    return DashboardStatsResponse(
        total=total,
        critical=critical_total,
        critical_active=critical_active,
        pending=pending_total,
        resolved=resolved_total,
        by_status=by_status,
        by_severity=by_severity,
        by_category=by_category,
        recent_critical=recent_critical,
    )
