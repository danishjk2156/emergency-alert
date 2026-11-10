from datetime import datetime, timedelta, timezone
import json
from sqlalchemy.orm import Session

from .auth import hash_password
from .geo import haversine_distance_km
from .models import Category, Incident, IncidentStatusHistory, ReporterReputation, ResponseTeam, User
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

TEAMS_SEED_DATA = [
    {
        "code": "FIRE-01",
        "name": "T. Nagar Fire Station Unit",
        "category": "Fire",
        "latitude": 13.0418,
        "longitude": 80.2337,
        "location_label": "Usman Road, T. Nagar, Chennai",
        "availability": "Available",
    },
    {
        "code": "FIRE-02",
        "name": "Mylapore Fire Station Unit",
        "category": "Fire",
        "latitude": 13.0335,
        "longitude": 80.2685,
        "location_label": "Kutchery Road, Mylapore, Chennai",
        "availability": "Available",
    },
    {
        "code": "FIRE-03",
        "name": "Ambattur Fire & Rescue Command",
        "category": "Fire",
        "latitude": 13.0988,
        "longitude": 80.1615,
        "location_label": "Ambattur Industrial Estate, Chennai",
        "availability": "Busy",
    },
    {
        "code": "MED-01",
        "name": "108 Ambulance Unit - Rajiv Gandhi GH",
        "category": "Medical",
        "latitude": 13.0820,
        "longitude": 80.2785,
        "location_label": "Park Town, Chennai",
        "availability": "Available",
    },
    {
        "code": "MED-02",
        "name": "108 Ambulance Unit - Royapettah",
        "category": "Medical",
        "latitude": 13.0560,
        "longitude": 80.2610,
        "location_label": "Westcott Road, Royapettah, Chennai",
        "availability": "Available",
    },
    {
        "code": "MED-03",
        "name": "Apollo Emergency Response Unit",
        "category": "Medical",
        "latitude": 13.0605,
        "longitude": 80.2520,
        "location_label": "Greams Road, Thousand Lights, Chennai",
        "availability": "Available",
    },
    {
        "code": "RESCUE-01",
        "name": "SDRF Flood & Disaster Unit",
        "category": "Rescue",
        "latitude": 12.9805,
        "longitude": 80.2185,
        "location_label": "Velachery Main Road, Chennai",
        "availability": "Busy",
    },
    {
        "code": "RESCUE-02",
        "name": "Tamil Nadu Urban Search & Rescue",
        "category": "Rescue",
        "latitude": 13.0694,
        "longitude": 80.1948,
        "location_label": "Jawaharlal Nehru Salai, Koyambedu, Chennai",
        "availability": "Available",
    },
    {
        "code": "POLICE-01",
        "name": "Greater Chennai Police Patrol - Anna Nagar",
        "category": "Police",
        "latitude": 13.0850,
        "longitude": 80.2100,
        "location_label": "2nd Avenue, Anna Nagar, Chennai",
        "availability": "Available",
    },
    {
        "code": "POLICE-02",
        "name": "Highway & Traffic Patrol - Guindy",
        "category": "Police",
        "latitude": 13.0067,
        "longitude": 80.2025,
        "location_label": "GST Road, Guindy, Chennai",
        "availability": "Available",
    },
]


def seed_database(db: Session) -> None:
    """Seed categories, admin, response teams, and 12 realistic Chennai emergency incidents."""
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

    # 3. Seed Response Teams (10 units across Chennai)
    team_map: dict[str, ResponseTeam] = {}
    for t_data in TEAMS_SEED_DATA:
        existing_team = db.query(ResponseTeam).filter(ResponseTeam.code == t_data["code"]).first()
        if not existing_team:
            team = ResponseTeam(**t_data, updated_at=datetime.now(timezone.utc))
            db.add(team)
            db.flush()
            team_map[team.code] = team
        else:
            team_map[existing_team.code] = existing_team

    db.commit()

    # 4. Check if incidents already exist
    if db.query(Incident).count() > 0:
        return

    now = datetime.now(timezone.utc)
    flood_cat = category_map["FLOOD"]
    fire_cat = category_map["FIRE"]
    collapse_cat = category_map["COLLAPSE"]
    road_cat = category_map["ROAD"]
    medical_cat = category_map["MEDICAL"]
    other_cat = category_map["OTHER"]

    # Hashes for reporter reputation & cluster testing
    dev_a = hash_identifier("device_velachery_1")
    dev_b = hash_identifier("device_velachery_2")
    dev_c = hash_identifier("device_velachery_3")
    ip_a = hash_identifier("192.168.1.10")
    ip_b = hash_identifier("192.168.1.20")
    ip_c = hash_identifier("192.168.1.30")

    # -----------------------------------------------------------------------
    # INCIDENT 1: Velachery Flood Cluster Root (Assigned to RESCUE-01)
    # -----------------------------------------------------------------------
    t1 = now - timedelta(minutes=45)
    lvl_1, score_1, reasons_1 = classify(
        "FLOOD", 25, "Lake breach flooding residential colony", "Water rising rapidly inside ground floor homes, elderly stuck"
    )
    trust_1, tr_reasons_1 = compute_trust(phone_given=True, location_accuracy_m=35.0, corroborating_count=2, description_length=75)

    rescue_team_1 = team_map["RESCUE-01"]
    dist_1 = round(haversine_distance_km(12.9815, 80.2180, rescue_team_1.latitude, rescue_team_1.longitude), 2)
    eta_1 = max(1, int(round((dist_1 / 40.0) * 60)))

    inc_1 = Incident(
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
        severity=lvl_1,
        severity_score=score_1,
        severity_reasons=json.dumps(reasons_1 + ["escalated from cluster of 3 reports"]),
        status="Assigned",
        is_duplicate=False,
        trust_score=trust_1,
        trust_reasons=json.dumps(tr_reasons_1),
        verification_status="Corroborated",
        device_hash=dev_a,
        ip_hash=ip_a,
        phone_given=True,
        cluster_size=3,
        cluster_people_affected=30,
        assigned_team_id=rescue_team_1.id,
        assigned_at=t1 + timedelta(minutes=10),
        assignment_distance_km=dist_1,
        eta_minutes=eta_1,
        created_at=t1,
        updated_at=t1 + timedelta(minutes=10),
    )
    db.add(inc_1)
    db.flush()
    inc_1.ref_code = f"ER-2026-{inc_1.id:04d}"
    inc_1.cluster_id = inc_1.id

    # Mark RESCUE-01 as busy with inc_1
    rescue_team_1.current_incident_id = inc_1.id
    rescue_team_1.availability = "Busy"

    # -----------------------------------------------------------------------
    # INCIDENT 2: Velachery Flood Cluster Member 2
    # -----------------------------------------------------------------------
    t2 = now - timedelta(minutes=35)
    lvl_2, score_2, reasons_2 = classify(
        "FLOOD", 30, "Severe street waterlogging near Ram Nagar park", "Entire residential street inundated, 30 people affected with rising water"
    )
    trust_2, tr_reasons_2 = compute_trust(phone_given=True, location_accuracy_m=50.0, corroborating_count=2, description_length=70)
    inc_2 = Incident(
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
        severity=lvl_2,
        severity_score=score_2,
        severity_reasons=json.dumps(reasons_2),
        status="In Progress",
        is_duplicate=False,
        trust_score=trust_2,
        trust_reasons=json.dumps(tr_reasons_2),
        verification_status="Corroborated",
        device_hash=dev_b,
        ip_hash=ip_b,
        phone_given=True,
        cluster_id=inc_1.id,
        cluster_size=3,
        cluster_people_affected=30,
        created_at=t2,
        updated_at=t2,
    )
    db.add(inc_2)
    db.flush()
    inc_2.ref_code = f"ER-2026-{inc_2.id:04d}"

    # -----------------------------------------------------------------------
    # INCIDENT 3: Velachery Flood Cluster Member 3
    # -----------------------------------------------------------------------
    t3 = now - timedelta(minutes=25)
    lvl_3, score_3, reasons_3 = classify(
        "FLOOD", 20, "Water level reaching waist height in residential apartments", "Cars submerged, water rising continuously from overflowing drain"
    )
    trust_3, tr_reasons_3 = compute_trust(phone_given=False, location_accuracy_m=65.0, corroborating_count=2, description_length=68)
    inc_3 = Incident(
        title="Water level reaching waist height in residential apartments",
        description="Cars submerged, water rising continuously from overflowing drain",
        category_id=flood_cat.id,
        location="Ram Nagar 4th Cross, Velachery, Chennai",
        latitude=12.9808,
        longitude=80.2173,
        location_accuracy_m=65.0,
        location_source="gps",
        people_affected=20,
        contact_name="Lakshmi R",
        contact_phone="9842778899",
        severity=lvl_3,
        severity_score=score_3,
        severity_reasons=json.dumps(reasons_3),
        status="In Progress",
        is_duplicate=False,
        trust_score=trust_3,
        trust_reasons=json.dumps(tr_reasons_3),
        verification_status="Corroborated",
        device_hash=dev_c,
        ip_hash=ip_c,
        phone_given=True,
        cluster_id=inc_1.id,
        cluster_size=3,
        cluster_people_affected=30,
        created_at=t3,
        updated_at=t3,
    )
    db.add(inc_3)
    db.flush()
    inc_3.ref_code = f"ER-2026-{inc_3.id:04d}"

    # -----------------------------------------------------------------------
    # INCIDENT 4: Duplicate of Incident 1 (Same device as inc_1)
    # -----------------------------------------------------------------------
    t4 = now - timedelta(minutes=20)
    trust_4, tr_reasons_4 = compute_trust(
        phone_given=True, is_duplicate=True, duplicate_ref=inc_1.ref_code, description_length=60
    )
    inc_4 = Incident(
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
        severity=lvl_1,
        severity_score=score_1,
        severity_reasons=json.dumps(["Duplicate submission from same device"]),
        status="Reported",
        is_duplicate=True,
        duplicate_of=inc_1.id,
        trust_score=trust_4,
        trust_reasons=json.dumps(tr_reasons_4),
        verification_status="Unverified",
        device_hash=dev_a,
        ip_hash=ip_a,
        phone_given=True,
        cluster_id=inc_1.id,
        cluster_size=3,
        cluster_people_affected=30,
        created_at=t4,
        updated_at=t4,
    )
    db.add(inc_4)
    db.flush()
    inc_4.ref_code = f"ER-2026-{inc_4.id:04d}"

    # -----------------------------------------------------------------------
    # INCIDENT 5: Ambattur Industrial Chemical Fire (Assigned to FIRE-03)
    # -----------------------------------------------------------------------
    t5 = now - timedelta(minutes=55)
    lvl_5, score_5, reasons_5 = classify(
        "FIRE", 5, "Industrial warehouse chemical fire spreading", "Solvent containers ruptured, thick toxic smoke spreading across estate"
    )
    trust_5, tr_reasons_5 = compute_trust(phone_given=True, location_accuracy_m=25.0, description_length=80)
    fire_team_3 = team_map["FIRE-03"]
    dist_5 = round(haversine_distance_km(13.0975, 80.1620, fire_team_3.latitude, fire_team_3.longitude), 2)
    eta_5 = max(1, int(round((dist_5 / 40.0) * 60)))

    inc_5 = Incident(
        title="Industrial warehouse chemical fire spreading",
        description="Solvent containers ruptured, thick toxic smoke spreading across industrial estate, workers evacuated",
        category_id=fire_cat.id,
        location="Ambattur Industrial Estate 3rd Phase, Chennai",
        latitude=13.0975,
        longitude=80.1620,
        location_accuracy_m=25.0,
        location_source="gps",
        people_affected=5,
        contact_name="Prakash M",
        contact_phone="9840998877",
        severity=lvl_5,
        severity_score=score_5,
        severity_reasons=json.dumps(reasons_5),
        status="In Progress",
        is_duplicate=False,
        trust_score=trust_5,
        trust_reasons=json.dumps(tr_reasons_5),
        verification_status="Verified",
        device_hash=hash_identifier("dev_ambattur"),
        ip_hash=hash_identifier("192.168.1.45"),
        phone_given=True,
        assigned_team_id=fire_team_3.id,
        assigned_at=t5 + timedelta(minutes=8),
        assignment_distance_km=dist_5,
        eta_minutes=eta_5,
        created_at=t5,
        updated_at=t5 + timedelta(minutes=8),
    )
    db.add(inc_5)
    db.flush()
    inc_5.ref_code = f"ER-2026-{inc_5.id:04d}"
    inc_5.cluster_id = inc_5.id

    fire_team_3.current_incident_id = inc_5.id
    fire_team_3.availability = "Busy"

    # -----------------------------------------------------------------------
    # INCIDENT 6: George Town Building Collapse (Reported - Top Priority Candidate)
    # -----------------------------------------------------------------------
    t6 = now - timedelta(minutes=70)
    lvl_6, score_6, reasons_6 = classify(
        "COLLAPSE", 10, "Commercial building collapsed near Flower Bazaar", "Old 3-storey building collapsed, 10 people trapped under concrete debris"
    )
    trust_6, tr_reasons_6 = compute_trust(phone_given=True, location_accuracy_m=20.0, description_length=70)
    inc_6 = Incident(
        title="Commercial building collapsed near Flower Bazaar",
        description="Old 3-storey commercial structure collapsed, 10 people trapped under concrete slabs",
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
        severity=lvl_6,
        severity_score=score_6,
        severity_reasons=json.dumps(reasons_6),
        status="Reported",
        is_duplicate=False,
        trust_score=trust_6,
        trust_reasons=json.dumps(tr_reasons_6),
        verification_status="Verified",
        device_hash=hash_identifier("dev_georgetown"),
        ip_hash=hash_identifier("192.168.1.60"),
        phone_given=True,
        created_at=t6,
        updated_at=t6,
    )
    db.add(inc_6)
    db.flush()
    inc_6.ref_code = f"ER-2026-{inc_6.id:04d}"
    inc_6.cluster_id = inc_6.id

    # -----------------------------------------------------------------------
    # INCIDENT 7: Koyambedu Wholesale Market Roof Collapse (Reported)
    # -----------------------------------------------------------------------
    t7 = now - timedelta(minutes=50)
    lvl_7, score_7, reasons_7 = classify(
        "COLLAPSE", 15, "Wholesale market roof structural collapse", "Metal beam roof collapsed on vegetable vendors during morning rush"
    )
    trust_7, tr_reasons_7 = compute_trust(phone_given=True, location_accuracy_m=30.0, description_length=65)
    inc_7 = Incident(
        title="Wholesale market roof structural collapse",
        description="Heavy metal truss roof caved in on fruit vendors, 15 people injured and trapped under iron sheets",
        category_id=collapse_cat.id,
        location="Wholesale Market Complex, Koyambedu, Chennai",
        latitude=13.0694,
        longitude=80.1948,
        location_accuracy_m=30.0,
        location_source="gps",
        people_affected=15,
        contact_name="Velu Samy",
        contact_phone="9840554433",
        severity=lvl_7,
        severity_score=score_7,
        severity_reasons=json.dumps(reasons_7),
        status="Reported",
        is_duplicate=False,
        trust_score=trust_7,
        trust_reasons=json.dumps(tr_reasons_7),
        verification_status="Unverified",
        device_hash=hash_identifier("dev_koyambedu"),
        ip_hash=hash_identifier("192.168.1.75"),
        phone_given=True,
        created_at=t7,
        updated_at=t7,
    )
    db.add(inc_7)
    db.flush()
    inc_7.ref_code = f"ER-2026-{inc_7.id:04d}"
    inc_7.cluster_id = inc_7.id

    # -----------------------------------------------------------------------
    # INCIDENT 8: Kathipara Multi-Vehicle Pileup (Reported - High Road Emergency)
    # -----------------------------------------------------------------------
    t8 = now - timedelta(minutes=25)
    lvl_8, score_8, reasons_8 = classify(
        "ROAD", 6, "Multi-vehicle pileup on Kathipara flyover ramp", "Bus and three cars collided, passengers trapped inside crumpled vehicles"
    )
    trust_8, tr_reasons_8 = compute_trust(phone_given=True, location_accuracy_m=20.0, description_length=70)
    inc_8 = Incident(
        title="Multi-vehicle pileup on Kathipara flyover ramp",
        description="Government bus collided with three cars, heavy impact, 6 passengers trapped with serious bleeding",
        category_id=road_cat.id,
        location="Kathipara Flyover Ramp, Guindy, Chennai",
        latitude=13.0067,
        longitude=80.2025,
        location_accuracy_m=20.0,
        location_source="gps",
        people_affected=6,
        contact_name="Mohan Raj",
        contact_phone="9840223344",
        severity=lvl_8,
        severity_score=score_8,
        severity_reasons=json.dumps(reasons_8),
        status="Reported",
        is_duplicate=False,
        trust_score=trust_8,
        trust_reasons=json.dumps(tr_reasons_8),
        verification_status="Unverified",
        device_hash=hash_identifier("dev_guindy"),
        ip_hash=hash_identifier("192.168.1.80"),
        phone_given=True,
        created_at=t8,
        updated_at=t8,
    )
    db.add(inc_8)
    db.flush()
    inc_8.ref_code = f"ER-2026-{inc_8.id:04d}"
    inc_8.cluster_id = inc_8.id

    # -----------------------------------------------------------------------
    # INCIDENT 9: Anna Nagar Cardiac Arrest at Community Event (Reported)
    # -----------------------------------------------------------------------
    t9 = now - timedelta(minutes=15)
    lvl_9, score_9, reasons_9 = classify(
        "MEDICAL", 1, "Critical cardiac arrest during badminton tournament", "Elderly player collapsed on court, not breathing, CPR in progress"
    )
    trust_9, tr_reasons_9 = compute_trust(phone_given=True, location_accuracy_m=15.0, description_length=65)
    inc_9 = Incident(
        title="Critical cardiac arrest during badminton tournament",
        description="Senior citizen collapsed on badminton court, unconscious and not breathing, immediate defibrillator needed",
        category_id=medical_cat.id,
        location="Tower Park Sports Club, Anna Nagar, Chennai",
        latitude=13.0855,
        longitude=80.2115,
        location_accuracy_m=15.0,
        location_source="gps",
        people_affected=1,
        contact_name="Dr. Harish",
        contact_phone="9840114477",
        severity=lvl_9,
        severity_score=score_9,
        severity_reasons=json.dumps(reasons_9),
        status="Reported",
        is_duplicate=False,
        trust_score=trust_9,
        trust_reasons=json.dumps(tr_reasons_9),
        verification_status="Verified",
        device_hash=hash_identifier("dev_annanagar"),
        ip_hash=hash_identifier("192.168.1.90"),
        phone_given=True,
        created_at=t9,
        updated_at=t9,
    )
    db.add(inc_9)
    db.flush()
    inc_9.ref_code = f"ER-2026-{inc_9.id:04d}"
    inc_9.cluster_id = inc_9.id

    # -----------------------------------------------------------------------
    # INCIDENT 10: T. Nagar Showroom Fire (Resolved by FIRE-01)
    # -----------------------------------------------------------------------
    t10 = now - timedelta(minutes=120)
    lvl_10, score_10, reasons_10 = classify(
        "FIRE", 3, "Textile showroom electrical fire extinguished", "Smoke contained, short circuit isolated, zero casualties"
    )
    trust_10, tr_reasons_10 = compute_trust(phone_given=True, location_accuracy_m=40.0, description_length=60)
    inc_10 = Incident(
        title="Textile showroom electrical fire contained",
        description="Electrical switchboard fire on first floor, fully extinguished by fire crew, building ventilated",
        category_id=fire_cat.id,
        location="Usman Road, T. Nagar, Chennai",
        latitude=13.0418,
        longitude=80.2341,
        location_accuracy_m=40.0,
        location_source="gps",
        people_affected=3,
        contact_name="Kavitha S",
        contact_phone="9841234567",
        severity=lvl_10,
        severity_score=score_10,
        severity_reasons=json.dumps(reasons_10),
        status="Resolved",
        is_duplicate=False,
        trust_score=trust_10,
        trust_reasons=json.dumps(tr_reasons_10),
        verification_status="Verified",
        device_hash=hash_identifier("dev_tnagar"),
        ip_hash=hash_identifier("192.168.1.50"),
        phone_given=True,
        assigned_team_id=team_map["FIRE-01"].id,
        assigned_at=t10 + timedelta(minutes=10),
        assignment_distance_km=0.1,
        eta_minutes=1,
        resolved_at=now - timedelta(minutes=20),
        created_at=t10,
        updated_at=now - timedelta(minutes=20),
    )
    db.add(inc_10)
    db.flush()
    inc_10.ref_code = f"ER-2026-{inc_10.id:04d}"
    inc_10.cluster_id = inc_10.id

    # -----------------------------------------------------------------------
    # INCIDENT 11: Chemical Vapor Leak in Research Facility (Reported)
    # -----------------------------------------------------------------------
    t11 = now - timedelta(minutes=30)
    lvl_11, score_11, reasons_11 = classify(
        "OTHER", 8, "Toxic chemical vapor leak in diagnostics laboratory", "Ammonia and acid fumes venting into building corridor, 8 staff nauseous"
    )
    trust_11, tr_reasons_11 = compute_trust(phone_given=True, location_accuracy_m=25.0, description_length=65)
    inc_11 = Incident(
        title="Toxic chemical vapor leak in diagnostics laboratory",
        description="Ammonia solvent cylinder valve failed, heavy caustic vapors spreading, 8 laboratory staff experiencing breathing difficulty",
        category_id=other_cat.id,
        location="Greams Road, Thousand Lights, Chennai",
        latitude=13.0605,
        longitude=80.2520,
        location_accuracy_m=25.0,
        location_source="gps",
        people_affected=8,
        contact_name="Lab Supervisor",
        contact_phone="9840887766",
        severity=lvl_11,
        severity_score=score_11,
        severity_reasons=json.dumps(reasons_11),
        status="Reported",
        is_duplicate=False,
        trust_score=trust_11,
        trust_reasons=json.dumps(tr_reasons_11),
        verification_status="Unverified",
        device_hash=hash_identifier("dev_greams"),
        ip_hash=hash_identifier("192.168.1.95"),
        phone_given=True,
        created_at=t11,
        updated_at=t11,
    )
    db.add(inc_11)
    db.flush()
    inc_11.ref_code = f"ER-2026-{inc_11.id:04d}"
    inc_11.cluster_id = inc_11.id

    # -----------------------------------------------------------------------
    # INCIDENT 12: Rip Current Near Marina Beach Lighthouse (Resolved)
    # -----------------------------------------------------------------------
    t12 = now - timedelta(minutes=140)
    lvl_12, score_12, reasons_12 = classify(
        "MEDICAL", 2, "Swimmers caught in sea current safely brought ashore", "Two college students rescued by lifeguards, treated for shock and exhaustion"
    )
    trust_12, tr_reasons_12 = compute_trust(phone_given=True, location_accuracy_m=30.0, description_length=60)
    inc_12 = Incident(
        title="Swimmers caught in sea current safely brought ashore",
        description="Two youths caught in strong undertow rescued by coastal patrol, basic medical triage provided on promenade",
        category_id=medical_cat.id,
        location="Marina Beach Promenade near Lighthouse, Chennai",
        latitude=13.0390,
        longitude=80.2790,
        location_accuracy_m=30.0,
        location_source="gps",
        people_affected=2,
        contact_name="Coast Patrol Officer",
        contact_phone="9840332211",
        severity=lvl_12,
        severity_score=score_12,
        severity_reasons=json.dumps(reasons_12),
        status="Resolved",
        is_duplicate=False,
        trust_score=trust_12,
        trust_reasons=json.dumps(tr_reasons_12),
        verification_status="Verified",
        device_hash=hash_identifier("dev_marina"),
        ip_hash=hash_identifier("192.168.1.105"),
        phone_given=True,
        assigned_team_id=team_map["MED-02"].id,
        assigned_at=t12 + timedelta(minutes=15),
        assignment_distance_km=2.1,
        eta_minutes=4,
        resolved_at=now - timedelta(minutes=30),
        created_at=t12,
        updated_at=now - timedelta(minutes=30),
    )
    db.add(inc_12)
    db.flush()
    inc_12.ref_code = f"ER-2026-{inc_12.id:04d}"
    inc_12.cluster_id = inc_12.id

    # -----------------------------------------------------------------------
    # Seed Incident Status History for all 12 incidents
    # -----------------------------------------------------------------------
    all_incidents = [
        inc_1, inc_2, inc_3, inc_4, inc_5, inc_6, inc_7, inc_8, inc_9, inc_10, inc_11, inc_12
    ]
    for inc in all_incidents:
        h1 = IncidentStatusHistory(
            incident_id=inc.id,
            from_status=None,
            to_status="Reported",
            note="Incident reported and registered in system",
            changed_by=None,
            changed_at=inc.created_at,
        )
        db.add(h1)

        if inc.status in ("Assigned", "In Progress", "Resolved"):
            h2 = IncidentStatusHistory(
                incident_id=inc.id,
                from_status="Reported",
                to_status="Assigned" if inc.status == "Assigned" else "In Progress",
                note=f"Assigned to {inc.assigned_team.code}" if inc.assigned_team else "Dispatched to emergency zone",
                changed_by=admin_user.id,
                changed_at=inc.assigned_at or (inc.created_at + timedelta(minutes=10)),
            )
            db.add(h2)

        if inc.status == "Resolved":
            h3 = IncidentStatusHistory(
                incident_id=inc.id,
                from_status="In Progress",
                to_status="Resolved",
                note="Emergency resolved successfully, area clear",
                changed_by=admin_user.id,
                changed_at=inc.resolved_at or (inc.created_at + timedelta(minutes=45)),
            )
            db.add(h3)

    db.commit()
