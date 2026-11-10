from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from ..auth import require_admin
from ..database import get_db
from ..models import Incident, ResponseTeam, User, utc_now
from ..schemas import (
    VALID_TEAM_AVAILABILITIES,
    VALID_TEAM_CATEGORIES,
    IncidentBrief,
    TeamAvailabilityUpdate,
    TeamCreate,
    TeamOut,
    TeamUpdate,
)

router = APIRouter(prefix="/teams", tags=["Response Teams"])


def _serialize_team(team: ResponseTeam) -> TeamOut:
    """Helper to convert ResponseTeam model to TeamOut with nested incident if busy."""
    brief_inc = None
    if team.current_incident:
        brief_inc = IncidentBrief(
            id=team.current_incident.id,
            ref_code=team.current_incident.ref_code,
            title=team.current_incident.title,
        )
    return TeamOut(
        id=team.id,
        code=team.code,
        name=team.name,
        category=team.category,
        latitude=team.latitude,
        longitude=team.longitude,
        location_label=team.location_label,
        availability=team.availability,
        current_incident_id=team.current_incident_id,
        current_incident=brief_inc,
        updated_at=team.updated_at,
    )


@router.get("", response_model=list[TeamOut])
def list_teams(
    category: Optional[str] = Query(None, description="Filter by category (Fire, Medical, Rescue, Police)"),
    availability: Optional[str] = Query(None, description="Filter by availability (Available, Busy)"),
    db: Session = Depends(get_db),
):
    """List response teams with optional category and availability filters."""
    query = db.query(ResponseTeam)

    if category:
        norm_cat = category.strip().title()
        query = query.filter(ResponseTeam.category == norm_cat)

    if availability:
        norm_avail = availability.strip().title()
        query = query.filter(ResponseTeam.availability == norm_avail)

    teams = query.order_by(ResponseTeam.code.asc()).all()
    return [_serialize_team(t) for t in teams]


@router.get("/{team_id}", response_model=TeamOut)
def get_team(
    team_id: int,
    db: Session = Depends(get_db),
):
    """Retrieve details of a single response team by ID."""
    team = db.query(ResponseTeam).filter(ResponseTeam.id == team_id).first()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Response team with ID {team_id} not found",
        )
    return _serialize_team(team)


@router.post("", response_model=TeamOut, status_code=status.HTTP_201_CREATED)
def create_team(
    payload: TeamCreate,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Create a new emergency response unit (Admin only)."""
    norm_code = payload.code.strip().upper()
    existing = db.query(ResponseTeam).filter(ResponseTeam.code == norm_code).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Response team with code '{norm_code}' already exists",
        )

    team = ResponseTeam(
        code=norm_code,
        name=payload.name.strip(),
        category=payload.category,
        latitude=payload.latitude,
        longitude=payload.longitude,
        location_label=payload.location_label.strip(),
        availability=payload.availability or "Available",
        updated_at=utc_now(),
    )
    db.add(team)
    db.commit()
    db.refresh(team)
    return _serialize_team(team)


@router.put("/{team_id}", response_model=TeamOut)
def update_team(
    team_id: int,
    payload: TeamUpdate,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Update details of an existing response team (Admin only)."""
    team = db.query(ResponseTeam).filter(ResponseTeam.id == team_id).first()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Response team with ID {team_id} not found",
        )

    if payload.code is not None:
        norm_code = payload.code.strip().upper()
        if norm_code != team.code:
            existing = db.query(ResponseTeam).filter(ResponseTeam.code == norm_code).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Response team with code '{norm_code}' already exists",
                )
            team.code = norm_code

    if payload.name is not None:
        team.name = payload.name.strip()
    if payload.category is not None:
        team.category = payload.category
    if payload.latitude is not None:
        team.latitude = payload.latitude
    if payload.longitude is not None:
        team.longitude = payload.longitude
    if payload.location_label is not None:
        team.location_label = payload.location_label.strip()
    if payload.availability is not None:
        team.availability = payload.availability
        if payload.availability == "Available":
            team.current_incident_id = None

    team.updated_at = utc_now()
    db.commit()
    db.refresh(team)
    return _serialize_team(team)


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_team(
    team_id: int,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Delete a response unit (Admin only). Rejects if unit is currently Busy."""
    team = db.query(ResponseTeam).filter(ResponseTeam.id == team_id).first()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Response team with ID {team_id} not found",
        )

    if team.availability == "Busy":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete team '{team.code}' while Busy",
        )

    # Detach any historical references from incidents
    db.query(Incident).filter(Incident.assigned_team_id == team.id).update(
        {Incident.assigned_team_id: None}
    )

    db.delete(team)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/{team_id}/availability", response_model=TeamOut)
def update_team_availability(
    team_id: int,
    payload: TeamAvailabilityUpdate,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Quick manual toggle for team availability status (Available / Busy)."""
    team = db.query(ResponseTeam).filter(ResponseTeam.id == team_id).first()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Response team with ID {team_id} not found",
        )

    team.availability = payload.availability
    if payload.availability == "Available":
        team.current_incident_id = None
    team.updated_at = utc_now()

    db.commit()
    db.refresh(team)
    return _serialize_team(team)

