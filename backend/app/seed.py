import json
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from .auth import hash_password
from .models import Category, Incident, IncidentStatusHistory, User
from .severity import classify

CATEGORIES_SEED_DATA = [
    {"code": "FIRE", "name": "Fire Emergency", "icon": "🔥", "base_weight": 30},
    {"code": "ROAD", "name": "Road Accident", "icon": "🚗", "base_weight": 20},
    {"code": "MEDICAL", "name": "Medical Emergency", "icon": "❤️", "base_weight": 20},
    {"code": "FLOOD", "name": "Flood", "icon": "🌊", "base_weight": 25},
    {"code": "COLLAPSE", "name": "Building Collapse", "icon": "🏢", "base_weight": 35},
    {"code": "OTHER", "name": "Other Emergencies", "icon": "⚠️", "base_weight": 10},
]

DEMO_INCIDENTS = [
    {
        "category_code": "COLLAPSE",
        "title": "Commercial building collapse near Flower Bazaar",
        "description": "Old 3-storey building collapsed, 10 people trapped under debris.",
        "people_affected": 10,
        "location": "Flower Bazaar, George Town, Chennai",
        "latitude": 13.0902,
        "longitude": 80.2810,
        "contact_name": "Ravi Kumar",
        "contact_phone": "9840123456",
        "contact_email": "ravi.k@example.com",
        "status": "In Progress",
        "minutes_ago": 180,
    },
    {
        "category_code": "FIRE",
        "title": "Fire outbreak in textile showroom",
        "description": "Electrical short circuit caused fire, smoke spreading to second floor.",
        "people_affected": 3,
        "location": "Usman Road, T. Nagar, Chennai",
        "latitude": 13.0418,
        "longitude": 80.2341,
        "contact_name": "Kavitha S",
        "contact_phone": "9841234567",
        "contact_email": "kavitha.s@example.com",
        "status": "Reported",
        "minutes_ago": 15,
    },
    {
        "category_code": "FLOOD",
        "title": "Severe waterlogging in residential colony",
        "description": "Lake breach causing rising water in residential colony, ground floor submerged.",
        "people_affected": 25,
        "location": "Ram Nagar, Velachery, Chennai",
        "latitude": 12.9815,
        "longitude": 80.2180,
        "contact_name": "Senthil Nathan",
        "contact_phone": "9842345678",
        "contact_email": "senthil@example.com",
        "status": "Pending",
        "minutes_ago": 120,
    },
    {
        "category_code": "ROAD",
        "title": "Multi-vehicle collision near Sholinganallur junction",
        "description": "Two cars and a bus minor collision, one injured with minor lacerations.",
        "people_affected": 2,
        "location": "OMR Sholinganallur Junction, Chennai",
        "latitude": 12.9010,
        "longitude": 80.2279,
        "contact_name": "Anand M",
        "contact_phone": "9843456789",
        "contact_email": None,
        "status": "In Progress",
        "minutes_ago": 75,
    },
    {
        "category_code": "MEDICAL",
        "title": "Elderly resident experiencing acute distress",
        "description": "Elderly patient having severe fever and dizziness, needs medical examination.",
        "people_affected": 1,
        "location": "Lattice Bridge Road, Adyar, Chennai",
        "latitude": 13.0012,
        "longitude": 80.2565,
        "contact_name": "Meena R",
        "contact_phone": "9844567890",
        "contact_email": "meena.r@example.com",
        "status": "Resolved",
        "minutes_ago": 300,
    },
    {
        "category_code": "ROAD",
        "title": "Highway bus collision with heavy bleeding reported",
        "description": "Intercity government bus overturned, passengers with heavy bleeding and fractures.",
        "people_affected": 14,
        "location": "GST Road near Guindy Kathipara, Chennai",
        "latitude": 13.0067,
        "longitude": 80.2025,
        "contact_name": "Dinesh K",
        "contact_phone": "9845678901",
        "contact_email": None,
        "status": "Reported",
        "minutes_ago": 25,
    },
    {
        "category_code": "OTHER",
        "title": "Industrial ammonia chemical gas leak",
        "description": "Storage cylinder ruptured, toxic gas leak spreading in surrounding area.",
        "people_affected": 18,
        "location": "Manali Industrial Belt, Chennai",
        "latitude": 13.1702,
        "longitude": 80.2612,
        "contact_name": "Subramanian V",
        "contact_phone": "9846789012",
        "contact_email": "safety_manali@example.com",
        "status": "In Progress",
        "minutes_ago": 90,
    },
    {
        "category_code": "COLLAPSE",
        "title": "Compound wall collapsed onto pedestrian pathway",
        "description": "Heavy monsoon rains caused boundary wall to fall, road partially blocked.",
        "people_affected": 0,
        "location": "Mudichur Road, West Tambaram, Chennai",
        "latitude": 12.9249,
        "longitude": 80.1000,
        "contact_name": "Karthik P",
        "contact_phone": "9847890123",
        "contact_email": None,
        "status": "Resolved",
        "minutes_ago": 400,
    },
    {
        "category_code": "MEDICAL",
        "title": "Passenger unconscious on railway platform concourse",
        "description": "Middle-aged traveler suddenly collapsed unconscious, cardiac symptoms suspected.",
        "people_affected": 1,
        "location": "MGR Central Railway Station Concourse, Chennai",
        "latitude": 13.0827,
        "longitude": 80.2755,
        "contact_name": "RPF Duty Officer",
        "contact_phone": "9848901234",
        "contact_email": "rpf_central@example.com",
        "status": "Pending",
        "minutes_ago": 45,
    },
    {
        "category_code": "FIRE",
        "title": "LPG cylinder explosion in residential area",
        "description": "Kitchen cylinder explosion, fire spreading rapidly and two people injured.",
        "people_affected": 6,
        "location": "Nochikuppam, Marina Beach Road, Chennai",
        "latitude": 13.0336,
        "longitude": 80.2785,
        "contact_name": "Murugan S",
        "contact_phone": "9849012345",
        "contact_email": None,
        "status": "Reported",
        "minutes_ago": 10,
    },
    {
        "category_code": "FLOOD",
        "title": "Vehicles stuck in flooded subway underpass",
        "description": "Subway water level reached 4 feet, two vehicles stuck with rising water.",
        "people_affected": 4,
        "location": "Pazhavanthangal Railway Subway, Chennai",
        "latitude": 12.9881,
        "longitude": 80.1873,
        "contact_name": "Traffic Patrol 7",
        "contact_phone": "9840112233",
        "contact_email": None,
        "status": "In Progress",
        "minutes_ago": 60,
    },
    {
        "category_code": "OTHER",
        "title": "High tension electrical wire snapped on temple street",
        "description": "Live electrical line snapped onto road after squall, traffic blocked.",
        "people_affected": 0,
        "location": "South Mada Street, Mylapore, Chennai",
        "latitude": 13.0339,
        "longitude": 80.2699,
        "contact_name": "Vijayaraghavan G",
        "contact_phone": "9840223344",
        "contact_email": "v.raghavan@example.com",
        "status": "Resolved",
        "minutes_ago": 500,
    },
]


def seed_database(db: Session) -> None:
    """Seed initial categories, admin user, and 12 realistic demo incidents if empty."""
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

    # 3. Demo Incidents (only if incidents table is completely empty)
    existing_incident_count = db.query(Incident).count()
    if existing_incident_count > 0:
        return

    now = datetime.now(timezone.utc)

    for item in DEMO_INCIDENTS:
        cat = category_map[item["category_code"]]
        created_time = now - timedelta(minutes=item["minutes_ago"])

        # ALWAYS compute severity via classify()
        level, score, reasons = classify(
            category_code=item["category_code"],
            people=item["people_affected"],
            title=item["title"],
            description=item["description"],
        )

        target_status = item["status"]
        resolved_time = (created_time + timedelta(minutes=45)) if target_status == "Resolved" else None
        updated_time = resolved_time if resolved_time else (created_time + timedelta(minutes=10))

        incident = Incident(
            title=item["title"],
            description=item["description"],
            category_id=cat.id,
            location=item["location"],
            latitude=item["latitude"],
            longitude=item["longitude"],
            people_affected=item["people_affected"],
            contact_name=item["contact_name"],
            contact_phone=item["contact_phone"],
            contact_email=item["contact_email"],
            severity=level,
            severity_score=score,
            severity_reasons=json.dumps(reasons),
            severity_overridden=False,
            status=target_status,
            is_duplicate=False,
            created_at=created_time,
            updated_at=updated_time,
            resolved_at=resolved_time,
        )
        db.add(incident)
        db.flush()

        incident.ref_code = f"ER-2026-{incident.id:04d}"

        # Initial reported history log
        h1 = IncidentStatusHistory(
            incident_id=incident.id,
            from_status=None,
            to_status="Reported",
            note="Initial report received from field",
            changed_by=None,
            changed_at=created_time,
        )
        db.add(h1)

        # Transition history if status advanced beyond Reported
        if target_status == "Pending":
            h2 = IncidentStatusHistory(
                incident_id=incident.id,
                from_status="Reported",
                to_status="Pending",
                note="Assigned to dispatch queue for verification",
                changed_by=admin_user.id,
                changed_at=created_time + timedelta(minutes=5),
            )
            db.add(h2)
        elif target_status == "In Progress":
            h2 = IncidentStatusHistory(
                incident_id=incident.id,
                from_status="Reported",
                to_status="Pending",
                note="Assigned to dispatch queue",
                changed_by=admin_user.id,
                changed_at=created_time + timedelta(minutes=5),
            )
            h3 = IncidentStatusHistory(
                incident_id=incident.id,
                from_status="Pending",
                to_status="In Progress",
                note="Emergency response units deployed to scene",
                changed_by=admin_user.id,
                changed_at=created_time + timedelta(minutes=10),
            )
            db.add(h2)
            db.add(h3)
        elif target_status == "Resolved":
            h2 = IncidentStatusHistory(
                incident_id=incident.id,
                from_status="Reported",
                to_status="In Progress",
                note="Emergency responders engaged on site",
                changed_by=admin_user.id,
                changed_at=created_time + timedelta(minutes=10),
            )
            h3 = IncidentStatusHistory(
                incident_id=incident.id,
                from_status="In Progress",
                to_status="Resolved",
                note="Situation stabilized and secured",
                changed_by=admin_user.id,
                changed_at=resolved_time,
            )
            db.add(h2)
            db.add(h3)

    db.commit()
