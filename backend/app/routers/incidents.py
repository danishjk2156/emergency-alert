from datetime import datetime, timezone
import json
from typing import Optional

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Query,
    Request,
    Response,
    status,
)
from sqlalchemy import and_, case, func, or_
from sqlalchemy.orm import Session

from ..auth import require_admin
from ..corroboration import run_corroboration_pipeline
from ..database import get_db
from ..enrich import enrich_incident
from ..gemini_triage import classify_with_gemini
from ..geo import haversine_distance_km
from ..models import Category, Incident, IncidentStatusHistory, ReporterReputation, ResponseTeam, User, utc_now
from ..rate_limit import get_client_hashes, rate_limit_report
from ..schemas import (
    AIAnalysisResponse,
    AIClassifyRequest,
    AssignTeamRequest,
    CategoryNested,
    IncidentCreate,
    IncidentDetailResponse,
    IncidentListResponse,
    IncidentResponse,
    IncidentTrackResponse,
    PrioritizedIncidentResponse,
    RelatedIncidentItem,
    RelatedIncidentsResponse,
    SeverityUpdateRequest,
    StatusUpdateRequest,
    TeamWithDistance,
    VerifyRequest,
)
from ..services.priority import compute_priority
from ..severity import classify
from ..trust import compute_trust

router = APIRouter(prefix="/incidents", tags=["Incidents"])

CATEGORY_TO_TEAM_MAPPING = {
    "FIRE": ["Fire"],
    "MEDICAL": ["Medical"],
    "COLLAPSE": ["Rescue", "Fire"],
    "FLOOD": ["Rescue"],
    "ROAD": ["Medical", "Rescue", "Police"],
    "OTHER": ["Fire", "Medical", "Rescue", "Police"],
}


@router.post("/ai-classify", response_model=AIAnalysisResponse)
def ai_classify_incident(payload: AIClassifyRequest):
    """
    Jury Showcase Endpoint:
    Live emergency incident classification using Google Gemini 3.5 Flash Lite!
    """
    return classify_with_gemini(
        category_code=payload.category_code,
        people=payload.people_affected,
        title=payload.title,
        description=payload.description,
    )


@router.post(
    "",
    response_model=IncidentResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit_report)],
)
def create_incident(
    payload: IncidentCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Public emergency reporting endpoint:
    - Protected by sliding-window rate limiting & honeypot.
    - Synchronous deterministic severity & initial trust scoring.
    - Synchronous corroboration detection.
    - Queues background asynchronous enrichment (geocoding + LLM plausibility).
    """
    # 1. Anti-bot honeypot check: If website field is populated, return dummy 201 without storing
    if payload.website and payload.website.strip():
        fake_time = utc_now()
        return IncidentResponse(
            id=9999,
            ref_code="ER-2026-9999",
            title=payload.title,
            description=payload.description,
            category=CategoryNested(code=payload.category_code, name="Reported", icon="⚠️"),
            location=payload.location,
            people_affected=payload.people_affected,
            severity="Low",
            severity_score=10,
            severity_reasons=["Standard intake"],
            severity_overridden=False,
            status="Reported",
            is_duplicate=False,
            trust_score=10,
            trust_reasons=["Honeypot trigger"],
            verification_status="Suspicious",
            created_at=fake_time,
            updated_at=fake_time,
        )

    category = db.query(Category).filter(Category.code == payload.category_code).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid category code: {payload.category_code}",
        )

    # 2. Hash device ID and client IP with TRUST_SALT
    device_hash, ip_hash = get_client_hashes(request)

    # Track reputation count
    rep = db.query(ReporterReputation).filter(ReporterReputation.device_hash == device_hash).first()
    if not rep:
        rep = ReporterReputation(device_hash=device_hash, total_reports=1)
        db.add(rep)
    else:
        rep.total_reports += 1
        rep.last_report_at = utc_now()
    db.flush()

    # 3. Deterministic Severity Classification (Synchronous guarantee < 1ms)
    level, score, reasons = classify(
        category_code=payload.category_code,
        people=payload.people_affected,
        title=payload.title,
        description=payload.description,
    )

    # 4. Synchronous Initial Trust Score (prior to background LLM check)
    phone_present = bool(payload.contact_phone and payload.contact_phone.strip())
    initial_trust, initial_reasons = compute_trust(
        phone_given=phone_present,
        location_accuracy_m=payload.location_accuracy_m,
        description_length=len(payload.description or ""),
        past_verified_count=rep.verified_count if rep else 0,
        past_false_alarm_count=rep.false_alarm_count if rep else 0,
    )

    now = utc_now()
    incident = Incident(
        title=payload.title.strip(),
        description=payload.description.strip(),
        category_id=category.id,
        location=payload.location.strip() if payload.location else "",
        latitude=payload.latitude,
        longitude=payload.longitude,
        location_accuracy_m=payload.location_accuracy_m,
        location_source=payload.location_source or "manual",
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
        trust_score=initial_trust,
        trust_reasons=json.dumps(initial_reasons),
        verification_status="Unverified",
        device_hash=device_hash,
        ip_hash=ip_hash,
        phone_given=phone_present,
        cluster_size=1,
        cluster_people_affected=payload.people_affected,
        created_at=now,
        updated_at=now,
    )

    db.add(incident)
    db.flush()

    incident.ref_code = f"ER-2026-{incident.id:04d}"
    incident.cluster_id = incident.id

    # 5. Synchronous Corroboration Engine (< 50ms)
    corrob_ids = run_corroboration_pipeline(db, incident)
    if corrob_ids:
        # Re-evaluate trust with corroboration count
        new_trust, updated_trust_reasons = compute_trust(
            phone_given=phone_present,
            location_accuracy_m=payload.location_accuracy_m,
            corroborating_count=len(corrob_ids),
            description_length=len(payload.description or ""),
            past_verified_count=rep.verified_count if rep else 0,
            past_false_alarm_count=rep.false_alarm_count if rep else 0,
        )
        incident.trust_score = new_trust
        incident.trust_reasons = json.dumps(updated_trust_reasons)

    # 6. Initial Audit Log
    audit_row = IncidentStatusHistory(
        incident_id=incident.id,
        from_status=None,
        to_status="Reported",
        note="Initial emergency report registered",
        changed_by=None,
        changed_at=now,
    )
    db.add(audit_row)
    db.commit()
    db.refresh(incident)

    # 7. Asynchronously Queue Background Enrichment Task (Nominatim geocoding + Gemini LLM)
    background_tasks.add_task(enrich_incident, incident.id)

    resp = IncidentResponse.model_validate(incident)
    resp.verification = "in_progress"
    resp.corroborating_ids = corrob_ids
    return resp


@router.get("/track/{ref_code}", response_model=IncidentTrackResponse)
def track_incident_by_ref_code(
    ref_code: str,
    db: Session = Depends(get_db),
):
    """Public tracking endpoint using ER-2026-XXXX reference code."""
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
    verification_status: Optional[str] = Query(None),
    min_trust: Optional[int] = Query(None, ge=0, le=100),
    max_trust: Optional[int] = Query(None, ge=0, le=100),
    group: Optional[str] = Query(None),  # "cluster"
    q: Optional[str] = Query(None),
    sort: str = Query("priority"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Admin query endpoint with Trust Layer filters, cluster grouping, and priority sorting.
    Priority formula: Active Criticals first, then severity_score * (0.5 + trust_score/200) desc.
    """
    query = db.query(Incident).join(Category)

    if status_filter:
        query = query.filter(Incident.status == status_filter.strip())

    if severity_filter:
        query = query.filter(Incident.severity == severity_filter.strip())

    if category_filter:
        query = query.filter(Category.code == category_filter.strip().upper())

    if verification_status:
        query = query.filter(Incident.verification_status == verification_status.strip().title())

    if min_trust is not None:
        query = query.filter(Incident.trust_score >= min_trust)

    if max_trust is not None:
        query = query.filter(Incident.trust_score <= max_trust)

    # Cluster grouping: only return cluster roots (earliest incident)
    if group == "cluster":
        query = query.filter(
            or_(
                Incident.cluster_id == Incident.id,
                Incident.cluster_id == None,
            )
        )

    if q:
        search_pattern = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Incident.title.ilike(search_pattern),
                Incident.description.ilike(search_pattern),
                Incident.location.ilike(search_pattern),
            )
        )

    # Priority Sorting
    if sort == "priority":
        # Unresolved Critical always top, weighted by trust factor (0.5 + trust/200)
        unresolved_critical = case(
            (
                and_(
                    Incident.status != "Resolved",
                    Incident.status != "False Alarm",
                    Incident.severity == "Critical",
                ),
                0,
            ),
            else_=1,
        )
        trust_weighted_score = Incident.severity_score * (0.5 + Incident.trust_score / 200.0)
        query = query.order_by(
            unresolved_critical.asc(),
            trust_weighted_score.desc(),
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

    # Populate cluster member IDs for each item
    responses = []
    for inc in items:
        resp = IncidentResponse.model_validate(inc)
        if inc.cluster_id:
            corrob_ids = [
                cid[0]
                for cid in db.query(Incident.id)
                .filter(
                    Incident.cluster_id == inc.cluster_id,
                    Incident.id != inc.id,
                    Incident.is_duplicate == False,
                )
                .all()
            ]
            dup_ids = [
                did[0]
                for did in db.query(Incident.id)
                .filter(Incident.duplicate_of == inc.id)
                .all()
            ]
            resp.corroborating_ids = corrob_ids
            resp.duplicate_ids = dup_ids
        responses.append(resp)

    return IncidentListResponse(items=responses, total=total)


@router.get("/prioritized", response_model=list[PrioritizedIncidentResponse])
def get_prioritized_incidents(
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Priority ranking endpoint:
    Returns all active emergencies (excluding duplicates, Resolved, False Alarm)
    ranked live using the multi-factor explainable Priority Engine.
    """
    active_incidents = (
        db.query(Incident)
        .filter(
            Incident.is_duplicate == False,
            Incident.status.notin_(["Resolved", "False Alarm"]),
        )
        .all()
    )

    scored_items = []
    for inc in active_incidents:
        p_res = compute_priority(inc, inc.category)
        scored_items.append((inc, p_res))

    # Sort descending by priority score
    scored_items.sort(key=lambda x: x[1]["score"], reverse=True)

    results = []
    for rank_idx, (inc, p_res) in enumerate(scored_items, start=1):
        resp = IncidentResponse.model_validate(inc)
        p_obj = PrioritizedIncidentResponse(
            **resp.model_dump(),
            priority_score=p_res["score"],
            priority_label=p_res["label"],
            priority_breakdown=p_res["breakdown"],
            rank=rank_idx,
        )
        results.append(p_obj)

    return results


@router.get("/{incident_id}", response_model=IncidentDetailResponse)
def get_incident_detail(
    incident_id: int,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Retrieve full incident details including audit history and cluster IDs."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )

    resp = IncidentDetailResponse.model_validate(incident)
    if incident.cluster_id:
        resp.corroborating_ids = [
            cid[0]
            for cid in db.query(Incident.id)
            .filter(
                Incident.cluster_id == incident.cluster_id,
                Incident.id != incident.id,
                Incident.is_duplicate == False,
            )
            .all()
        ]
        resp.duplicate_ids = [
            did[0]
            for did in db.query(Incident.id)
            .filter(Incident.duplicate_of == incident.id)
            .all()
        ]
    return resp


@router.get("/{incident_id}/related", response_model=RelatedIncidentsResponse)
def get_related_incidents(
    incident_id: int,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Retrieve corroborating and duplicate incidents for a given incident."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    corroborating_items = []
    duplicate_items = []

    # Find members belonging to the same cluster
    if incident.cluster_id:
        cluster_members = (
            db.query(Incident)
            .filter(
                Incident.cluster_id == incident.cluster_id,
                Incident.id != incident.id,
            )
            .all()
        )

        for other in cluster_members:
            dist_m = None
            if (
                incident.latitude is not None
                and incident.longitude is not None
                and other.latitude is not None
                and other.longitude is not None
            ):
                dist_m = round(
                    haversine_distance_km(
                        incident.latitude, incident.longitude, other.latitude, other.longitude
                    )
                    * 1000.0,
                    1,
                )

            minutes = int(abs((incident.created_at - other.created_at).total_seconds()) / 60)

            item = RelatedIncidentItem(
                id=other.id,
                ref_code=other.ref_code,
                title=other.title,
                location=other.location,
                distance_m=dist_m,
                minutes_apart=minutes,
                verification_status=other.verification_status,
                is_duplicate=other.is_duplicate,
            )

            if other.is_duplicate or other.duplicate_of == incident.id:
                duplicate_items.append(item)
            else:
                corroborating_items.append(item)

    return RelatedIncidentsResponse(
        corroborating=corroborating_items,
        duplicates=duplicate_items,
    )


@router.get("/{incident_id}/nearest-teams", response_model=list[TeamWithDistance])
def get_nearest_teams(
    incident_id: int,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Calculate and return available suitable response teams sorted by distance (km) and ETA.
    """
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    if incident.latitude is None or incident.longitude is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incident does not have latitude/longitude coordinates",
        )

    cat_code = incident.category.code.upper() if incident.category else "OTHER"
    suitable_cats = CATEGORY_TO_TEAM_MAPPING.get(cat_code, ["Fire", "Medical", "Rescue", "Police"])

    available_teams = (
        db.query(ResponseTeam)
        .filter(
            ResponseTeam.availability == "Available",
            ResponseTeam.category.in_(suitable_cats),
        )
        .all()
    )

    results = []
    for team in available_teams:
        dist_km = round(
            haversine_distance_km(
                incident.latitude,
                incident.longitude,
                team.latitude,
                team.longitude,
            ),
            2,
        )
        # Dispatch speed 40 km/h: (distance / 40) * 60 minutes
        eta_min = max(1, int(round((dist_km / 40.0) * 60.0)))
        results.append(
            TeamWithDistance(
                id=team.id,
                code=team.code,
                name=team.name,
                category=team.category,
                latitude=team.latitude,
                longitude=team.longitude,
                location_label=team.location_label,
                availability=team.availability,
                current_incident_id=team.current_incident_id,
                current_incident=None,
                updated_at=team.updated_at,
                distance_km=dist_km,
                eta_minutes=eta_min,
            )
        )

    results.sort(key=lambda t: t.distance_km)
    return results


@router.post("/{incident_id}/assign", response_model=IncidentDetailResponse)
def assign_team_to_incident(
    incident_id: int,
    payload: AssignTeamRequest = AssignTeamRequest(),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Assign a response unit to an incident in a single atomic transaction.
    If team_id is omitted, automatically assigns the nearest suitable available unit.
    """
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    if incident.status != "Reported":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot assign team: incident status is '{incident.status}', expected 'Reported'",
        )

    team: Optional[ResponseTeam] = None
    if payload.team_id is not None:
        team = db.query(ResponseTeam).filter(ResponseTeam.id == payload.team_id).first()
        if not team:
            raise HTTPException(status_code=404, detail=f"Response team with ID {payload.team_id} not found")
        if team.availability != "Available":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Team '{team.name}' ({team.code}) is already Busy",
            )
    else:
        if incident.latitude is None or incident.longitude is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Incident lacks coordinates for auto-assignment. Provide team_id explicitly.",
            )

        cat_code = incident.category.code.upper() if incident.category else "OTHER"
        suitable_cats = CATEGORY_TO_TEAM_MAPPING.get(cat_code, ["Fire", "Medical", "Rescue", "Police"])

        available_teams = (
            db.query(ResponseTeam)
            .filter(
                ResponseTeam.availability == "Available",
                ResponseTeam.category.in_(suitable_cats),
            )
            .all()
        )
        if not available_teams:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"No available teams found for category '{cat_code}'",
            )

        available_teams.sort(
            key=lambda t: haversine_distance_km(
                incident.latitude, incident.longitude, t.latitude, t.longitude
            )
        )
        team = available_teams[0]

    dist_km = None
    eta_min = None
    if (
        incident.latitude is not None
        and incident.longitude is not None
        and team.latitude is not None
        and team.longitude is not None
    ):
        dist_km = round(
            haversine_distance_km(
                incident.latitude, incident.longitude, team.latitude, team.longitude
            ),
            2,
        )
        eta_min = max(1, int(round((dist_km / 40.0) * 60.0)))

    now = utc_now()

    incident.status = "Assigned"
    incident.assigned_team_id = team.id
    incident.assigned_at = now
    incident.assignment_distance_km = dist_km
    incident.eta_minutes = eta_min
    incident.updated_at = now

    team.availability = "Busy"
    team.current_incident_id = incident.id
    team.updated_at = now

    history_entry = IncidentStatusHistory(
        incident_id=incident.id,
        from_status="Reported",
        to_status="Assigned",
        note=f"Assigned to {team.code} ({team.name})",
        changed_by=current_admin.id,
        changed_at=now,
    )
    db.add(history_entry)
    db.commit()
    db.refresh(incident)

    return incident


@router.post("/{incident_id}/unassign", response_model=IncidentDetailResponse)
def unassign_team_from_incident(
    incident_id: int,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Unassign the response team: frees the unit and transitions incident back to Reported.
    """
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    team = incident.assigned_team
    team_code = team.code if team else None

    now = utc_now()
    if team:
        team.availability = "Available"
        team.current_incident_id = None
        team.updated_at = now

    from_st = incident.status
    incident.status = "Reported"
    incident.assigned_team_id = None
    incident.assigned_at = None
    incident.assignment_distance_km = None
    incident.eta_minutes = None
    incident.updated_at = now

    history_entry = IncidentStatusHistory(
        incident_id=incident.id,
        from_status=from_st,
        to_status="Reported",
        note=f"Unassigned from {team_code}" if team_code else "Unassigned from team",
        changed_by=current_admin.id,
        changed_at=now,
    )
    db.add(history_entry)
    db.commit()
    db.refresh(incident)

    return incident


@router.patch("/{incident_id}/status", response_model=IncidentDetailResponse)
def update_incident_status(
    incident_id: int,
    payload: StatusUpdateRequest,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Admin status transition endpoint logging audit history.
    Enforces valid lifecycle transitions: Reported -> Assigned -> In Progress -> Resolved.
    False Alarm is allowed from any non-terminal status.
    Frees assigned team on Resolved or False Alarm.
    """
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    old_status = incident.status
    new_status = payload.status
    now = utc_now()

    ALLOWED_TRANSITIONS = {
        "Reported": {"Assigned", "False Alarm"},
        "Assigned": {"In Progress", "False Alarm"},
        "In Progress": {"Resolved", "False Alarm"},
        "Resolved": set(),
        "False Alarm": set(),
        "Pending": {"Reported", "Assigned", "In Progress", "Resolved", "False Alarm"},
    }

    if old_status == new_status:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Incident is already in '{new_status}' status",
        )

    allowed_targets = ALLOWED_TRANSITIONS.get(old_status, set())
    if new_status not in allowed_targets:
        allowed_str = ", ".join(sorted(allowed_targets)) if allowed_targets else "None (terminal state)"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status transition from '{old_status}' to '{new_status}'. Allowed transitions: {allowed_str}",
        )

    incident.status = new_status
    incident.updated_at = now

    if new_status in ("Resolved", "False Alarm"):
        incident.resolved_at = now
        # Free the assigned team so they are ready for other emergencies
        if incident.assigned_team:
            incident.assigned_team.availability = "Available"
            incident.assigned_team.current_incident_id = None
            incident.assigned_team.updated_at = now
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


@router.patch("/{incident_id}/verify", response_model=IncidentDetailResponse)
def verify_incident(
    incident_id: int,
    payload: VerifyRequest,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Admin verification endpoint:
    Mark as 'Verified' or 'False Alarm'.
    Updates reporter reputation and re-evaluates cluster corroboration.
    """
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    old_status = incident.status
    new_verif = payload.verification_status
    now = utc_now()

    incident.verification_status = new_verif
    incident.updated_at = now

    # Update reporter reputation
    if incident.device_hash:
        rep = db.query(ReporterReputation).filter(ReporterReputation.device_hash == incident.device_hash).first()
        if not rep:
            rep = ReporterReputation(device_hash=incident.device_hash)
            db.add(rep)

        if new_verif == "Verified":
            rep.verified_count = (rep.verified_count or 0) + 1
            incident.trust_score = min(100, incident.trust_score + 20)
        elif new_verif == "False Alarm":
            rep.false_alarm_count = (rep.false_alarm_count or 0) + 1
            incident.status = "False Alarm"
            incident.trust_score = max(0, incident.trust_score - 40)

    # Log in status history
    note_text = payload.note or f"Verification marked as {new_verif} by admin"
    history_entry = IncidentStatusHistory(
        incident_id=incident.id,
        from_status=old_status,
        to_status=incident.status,
        note=note_text,
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
    """Admin endpoint to manually override severity."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

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
    """Admin endpoint to delete an incident (cascades to history)."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    db.delete(incident)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
