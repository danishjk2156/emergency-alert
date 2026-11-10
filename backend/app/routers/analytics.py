from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import require_admin
from ..database import get_db
from ..models import Category, Incident, ResponseTeam, User
from ..schemas import (
    AnalyticsSummaryResponse,
    CategoryCount,
    DailyCount,
    StatusCount,
)

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/summary", response_model=AnalyticsSummaryResponse)
def get_analytics_summary(
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Retrieve comprehensive dashboard analytics and high-level KPIs:
    - Incident metrics (total, active critical, assigned, resolved, excluding duplicates)
    - Response team resource availability (available vs busy)
    - Categorical breakdown and status breakdown
    - 7-day incident timeline trend
    """
    # Base filter excluding duplicates
    base_inc = db.query(Incident).filter(Incident.is_duplicate == False)

    total_incidents = base_inc.count()

    critical_incidents = base_inc.filter(
        Incident.severity == "Critical",
        Incident.status.notin_(["Resolved", "False Alarm"]),
    ).count()

    available_teams = (
        db.query(ResponseTeam).filter(ResponseTeam.availability == "Available").count()
    )
    busy_teams = (
        db.query(ResponseTeam).filter(ResponseTeam.availability == "Busy").count()
    )

    assigned_incidents = base_inc.filter(
        Incident.status.in_(["Assigned", "In Progress"])
    ).count()

    resolved_incidents = base_inc.filter(Incident.status == "Resolved").count()

    # Breakdown by category
    categories = db.query(Category).order_by(Category.id.asc()).all()
    cat_counts_query = (
        db.query(Incident.category_id, func.count(Incident.id))
        .filter(Incident.is_duplicate == False)
        .group_by(Incident.category_id)
        .all()
    )
    cat_counts_dict = {cat_id: count for cat_id, count in cat_counts_query}

    by_category = [
        CategoryCount(
            code=c.code,
            name=c.name,
            count=cat_counts_dict.get(c.id, 0),
        )
        for c in categories
    ]

    # Breakdown by status
    status_counts_query = (
        db.query(Incident.status, func.count(Incident.id))
        .filter(Incident.is_duplicate == False)
        .group_by(Incident.status)
        .all()
    )
    status_counts_dict = {st: count for st, count in status_counts_query}

    standard_statuses = ["Reported", "Assigned", "In Progress", "Resolved", "False Alarm"]
    by_status = [
        StatusCount(status=st, count=status_counts_dict.get(st, 0))
        for st in standard_statuses
    ]
    # Include any custom/legacy status that might exist in DB
    for st, count in status_counts_dict.items():
        if st not in standard_statuses:
            by_status.append(StatusCount(status=st, count=count))

    # Incidents over time (last 7 calendar days up to today)
    now = datetime.now(timezone.utc)
    today = now.date()
    days = [today - timedelta(days=i) for i in range(6, -1, -1)]

    start_datetime = datetime.combine(days[0], datetime.min.time()).replace(
        tzinfo=timezone.utc
    )
    recent_incidents = (
        db.query(Incident.created_at)
        .filter(
            Incident.is_duplicate == False,
            Incident.created_at >= start_datetime,
        )
        .all()
    )

    day_counts: dict[str, int] = {d.isoformat(): 0 for d in days}
    for (created_at,) in recent_incidents:
        if created_at is not None:
            # Handle tz-aware or tz-naive
            c_date = created_at.date() if hasattr(created_at, "date") else created_at
            d_key = c_date.isoformat()
            if d_key in day_counts:
                day_counts[d_key] += 1

    incidents_over_time = [
        DailyCount(date=d_key, count=day_counts[d_key])
        for d_key in sorted(day_counts.keys())
    ]

    return AnalyticsSummaryResponse(
        total_incidents=total_incidents,
        critical_incidents=critical_incidents,
        available_teams=available_teams,
        busy_teams=busy_teams,
        assigned_incidents=assigned_incidents,
        resolved_incidents=resolved_incidents,
        by_category=by_category,
        by_status=by_status,
        incidents_over_time=incidents_over_time,
    )

