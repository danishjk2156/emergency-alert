from datetime import datetime, timedelta, timezone
import hashlib
import json
from sqlalchemy.orm import Session

from .auth import hash_password
from .models import Category, Incident, IncidentStatusHistory, ReporterReputation, User
from .rate_limit import hash_identifier
from .severity import classify
from .trust import compute_trust

CATEGORIES_SEED_DATA = [
    {"code": "FIRE", "name": "Fire Emergency", "icon": "🔥", "base_weight": 30},
    {"code": "ROAD", "name": "Road Accident", "icon": "🚗", "base_weight": 20},
    {"code": "MEDICAL", "name": "Medical Emergency", "icon": "❤️", "base_weight": 20},
    {"code": "FLOOD", "name": "Flood", "icon": "🌊", "base_weight": 25},
    {"code": "COLLAPSE", "name": "Building Collapse", "icon": "🏢", "base_weight": 35},
    {"code": "OTHER", "name": "Other Emergencies", "icon": "⚠️", "base_weight": 10},
]


def seed_database(db: Session) -> None:
    """Seed initial categories, admin user, and demo incidents including Corroborated clusters and Suspicious reports."""
    # 1. Categories
    category_map: dict[str, Category] = {}
    for cat_data in CATEGORIES_SEED_DATA:
        existing_cat = db.query(Category).filter(Category.code == cat_data["code"]).first()
        if not existing_cat:
            cat = Category(**cat_data)
            db.add(cat)
            db.flush()
            category_map[cat.code] = cat
        else:
            category_map[existing_cat.code] = existing_cat

    # 2. Admin User
    admin_email = "admin@codeclash.dev"
    admin_user = db.query(User).filter(User.email == admin_email).first()
    if not admin_user:
        admin_user = User(
            name="Admin User",
            email=admin_email,
            password_hash=hash_password("admin123"),
            role="admin",
            created_at=datetime.now(timezone.utc),
        )
        db.add(admin_user)
        db.flush()

    db.commit()

    # 3. Check if incidents already exist
    if db.query(Incident).count() > 0:
        return

    now = datetime.now(timezone.utc)
    flood_cat = category_map["FLOOD"]
    fire_cat = category_map["FIRE"]
    collapse_cat = category_map["COLLAPSE"]
    road_cat = category_map["ROAD"]
    medical_cat = category_map["MEDICAL"]
    other_cat = category_map["OTHER"]

    # =======================================================================
    # CLUSTER 1: 3 Corroborating FLOOD Reports in Velachery (within 300m & 20 min)
    # =======================================================================
    dev_hash_a = hash_identifier("device_velachery_1")
    dev_hash_b = hash_identifier("device_velachery_2")
    dev_hash_c = hash_identifier("device_velachery_3")
    ip_hash_a = hash_identifier("192.168.1.10")
    ip_hash_b = hash_identifier("192.168.1.20")
    ip_hash_c = hash_identifier("192.168.1.30")

    # Member 1 (Cluster Root)
    f1_time = now - timedelta(minutes=25)
    f1_lvl, f1_score, f1_reasons = classify("FLOOD", 25, "Lake breach flooding residential colony", "Water rising rapidly inside ground floor homes, elderly stuck")
    f1_trust, f1_tr_reasons = compute_trust(phone_given=True, location_accuracy_m=35.0, corroborating_count=2, description_length=75)

    flood_root = Incident(
        title="Lake breach flooding residential colony",
        description="Water rising rapidly inside ground floor homes, elderly stuck",
        category_id=flood_cat.id,
        location="Ram Nagar 6th Street, Velachery, Chennai",
        latitude=12.9815,
        longitude=80.2180,
        location_accuracy_m=35.0,
        location_source="gps",
        people_affected=25,
        contact_name="Senthil Nathan",
        contact_phone="9842345678",
        severity=f1_lvl,
        severity_score=f1_score,
        severity_reasons=json.dumps(f1_reasons + ["escalated from cluster of 3 reports", "multiple witnesses"]),
        status="In Progress",
        trust_score=f1_trust,
        trust_reasons=json.dumps(f1_tr_reasons),
        verification_status="Corroborated",
        device_hash=dev_hash_a,
        ip_hash=ip_hash_a,
        phone_given=True,
        cluster_size=3,
        cluster_people_affected=30,
        created_at=f1_time,
        updated_at=f1_time,
    )
    db.add(flood_root)
    db.flush()
    flood_root.ref_code = f"ER-2026-{flood_root.id:04d}"
    flood_root.cluster_id = flood_root.id

    # Member 2 (180m away, 8 min later, 30 people)
    f2_time = now - timedelta(minutes=17)
    f2_lvl, f2_score, f2_reasons = classify("FLOOD", 30, "Severe street waterlogging near Ram Nagar park", "Entire residential street inundated, 30 people affected with rising water")
    f2_trust, f2_tr_reasons = compute_trust(phone_given=True, location_accuracy_m=50.0, corroborating_count=2, description_length=70)

    flood_m2 = Incident(
        title="Severe street waterlogging near Ram Nagar park",
        description="Entire residential street inundated, 30 people affected with rising water",
        category_id=flood_cat.id,
        location="Ram Nagar Main Road, Velachery, Chennai",
        latitude=12.9825,
        longitude=80.2192,
        location_accuracy_m=50.0,
        location_source="gps",
        people_affected=30,
        contact_name="Ganesh V",
        contact_phone="9842112233",
        severity=f2_lvl,
        severity_score=f2_score,
        severity_reasons=json.dumps(f2_reasons),
        status="In Progress",
        trust_score=f2_trust,
        trust_reasons=json.dumps(f2_tr_reasons),
        verification_status="Corroborated",
        device_hash=dev_hash_b,
        ip_hash=ip_hash_b,
        phone_given=True,
        cluster_id=flood_root.id,
        cluster_size=3,
        cluster_people_affected=30,
        created_at=f2_time,
        updated_at=f2_time,
    )
    db.add(flood_m2)
    db.flush()
    flood_m2.ref_code = f"ER-2026-{flood_m2.id:04d}"

    # Member 3 (240m away, 14 min later, 20 people)
    f3_time = now - timedelta(minutes=11)
    f3_lvl, f3_score, f3_reasons = classify("FLOOD", 20, "Water level reaching waist height in residential apartments", "Cars submerged, water rising continuously from overflowing drain")
    f3_trust, f3_tr_reasons = compute_trust(phone_given=False, location_accuracy_m=65.0, corroborating_count=2, description_length=68)

    flood_m3 = Incident(
        title="Water level reaching waist height in residential apartments",
        description="Cars submerged, water rising continuously from overflowing drain",
        category_id=flood_cat.id,
        location="Ram Nagar 4th Cross, Velachery, Chennai",
        latitude=12.9808,
        longitude=80.2173,
        location_accuracy_m=65.0,
        location_source="gps",
        people_affected=20,
        contact_name=None,
        contact_phone=None,
        severity=f3_lvl,
        severity_score=f3_score,
        severity_reasons=json.dumps(f3_reasons),
        status="In Progress",
        trust_score=f3_trust,
        trust_reasons=json.dumps(f3_tr_reasons),
        verification_status="Corroborated",
        device_hash=dev_hash_c,
        ip_hash=ip_hash_c,
        phone_given=False,
        cluster_id=flood_root.id,
        cluster_size=3,
        cluster_people_affected=30,
        created_at=f3_time,
        updated_at=f3_time,
    )
    db.add(flood_m3)
    db.flush()
    flood_m3.ref_code = f"ER-2026-{flood_m3.id:04d}"

    # =======================================================================
    # DUPLICATE REPORT: Same device as Member 1, near-identical text
    # =======================================================================
    dup_time = now - timedelta(minutes=14)
    dup_trust, dup_tr_reasons = compute_trust(
        phone_given=True,
        is_duplicate=True,
        duplicate_ref=flood_root.ref_code,
        description_length=65,
    )
    flood_dup = Incident(
        title="Lake breach flooding residential colony again",
        description="Water rising rapidly inside ground floor homes, please hurry",
        category_id=flood_cat.id,
        location="Ram Nagar 6th Street, Velachery, Chennai",
        latitude=12.9815,
        longitude=80.2180,
        location_accuracy_m=40.0,
        location_source="gps",
        people_affected=25,
        contact_name="Senthil Nathan",
        contact_phone="9842345678",
        severity=f1_lvl,
        severity_score=f1_score,
        severity_reasons=json.dumps(["Duplicate submission from same device"]),
        status="Reported",
        is_duplicate=True,
        duplicate_of=flood_root.id,
        trust_score=dup_trust,
        trust_reasons=json.dumps(dup_tr_reasons),
        verification_status="Unverified",
        device_hash=dev_hash_a,  # Same device!
        ip_hash=ip_hash_a,
        phone_given=True,
        cluster_id=flood_root.id,
        cluster_size=3,
        cluster_people_affected=30,
        created_at=dup_time,
        updated_at=dup_time,
    )
    db.add(flood_dup)
    db.flush()
    flood_dup.ref_code = f"ER-2026-{flood_dup.id:04d}"

    # =======================================================================
    # OBVIOUS GIBBERISH REPORT: "test asdf" (Ends up Suspicious, trust < 30)
    # =======================================================================
    gib_time = now - timedelta(minutes=5)
    gib_trust, gib_tr_reasons = compute_trust(
        phone_given=False,
        llm_assessment={"gibberish_or_test": True, "plausible": False, "confidence": 0.95},
        description_length=12,
    )
    gib_inc = Incident(
        title="test asdf",
        description="asdf test 123",
        category_id=other_cat.id,
        location="unknown location",
        people_affected=0,
        severity="Low",
        severity_score=10,
        severity_reasons=json.dumps(["Other Emergencies base +10"]),
        status="Reported",
        trust_score=gib_trust,  # 50 - 30 - 10 = 10 -> Suspicious (<30)
        trust_reasons=json.dumps(gib_tr_reasons),
        verification_status="Unverified",
        device_hash=hash_identifier("spammer_device"),
        ip_hash=hash_identifier("10.0.0.99"),
        phone_given=False,
        created_at=gib_time,
        updated_at=gib_time,
    )
    db.add(gib_inc)
    db.flush()
    gib_inc.ref_code = f"ER-2026-{gib_inc.id:04d}"
    gib_inc.cluster_id = gib_inc.id

    # =======================================================================
    # LONE FIRE REPORT: Stays Unverified
    # =======================================================================
    fire_time = now - timedelta(minutes=40)
    fire_lvl, fire_score, fire_reasons = classify("FIRE", 3, "Fire outbreak in showroom", "smoke spreading to second floor")
    fire_trust, fire_tr_reasons = compute_trust(phone_given=True, description_length=50)
    fire_inc = Incident(
        title="Fire outbreak in textile showroom",
        description="Electrical short circuit caused fire, smoke spreading to second floor",
        category_id=fire_cat.id,
        location="Usman Road, T. Nagar, Chennai",
        latitude=13.0418,
        longitude=80.2341,
        location_accuracy_m=55.0,
        location_source="gps",
        people_affected=3,
        contact_name="Kavitha S",
        contact_phone="9841234567",
        severity=fire_lvl,
        severity_score=fire_score,
        severity_reasons=json.dumps(fire_reasons),
        status="Reported",
        trust_score=fire_trust,
        trust_reasons=json.dumps(fire_tr_reasons),
        verification_status="Unverified",
        device_hash=hash_identifier("device_tnagar"),
        ip_hash=hash_identifier("192.168.1.50"),
        phone_given=True,
        created_at=fire_time,
        updated_at=fire_time,
    )
    db.add(fire_inc)
    db.flush()
    fire_inc.ref_code = f"ER-2026-{fire_inc.id:04d}"
    fire_inc.cluster_id = fire_inc.id

    # =======================================================================
    # CRITICAL COLLAPSE: Verified Building Collapse with 10 people trapped
    # =======================================================================
    col_time = now - timedelta(minutes=90)
    col_lvl, col_score, col_reasons = classify("COLLAPSE", 10, "Commercial building collapsed", "10 people trapped under concrete debris")
    col_trust, col_tr_reasons = compute_trust(phone_given=True, location_accuracy_m=20.0, description_length=60)
    collapse_inc = Incident(
        title="Commercial building collapse near Flower Bazaar",
        description="Old 3-storey building collapsed, 10 people trapped under debris",
        category_id=collapse_cat.id,
        location="Flower Bazaar, George Town, Chennai",
        latitude=13.0902,
        longitude=80.2810,
        location_accuracy_m=20.0,
        location_source="gps",
        people_affected=10,
        contact_name="Ravi Kumar",
        contact_phone="9840123456",
        contact_email="ravi.k@example.com",
        severity=col_lvl,
        severity_score=col_score,
        severity_reasons=json.dumps(col_reasons),
        status="In Progress",
        trust_score=col_trust + 20,
        trust_reasons=json.dumps(col_tr_reasons + ["Manually verified by district supervisor +20"]),
        verification_status="Verified",
        device_hash=hash_identifier("device_georgetown"),
        ip_hash=hash_identifier("192.168.1.60"),
        phone_given=True,
        created_at=col_time,
        updated_at=col_time,
    )
    db.add(collapse_inc)
    db.flush()
    collapse_inc.ref_code = f"ER-2026-{collapse_inc.id:04d}"
    collapse_inc.cluster_id = collapse_inc.id

    # Seed initial status history entries for all
    for inc in [flood_root, flood_m2, flood_m3, flood_dup, gib_inc, fire_inc, collapse_inc]:
        h = IncidentStatusHistory(
            incident_id=inc.id,
            from_status=None,
            to_status=inc.status,
            note="Seeded incident entry",
            changed_by=None,
            changed_at=inc.created_at,
        )
        db.add(h)

    db.commit()
