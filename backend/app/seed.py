"""Seed script to populate the database with sample data."""

import sys
import os

# Ensure the backend directory is on the path so imports work
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta, timezone

from app.auth import hash_password
from app.database import Base, SessionLocal, engine
from app.models import (
    Incident,
    IncidentCategory,
    IncidentSeverity,
    IncidentStatus,
    IncidentUpdate,
    User,
    UserRole,
)


def seed():
    """Create sample users, incidents, and incident updates."""
    # Create tables
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Skip if data already exists
        if db.query(User).first():
            print("Database already seeded. Skipping.")
            return

        now = datetime.now(timezone.utc)

        # ── Users ─────────────────────────────────────────────────────────
        admin = User(
            username="admin",
            email="admin@cobotex.com",
            hashed_password=hash_password("admin123"),
            role=UserRole.ADMIN,
            created_at=now - timedelta(days=30),
        )
        responder1 = User(
            username="responder1",
            email="responder1@cobotex.com",
            hashed_password=hash_password("resp123"),
            role=UserRole.RESPONDER,
            created_at=now - timedelta(days=25),
        )
        responder2 = User(
            username="responder2",
            email="responder2@cobotex.com",
            hashed_password=hash_password("resp123"),
            role=UserRole.RESPONDER,
            created_at=now - timedelta(days=20),
        )
        reporter1 = User(
            username="reporter1",
            email="reporter1@cobotex.com",
            hashed_password=hash_password("report123"),
            role=UserRole.REPORTER,
            created_at=now - timedelta(days=15),
        )
        reporter2 = User(
            username="reporter2",
            email="reporter2@cobotex.com",
            hashed_password=hash_password("report123"),
            role=UserRole.REPORTER,
            created_at=now - timedelta(days=10),
        )

        users = [admin, responder1, responder2, reporter1, reporter2]
        db.add_all(users)
        db.flush()  # Get IDs assigned

        # ── Incidents ─────────────────────────────────────────────────────
        incidents = [
            Incident(
                title="Warehouse Fire on Industrial Ave",
                description="Large fire reported at the warehouse complex on Industrial Avenue. Multiple units affected. Smoke visible from several blocks away.",
                category=IncidentCategory.FIRE,
                severity=IncidentSeverity.CRITICAL,
                status=IncidentStatus.IN_PROGRESS,
                latitude=40.7128,
                longitude=-74.0060,
                address="450 Industrial Ave, New York, NY 10001",
                reporter_id=reporter1.id,
                assigned_to_id=responder1.id,
                created_at=now - timedelta(hours=3),
                updated_at=now - timedelta(hours=1),
            ),
            Incident(
                title="Flash Flooding on Main Street",
                description="Heavy rainfall has caused flash flooding on Main Street. Water levels rising rapidly. Several vehicles stranded.",
                category=IncidentCategory.FLOOD,
                severity=IncidentSeverity.HIGH,
                status=IncidentStatus.OPEN,
                latitude=40.7580,
                longitude=-73.9855,
                address="200 Main Street, New York, NY 10036",
                reporter_id=reporter2.id,
                created_at=now - timedelta(hours=2),
                updated_at=now - timedelta(hours=2),
            ),
            Incident(
                title="Multi-Vehicle Collision on Highway 101",
                description="Three-car pileup on Highway 101 northbound near exit 42. At least two injuries reported. Traffic backed up for miles.",
                category=IncidentCategory.ACCIDENT,
                severity=IncidentSeverity.HIGH,
                status=IncidentStatus.IN_PROGRESS,
                latitude=37.7749,
                longitude=-122.4194,
                address="Highway 101 NB, Exit 42, San Francisco, CA",
                reporter_id=reporter1.id,
                assigned_to_id=responder2.id,
                created_at=now - timedelta(hours=5),
                updated_at=now - timedelta(hours=3),
            ),
            Incident(
                title="Gas Leak at Chemical Plant",
                description="Potential hazardous gas leak detected at the chemical processing plant. Evacuation zone being established.",
                category=IncidentCategory.HAZMAT,
                severity=IncidentSeverity.CRITICAL,
                status=IncidentStatus.OPEN,
                latitude=34.0522,
                longitude=-118.2437,
                address="1200 Chemical Way, Los Angeles, CA 90015",
                reporter_id=reporter2.id,
                created_at=now - timedelta(hours=1),
                updated_at=now - timedelta(hours=1),
            ),
            Incident(
                title="Medical Emergency at City Park",
                description="Individual collapsed in City Park near the fountain area. Bystanders performing CPR. Ambulance requested.",
                category=IncidentCategory.MEDICAL,
                severity=IncidentSeverity.HIGH,
                status=IncidentStatus.RESOLVED,
                latitude=41.8781,
                longitude=-87.6298,
                address="City Park, Chicago, IL 60601",
                reporter_id=reporter1.id,
                assigned_to_id=responder1.id,
                created_at=now - timedelta(days=1),
                updated_at=now - timedelta(hours=20),
                resolved_at=now - timedelta(hours=20),
            ),
            Incident(
                title="Minor Earthquake Tremor Felt Downtown",
                description="A minor earthquake tremor (estimated 3.2 magnitude) was felt in the downtown area. No structural damage reported yet.",
                category=IncidentCategory.EARTHQUAKE,
                severity=IncidentSeverity.LOW,
                status=IncidentStatus.CLOSED,
                latitude=34.0195,
                longitude=-118.4912,
                address="Downtown, Santa Monica, CA 90401",
                reporter_id=reporter2.id,
                created_at=now - timedelta(days=3),
                updated_at=now - timedelta(days=2),
                resolved_at=now - timedelta(days=2),
            ),
            Incident(
                title="Kitchen Fire in Residential Building",
                description="Small kitchen fire reported on the 3rd floor of a residential building. Fire contained to one unit.",
                category=IncidentCategory.FIRE,
                severity=IncidentSeverity.MEDIUM,
                status=IncidentStatus.RESOLVED,
                latitude=40.7484,
                longitude=-73.9857,
                address="350 5th Ave, New York, NY 10118",
                reporter_id=reporter1.id,
                assigned_to_id=responder2.id,
                created_at=now - timedelta(days=2),
                updated_at=now - timedelta(days=1, hours=20),
                resolved_at=now - timedelta(days=1, hours=20),
            ),
            Incident(
                title="Suspicious Package Found Near Train Station",
                description="Unattended package discovered near the entrance of Central Train Station. Area being cordoned off.",
                category=IncidentCategory.OTHER,
                severity=IncidentSeverity.MEDIUM,
                status=IncidentStatus.CLOSED,
                latitude=40.7527,
                longitude=-73.9772,
                address="Grand Central Terminal, New York, NY 10017",
                reporter_id=reporter2.id,
                assigned_to_id=responder1.id,
                created_at=now - timedelta(days=5),
                updated_at=now - timedelta(days=4),
                resolved_at=now - timedelta(days=4),
            ),
            Incident(
                title="Water Pipe Burst on Elm Street",
                description="A major water pipe has burst on Elm Street causing flooding of the roadway and nearby basements.",
                category=IncidentCategory.FLOOD,
                severity=IncidentSeverity.MEDIUM,
                status=IncidentStatus.IN_PROGRESS,
                latitude=42.3601,
                longitude=-71.0589,
                address="75 Elm Street, Boston, MA 02108",
                reporter_id=reporter1.id,
                assigned_to_id=responder1.id,
                created_at=now - timedelta(hours=8),
                updated_at=now - timedelta(hours=6),
            ),
            Incident(
                title="Slip and Fall at Shopping Mall",
                description="Customer slipped on wet floor near food court. Possible ankle fracture. First aid applied on site.",
                category=IncidentCategory.MEDICAL,
                severity=IncidentSeverity.LOW,
                status=IncidentStatus.RESOLVED,
                latitude=33.7490,
                longitude=-84.3880,
                address="Peachtree Mall, Atlanta, GA 30303",
                reporter_id=reporter2.id,
                created_at=now - timedelta(days=1, hours=5),
                updated_at=now - timedelta(days=1, hours=3),
                resolved_at=now - timedelta(days=1, hours=3),
            ),
        ]

        db.add_all(incidents)
        db.flush()

        # ── Incident Updates (timeline entries) ───────────────────────────
        updates = [
            # Updates for Warehouse Fire
            IncidentUpdate(
                incident_id=incidents[0].id,
                user_id=responder1.id,
                message="Responding to location. ETA 5 minutes.",
                status_change="IN_PROGRESS",
                created_at=now - timedelta(hours=2, minutes=50),
            ),
            IncidentUpdate(
                incident_id=incidents[0].id,
                user_id=responder1.id,
                message="Arrived on scene. Fire department is actively working to contain the blaze. Two buildings fully engulfed.",
                created_at=now - timedelta(hours=2, minutes=30),
            ),
            IncidentUpdate(
                incident_id=incidents[0].id,
                user_id=admin.id,
                message="Additional units dispatched. Evacuation perimeter expanded to 3 blocks.",
                created_at=now - timedelta(hours=1),
            ),
            # Updates for Multi-Vehicle Collision
            IncidentUpdate(
                incident_id=incidents[2].id,
                user_id=responder2.id,
                message="En route to the scene. Highway patrol already on site.",
                status_change="IN_PROGRESS",
                created_at=now - timedelta(hours=4, minutes=45),
            ),
            IncidentUpdate(
                incident_id=incidents[2].id,
                user_id=responder2.id,
                message="Two individuals transported to hospital with non-life-threatening injuries. Tow trucks clearing wreckage.",
                created_at=now - timedelta(hours=3),
            ),
            # Updates for Medical Emergency
            IncidentUpdate(
                incident_id=incidents[4].id,
                user_id=responder1.id,
                message="Paramedics arrived. Patient is conscious and stable.",
                status_change="IN_PROGRESS",
                created_at=now - timedelta(hours=23),
            ),
            IncidentUpdate(
                incident_id=incidents[4].id,
                user_id=responder1.id,
                message="Patient transported to hospital. Vitals stable. Incident resolved.",
                status_change="RESOLVED",
                created_at=now - timedelta(hours=20),
            ),
            # Updates for Water Pipe Burst
            IncidentUpdate(
                incident_id=incidents[8].id,
                user_id=responder1.id,
                message="Water utility team dispatched. Attempting to shut off main valve.",
                status_change="IN_PROGRESS",
                created_at=now - timedelta(hours=7),
            ),
        ]

        db.add_all(updates)
        db.commit()

        print("✅ Database seeded successfully!")
        print(f"   Users: {len(users)}")
        print(f"   Incidents: {len(incidents)}")
        print(f"   Incident Updates: {len(updates)}")
        print()
        print("   Login credentials:")
        print("   ─────────────────")
        print("   admin     / admin123   (ADMIN)")
        print("   responder1 / resp123   (RESPONDER)")
        print("   responder2 / resp123   (RESPONDER)")
        print("   reporter1  / report123 (REPORTER)")
        print("   reporter2  / report123 (REPORTER)")

    except Exception as e:
        db.rollback()
        print(f"❌ Error seeding database: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
