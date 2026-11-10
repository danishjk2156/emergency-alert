from datetime import timedelta
import difflib
import math
import os
import re
from typing import Optional

from sqlalchemy.orm import Session

from .geo import haversine_distance_km

CORR_WINDOW_MIN = int(os.getenv("CORR_WINDOW_MIN", "30"))
CORR_RADIUS_M = float(os.getenv("CORR_RADIUS_M", "500.0"))

STOPWORDS = {
    "near", "opp", "opposite", "road", "rd", "street", "st", "nagar",
    "corner", "main", "junction", "behind", "front", "chennai", "in",
    "at", "by", "the", "and", "close", "to",
}

# Related emergency category pairings (e.g. fire causing collapse, flood causing collapse)
RELATED_PAIRS = {
    ("FIRE", "COLLAPSE"),
    ("COLLAPSE", "FIRE"),
    ("FLOOD", "COLLAPSE"),
    ("COLLAPSE", "FLOOD"),
}


def normalize_location_tokens(text: str) -> set[str]:
    """Extract normalized word tokens stripping punctuation and local stopwords."""
    if not text:
        return set()
    cleaned = re.sub(r"[^\w\s]", " ", text.lower())
    tokens = {w for w in cleaned.split() if len(w) > 1 and w not in STOPWORDS}
    return tokens


def jaccard_similarity(text1: str, text2: str) -> float:
    """Calculate token Jaccard similarity between two address strings."""
    t1 = normalize_location_tokens(text1)
    t2 = normalize_location_tokens(text2)
    if not t1 or not t2:
        return 0.0
    intersection = len(t1.intersection(t2))
    union = len(t1.union(t2))
    return intersection / union if union > 0 else 0.0


def are_locations_nearby(
    lat1: Optional[float],
    lon1: Optional[float],
    loc1: str,
    lat2: Optional[float],
    lon2: Optional[float],
    loc2: str,
    radius_m: float = CORR_RADIUS_M,
) -> tuple[bool, Optional[float]]:
    """
    Check if two incidents are within the distance threshold.
    Returns (is_nearby, distance_in_meters).
    """
    if lat1 is not None and lon1 is not None and lat2 is not None and lon2 is not None:
        dist_km = haversine_distance_km(lat1, lon1, lat2, lon2)
        dist_m = dist_km * 1000.0
        return dist_m <= radius_m, round(dist_m, 1)

    # Fallback to normalized text similarity
    sim = jaccard_similarity(loc1, loc2)
    if sim >= 0.6:
        return True, None

    return False, None


def check_independence(
    device_hash1: Optional[str],
    ip_hash1: Optional[str],
    desc1: str,
    false_alarm_count1: int,
    device_hash2: Optional[str],
    ip_hash2: Optional[str],
    desc2: str,
    false_alarm_count2: int,
    shared_ips: Optional[set[str]] = None,
) -> bool:
    """
    Determine if two reports are genuinely independent:
    1. Different device hashes
    2. Different IP hashes (unless IP is a known shared network)
    3. Descriptions are not direct copy-pastes (ratio < 0.85)
    4. Neither reporter has false_alarm_count >= 2
    """
    if false_alarm_count1 >= 2 or false_alarm_count2 >= 2:
        return False

    if device_hash1 and device_hash2 and device_hash1 == device_hash2:
        return False

    if ip_hash1 and ip_hash2 and ip_hash1 == ip_hash2:
        if shared_ips and ip_hash1 not in shared_ips:
            return False

    # Check text similarity ratio
    sim_ratio = difflib.SequenceMatcher(None, desc1.strip().lower(), desc2.strip().lower()).ratio()
    if sim_ratio >= 0.85:
        return False

    return True


def run_corroboration_pipeline(db: Session, incident) -> list[int]:
    """
    Find corroborating incidents and cluster members, update cluster_id,
    cluster_size, and verification_status, and escalate severity if appropriate.
    Returns list of corroborating incident IDs.
    """
    from .models import Category, Incident, ReporterReputation
    from .severity import classify

    now = incident.created_at
    time_window_start = now - timedelta(minutes=CORR_WINDOW_MIN)
    time_window_end = now + timedelta(minutes=CORR_WINDOW_MIN)

    # Fast SQL query for potential candidates
    query = db.query(Incident).filter(
        Incident.id != incident.id,
        Incident.status != "False Alarm",
        Incident.created_at >= time_window_start,
        Incident.created_at <= time_window_end,
    )

    # Pre-filter latitude/longitude delta (~550m = 0.005 deg)
    if incident.latitude is not None and incident.longitude is not None:
        query = query.filter(
            (Incident.latitude == None)
            | (
                (Incident.latitude >= incident.latitude - 0.005)
                & (Incident.latitude <= incident.latitude + 0.005)
                & (Incident.longitude >= incident.longitude - 0.005)
                & (Incident.longitude <= incident.longitude + 0.005)
            )
        )

    candidates = query.all()

    # Get categories to check matching and related pairs
    category_map = {c.id: c.code for c in db.query(Category).all()}
    my_cat_code = category_map.get(incident.category_id, "OTHER")

    # Get reporter reputation
    def get_false_alarms(dev_hash: Optional[str]) -> int:
        if not dev_hash:
            return 0
        rep = db.query(ReporterReputation).filter(ReporterReputation.device_hash == dev_hash).first()
        return rep.false_alarm_count if rep else 0

    my_false_alarms = get_false_alarms(incident.device_hash)

    corroborating_members = []
    duplicate_candidates = []

    for other in candidates:
        other_cat_code = category_map.get(other.category_id, "OTHER")
        same_category = (incident.category_id == other.category_id)
        related_category = (my_cat_code, other_cat_code) in RELATED_PAIRS

        if not (same_category or related_category):
            continue

        nearby, dist_m = are_locations_nearby(
            incident.latitude, incident.longitude, incident.location,
            other.latitude, other.longitude, other.location,
        )
        if not nearby:
            continue

        other_false_alarms = get_false_alarms(other.device_hash)

        is_indep = check_independence(
            incident.device_hash, incident.ip_hash, incident.description, my_false_alarms,
            other.device_hash, other.ip_hash, other.description, other_false_alarms,
        )

        if is_indep:
            corroborating_members.append(other)
        else:
            duplicate_candidates.append(other)

    # Handle duplicates if not independent
    if duplicate_candidates and not corroborating_members:
        earliest = min(duplicate_candidates, key=lambda x: x.created_at)
        incident.duplicate_of = earliest.id
        incident.is_duplicate = True

    # Clustering logic
    if corroborating_members:
        all_group = [incident] + corroborating_members
        # Root is the earliest incident in the group
        earliest_root = min(all_group, key=lambda x: x.created_at)
        cluster_root_id = earliest_root.id or incident.id
        cluster_size = len(all_group)

        # Max people affected across group
        max_people = max(m.people_affected for m in all_group)

        # Update each member's cluster metadata
        for member in all_group:
            member.cluster_id = cluster_root_id
            member.cluster_size = cluster_size
            member.cluster_people_affected = max_people
            if member.verification_status not in ["Verified", "False Alarm"]:
                member.verification_status = "Corroborated"

        # Escalate root severity if multiple witnesses or higher casualties
        combined_text = " ".join([m.title + " " + m.description for m in all_group])
        escalated_lvl, escalated_score, esc_reasons = classify(
            my_cat_code, max_people, earliest_root.title, combined_text
        )

        # Severity can go UP, never down
        severity_ranks = {"Low": 1, "Medium": 2, "High": 3, "Critical": 4}
        current_rank = severity_ranks.get(earliest_root.severity, 1)
        new_rank = severity_ranks.get(escalated_lvl, 1)

        if new_rank > current_rank or escalated_score > earliest_root.severity_score:
            earliest_root.severity = escalated_lvl if new_rank > current_rank else earliest_root.severity
            earliest_root.severity_score = max(earliest_root.severity_score, escalated_score)

        if cluster_size >= 3:
            earliest_root.severity_score = min(100, earliest_root.severity_score + 10)

        db.commit()
        return [m.id for m in corroborating_members if m.id is not None]

    # No corroboration found
    incident.cluster_id = incident.id
    incident.cluster_size = 1
    incident.cluster_people_affected = incident.people_affected
    db.commit()
    return []


# ---------------------------------------------------------------------------
# Unit Tests
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("--- Running Corroboration Engine Unit Tests ---")

    # Test 1: Same device -> duplicate, not independent
    assert not check_independence("dev1", "ip1", "fire at shop", 0, "dev1", "ip1", "fire at shop", 0)
    print("[PASS] Same device x2 -> Duplicate, not independent")

    # Test 2: Two devices 400m / 10 min -> Corroborated
    is_near, dist = are_locations_nearby(13.0418, 80.2341, "T Nagar", 13.0430, 80.2360, "T Nagar", 500)
    assert is_near and dist is not None and dist < 500
    print(f"[PASS] 2 devices 400m -> Nearby ({dist}m)")

    # Test 3: Two devices 800m -> Not corroborated
    is_near, dist = are_locations_nearby(13.0418, 80.2341, "T Nagar", 13.0480, 80.2420, "T Nagar", 500)
    assert not is_near
    print(f"[PASS] 2 devices 800m -> Not nearby ({dist}m)")

    # Test 4: Text-only match "Velachery Main Rd" vs "velachery main road"
    assert jaccard_similarity("Velachery Main Rd", "velachery main road") >= 0.6
    print("[PASS] Text-only Jaccard similarity match >= 0.6")

    print("ALL CORROBORATION TESTS PASSED! 🚀")
