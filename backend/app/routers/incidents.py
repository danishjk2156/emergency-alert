from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from ..auth import get_current_user
from ..database import get_db
from ..models import (
    Incident,
    IncidentCategory,
    IncidentSeverity,
    IncidentStatus,
    IncidentUpdate as IncidentUpdateModel,
    User,
    UserRole,
)
from ..schemas import (
    IncidentCreate,
    IncidentDetailResponse,
    IncidentListResponse,
    IncidentResponse,
    IncidentUpdateCreate,
    IncidentUpdateResponse,
    IncidentUpdateSchema,
)

router = APIRouter(prefix="/incidents", tags=["Incidents"])


@router.post("/", response_model=IncidentResponse, status_code=status.HTTP_201_CREATED)
def create_incident(
    incident_data: IncidentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new incident report."""
    incident = Incident(
        title=incident_data.title,
        description=incident_data.description,
        category=incident_data.category,
        severity=incident_data.severity,
        latitude=incident_data.latitude,
        longitude=incident_data.longitude,
        address=incident_data.address,
        reporter_id=current_user.id,
        media_urls=incident_data.media_urls or [],
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)

    # Eager-load relationships for the response
    incident = (
        db.query(Incident)
        .options(joinedload(Incident.reporter), joinedload(Incident.assigned_to))
        .filter(Incident.id == incident.id)
        .first()
    )
    return incident


@router.get("/", response_model=IncidentListResponse)
def list_incidents(
    status_filter: Optional[IncidentStatus] = Query(None, alias="status"),
    severity: Optional[IncidentSeverity] = None,
    category: Optional[IncidentCategory] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """List incidents with optional filters and pagination."""
    query = db.query(Incident).options(
        joinedload(Incident.reporter), joinedload(Incident.assigned_to)
    )

    if status_filter:
        query = query.filter(Incident.status == status_filter)
    if severity:
        query = query.filter(Incident.severity == severity)
    if category:
        query = query.filter(Incident.category == category)

    total = query.count()
    incidents = (
        query.order_by(Incident.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return IncidentListResponse(
        incidents=incidents,
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/{incident_id}", response_model=IncidentDetailResponse)
def get_incident(incident_id: int, db: Session = Depends(get_db)):
    """Get incident detail with its updates timeline."""
    incident = (
        db.query(Incident)
        .options(
            joinedload(Incident.reporter),
            joinedload(Incident.assigned_to),
            joinedload(Incident.updates).joinedload(IncidentUpdateModel.user),
        )
        .filter(Incident.id == incident_id)
        .first()
    )
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )
    return incident


@router.put("/{incident_id}", response_model=IncidentResponse)
def update_incident(
    incident_id: int,
    update_data: IncidentUpdateSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an incident (status change, assign responder, etc.)."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )

    update_dict = update_data.model_dump(exclude_unset=True)

    # Handle status change to RESOLVED — set resolved_at timestamp
    if "status" in update_dict:
        new_status = update_dict["status"]
        if new_status == IncidentStatus.RESOLVED and incident.status != IncidentStatus.RESOLVED:
            incident.resolved_at = datetime.now(timezone.utc)
        elif new_status != IncidentStatus.RESOLVED:
            incident.resolved_at = None

    # Validate assigned_to_id if provided
    if "assigned_to_id" in update_dict and update_dict["assigned_to_id"] is not None:
        assignee = db.query(User).filter(User.id == update_dict["assigned_to_id"]).first()
        if not assignee:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assigned user not found",
            )

    for key, value in update_dict.items():
        setattr(incident, key, value)

    db.commit()
    db.refresh(incident)

    incident = (
        db.query(Incident)
        .options(joinedload(Incident.reporter), joinedload(Incident.assigned_to))
        .filter(Incident.id == incident_id)
        .first()
    )
    return incident


@router.post("/{incident_id}/updates", response_model=IncidentUpdateResponse, status_code=status.HTTP_201_CREATED)
def add_incident_update(
    incident_id: int,
    update_data: IncidentUpdateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add an update/comment to an incident's timeline."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )

    # If status_change is provided, also update the incident status
    if update_data.status_change:
        try:
            new_status = IncidentStatus(update_data.status_change)
            if new_status == IncidentStatus.RESOLVED and incident.status != IncidentStatus.RESOLVED:
                incident.resolved_at = datetime.now(timezone.utc)
            incident.status = new_status
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {update_data.status_change}",
            )

    update = IncidentUpdateModel(
        incident_id=incident_id,
        user_id=current_user.id,
        message=update_data.message,
        status_change=update_data.status_change,
    )
    db.add(update)
    db.commit()
    db.refresh(update)

    # Eager-load user for the response
    update = (
        db.query(IncidentUpdateModel)
        .options(joinedload(IncidentUpdateModel.user))
        .filter(IncidentUpdateModel.id == update.id)
        .first()
    )
    return update


@router.delete("/{incident_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_incident(
    incident_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an incident (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete incidents",
        )

    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )

    db.delete(incident)
    db.commit()
    return None
