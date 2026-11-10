from datetime import datetime, timezone
import json

from .corroboration import run_corroboration_pipeline
from .database import SessionLocal
from .geo import calculate_location_mismatch, reverse_geocode
from .llm import evaluate_report_plausibility
from .models import Category, Incident, ReporterReputation
from .trust import compute_trust


def enrich_incident(incident_id: int) -> None:
    """
    Background Task executed asynchronously after incident save:
    1. Geocodes missing location or calculates location mismatch distance.
    2. Runs Gemini LLM Plausibility check (strict 6s timeout).
    3. Re-runs Corroboration Engine with updated coordinates/clusters.
    4. Re-evaluates final trust score and explainability reasons.
    """
    db = SessionLocal()
    try:
        incident = db.query(Incident).filter(Incident.id == incident_id).first()
        if not incident:
            return

        cat = db.query(Category).filter(Category.id == incident.category_id).first()
        cat_name = cat.name if cat else "Other"

        # 1. Geocoding checks
        mismatch_km = incident.location_mismatch_km
        if incident.latitude is not None and incident.longitude is not None:
            # If location text was empty, fill it from reverse geocoding
            if not incident.location or len(incident.location.strip()) == 0:
                address = reverse_geocode(incident.latitude, incident.longitude)
                if address:
                    incident.location = address

            # If both GPS and location text exist, calculate distance mismatch
            if incident.location and len(incident.location.strip()) > 2 and mismatch_km is None:
                mismatch_km = calculate_location_mismatch(
                    incident.latitude, incident.longitude, incident.location
                )
                incident.location_mismatch_km = mismatch_km

        # 2. LLM Plausibility Check
        llm_res = evaluate_report_plausibility(
            category_name=cat_name,
            people_affected=incident.people_affected,
            location=incident.location or "",
            title=incident.title,
            description=incident.description,
        )
        incident.llm_assessment = json.dumps(llm_res)
        incident.llm_checked_at = datetime.now(timezone.utc)

        # 3. Corroboration Engine
        corrob_ids = run_corroboration_pipeline(db, incident)

        # 4. Fetch Reporter Reputation
        past_verified = 0
        past_false_alarms = 0
        if incident.device_hash:
            rep = db.query(ReporterReputation).filter(ReporterReputation.device_hash == incident.device_hash).first()
            if rep:
                past_verified = rep.verified_count
                past_false_alarms = rep.false_alarm_count

        # 5. Recompute Trust Score
        new_trust, trust_reasons = compute_trust(
            phone_given=incident.phone_given,
            location_accuracy_m=incident.location_accuracy_m,
            corroborating_count=len(corrob_ids),
            llm_assessment=llm_res,
            location_mismatch_km=mismatch_km,
            past_verified_count=past_verified,
            past_false_alarm_count=past_false_alarms,
            description_length=len(incident.description or ""),
            is_duplicate=incident.is_duplicate,
            duplicate_ref=f"ER-{incident.duplicate_of:04d}" if incident.duplicate_of else None,
        )

        incident.trust_score = new_trust
        incident.trust_reasons = json.dumps(trust_reasons)
        incident.updated_at = datetime.now(timezone.utc)

        db.commit()
    except Exception as e:
        db.rollback()
    finally:
        db.close()
