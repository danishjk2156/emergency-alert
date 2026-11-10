import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import and_, case, or_
from sqlalchemy.orm import Session

from ..auth import require_admin
from ..database import get_db
from ..models import Category, Incident, IncidentStatusHistory, User, utc_now
from ..schemas import (
    IncidentCreate,
    IncidentDetailResponse,
    IncidentListResponse,
    IncidentResponse,
    IncidentTrackResponse,
    SeverityUpdateRequest,
    StatusUpdateRequest,
)
from ..severity import classify

router = APIRouter(prefix="/incidents", tags=["Incidents"])


@router.post("", response_model=IncidentResponse, status_code=status.HTTP_201_CREATED)
def create_incident(
    payload: IncidentCreate,
    db: Session = Depends(get_db),
):
    """
    Public endpoint: Submit a new emergency report.
    Calculates severity score, level, and explainable reasons, then saves the incident.
    """
    category = db.query(Category).filter(Category.code == payload.category_code).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid category code: {payload.category_code}",
        )

    # Classify severity using rule-based triage engine
    level, score, reasons = classify(
        category_code=payload.category_code,
        people=payload.people_affected,
        title=payload.title,
        description=payload.description,
    )

    now = utc_now()
    incident = Incident(
        title=payload.title.strip(),
        description=payload.description.strip(),
        category_id=category.id,
        location=payload.location.strip(),
        latitude=payload.latitude,
        longitude=payload.longitude,
        people_affected=payload.people_affected,
        contact_name=payload.contact_name.strip() if payload.contact_name else None,
        contact_phone=payload.contact_phone.strip() if payload.contact_phone else None,
        contact_email=payload.contact_email.strip() if payload.contact_email else None,
        severity=level,
        severity_score=score,
        severity_reasons=json.dumps(reasons),
        severity_overridden=False,
        status="Reported",
        is_duplicate=False,
        created_at=now,
        updated_at=now,
        resolved_at=None,
    )

    db.add(incident)
    db.flush()

    # Generate reference code from autoincremented ID
    incident.ref_code = f"ER-2026-{incident.id:04d}"

    # Log initial creation in audit status history
    initial_history = IncidentStatusHistory(
        incident_id=incident.id,
        from_status=None,
        to_status="Reported",
        note="Initial emergency report logged",
        changed_by=None,
        changed_at=now,
    )
    db.add(initial_history)
    db.commit()
    db.refresh(incident)

    return incident


@router.get("/track/{ref_code}", response_model=IncidentTrackResponse)
def track_incident_by_ref_code(
    ref_code: str,
    db: Session = Depends(get_db),
):
    """
    Public endpoint: Track an incident by its reference code (ER-2026-XXXX).
    Returns limited status fields suitable for public view.
    """
    incident = db.query(Incident).filter(Incident.ref_code == ref_code.strip()).first()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )
    return incident


@router.get("", response_model=IncidentListResponse)
def list_incidents(
    status_filter: Optional[str] = Query(None, alias="status"),
    severity_filter: Optional[str] = Query(None, alias="severity"),
    category_filter: Optional[str] = Query(None, alias="category"),
    q: Optional[str] = Query(None),
    sort: str = Query("priority"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Admin endpoint: Search and filter incidents.
    Supports sort='priority' (unresolved Critical first, then score desc, created_at desc),
    'newest', or 'oldest'.
    """
    query = db.query(Incident).join(Category)

    if status_filter:
        query = query.filter(Incident.status == status_filter.strip())

    if severity_filter:
        query = query.filter(Incident.severity == severity_filter.strip())

    if category_filter:
        query = query.filter(Category.code == category_filter.strip().upper())

    if q:
        search_pattern = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Incident.title.ilike(search_pattern),
                Incident.description.ilike(search_pattern),
                Incident.location.ilike(search_pattern),
            )
        )

    # Sorting
    if sort == "priority":
        # Unresolved Critical always appears first
        unresolved_critical_order = case(
            (and_(Incident.status != "Resolved", Incident.severity == "Critical"), 0),
            else_=1,
        )
        query = query.order_by(
            unresolved_critical_order.asc(),
            Incident.severity_score.desc(),
            Incident.created_at.desc(),
        )
    elif sort == "newest":
        query = query.order_by(Incident.created_at.desc())
    elif sort == "oldest":
        query = query.order_by(Incident.created_at.asc())
    else:
        query = query.order_by(Incident.created_at.desc())

    total = query.count()
    items = query.offset(offset).limit(limit).all()

    return IncidentListResponse(items=items, total=total)


@router.get("/{incident_id}", response_model=IncidentDetailResponse)
def get_incident_detail(
    incident_id: int,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Admin endpoint: Retrieve complete incident details including audit status history.
    """
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )
    return incident


@router.patch("/{incident_id}/status", response_model=IncidentDetailResponse)
def update_incident_status(
    incident_id: int,
    payload: StatusUpdateRequest,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Admin endpoint: Update incident status and record audit log entry.
    Sets resolved_at when transitioning to Resolved (clears it if reopened).
    """
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )

    old_status = incident.status
    new_status = payload.status
    now = utc_now()

    incident.status = new_status
    incident.updated_at = now

    if new_status == "Resolved":
        incident.resolved_at = now
    else:
        incident.resolved_at = None

    history_entry = IncidentStatusHistory(
        incident_id=incident.id,
        from_status=old_status,
        to_status=new_status,
        note=payload.note.strip() if payload.note else None,
        changed_by=current_admin.id,
        changed_at=now,
    )
    db.add(history_entry)
    db.commit()
    db.refresh(incident)

    return incident


@router.patch("/{incident_id}/severity", response_model=IncidentResponse)
def override_incident_severity(
    incident_id: int,
    payload: SeverityUpdateRequest,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Admin endpoint: Manually override severity and log reason.
    """
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )

    incident.severity = payload.severity
    incident.severity_overridden = True

    try:
        reasons_list = json.loads(incident.severity_reasons) if incident.severity_reasons else []
    except Exception:
        reasons_list = [incident.severity_reasons] if incident.severity_reasons else []

    reasons_list.append(f"manually set to {payload.severity} by admin")
    incident.severity_reasons = json.dumps(reasons_list)
    incident.updated_at = utc_now()

    db.commit()
    db.refresh(incident)
    return incident


@router.delete("/{incident_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_incident(
    incident_id: int,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Admin endpoint: Delete an incident (removes cascade status history).
    """
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )

    db.delete(incident)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
