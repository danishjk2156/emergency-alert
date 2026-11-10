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
from ..models import Category, Incident, IncidentStatusHistory, ReporterReputation, User, utc_now
from ..rate_limit import get_client_hashes, rate_limit_report
from ..schemas import (
    AIAnalysisResponse,
    AIClassifyRequest,
    CategoryNested,
    IncidentCreate,
    IncidentDetailResponse,
    IncidentListResponse,
    IncidentResponse,
    IncidentTrackResponse,
    RelatedIncidentItem,
    RelatedIncidentsResponse,
    SeverityUpdateRequest,
    StatusUpdateRequest,
    VerifyRequest,
)
from ..severity import classify
from ..trust import compute_trust

router = APIRouter(prefix="/incidents", tags=["Incidents"])


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


@router.patch("/{incident_id}/status", response_model=IncidentDetailResponse)
def update_incident_status(
    incident_id: int,
    payload: StatusUpdateRequest,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin status transition endpoint logging audit history."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

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
