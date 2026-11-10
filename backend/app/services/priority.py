"""
ResQNet Live Priority Scoring Engine
------------------------------------
Dynamic, time-aware incident ranking algorithm that computes live priority
on read so aging emergencies naturally escalate until handled.

Formula:
  priority_score = (
      0.35 * severity_score
      + 0.25 * people_score
      + 0.20 * time_score
      + 0.20 * category_score
  )

Components:
  - severity_score: 0-100 from deterministic severity triage engine
  - people_score: min(people / 50, 1.0) * 100 (uses cluster_people_affected if present)
  - time_score: min(minutes_since_created / 120, 1.0) * 100 (0 if Resolved or False Alarm)
  - category_score: category.base_weight normalized to 0-100 (max base weight = 35)

Label Thresholds:
  - >= 75.0: Critical
  - >= 50.0: High
  - >= 25.0: Medium
  - < 25.0: Low

Unit-style Sample Output:
-------------------------
Sample Input:
  incident = Incident(
      severity_score=95,
      people_affected=10,
      cluster_people_affected=None,
      status="Reported",
      created_at=utc_now() - timedelta(minutes=45),
  )
  category = Category(code="COLLAPSE", base_weight=35)

Sample Return Value:
  {
      "score": 67.0,
      "label": "High",
      "breakdown": {
          "severity_score": 95,
          "severity_component": 33.25,
          "people_affected": 10,
          "people_score": 20.0,
          "people_component": 5.0,
          "minutes_active": 45.0,
          "time_score": 37.5,
          "time_component": 7.5,
          "category_code": "COLLAPSE",
          "category_base_weight": 35,
          "category_score": 100.0,
          "category_component": 20.0,
      }
  }
"""

from datetime import datetime, timezone
from typing import Any, Optional


def compute_priority(incident: Any, category: Optional[Any] = None) -> dict[str, Any]:
    """
    Compute live priority score (0-100), label, and explainable breakdown
    for an incident based on severity, people impacted, elapsed time, and category.
    """
    # 1. Severity Score component (0-100)
    sev_score = float(getattr(incident, "severity_score", 0) or 0)
    sev_score = max(0.0, min(100.0, sev_score))
    sev_component = 0.35 * sev_score

    # 2. People Score component (0-100)
    # Uses cluster_people_affected if available (multi-report cluster), else people_affected
    cluster_people = getattr(incident, "cluster_people_affected", None)
    raw_people = cluster_people if cluster_people is not None else getattr(incident, "people_affected", 0)
    effective_people = max(0, raw_people or 0)
    people_score = min(effective_people / 50.0, 1.0) * 100.0
    people_component = 0.25 * people_score

    # 3. Time Score component (0-100)
    # Reaches 100% after 2 hours (120 minutes) of active unresolved state; 0 if resolved/false alarm
    status_str = getattr(incident, "status", "Reported")
    if status_str in ("Resolved", "False Alarm"):
        time_score = 0.0
        minutes_since_created = 0.0
    else:
        created_at = getattr(incident, "created_at", None)
        if created_at is not None:
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            now = datetime.now(timezone.utc)
            elapsed_seconds = max(0.0, (now - created_at).total_seconds())
            minutes_since_created = elapsed_seconds / 60.0
        else:
            minutes_since_created = 0.0
        time_score = min(minutes_since_created / 120.0, 1.0) * 100.0
    time_component = 0.20 * time_score

    # 4. Category Score component (0-100)
    # Base weight in ResQNet ranges from 10 (OTHER) to 35 (COLLAPSE).
    cat_obj = category or getattr(incident, "category", None)
    base_weight = getattr(cat_obj, "base_weight", 10) if cat_obj else 10
    cat_code = getattr(cat_obj, "code", "UNKNOWN") if cat_obj else "UNKNOWN"

    if base_weight <= 35:
        category_score = (base_weight / 35.0) * 100.0
    else:
        category_score = min(100.0, float(base_weight))
    cat_component = 0.20 * category_score

    # Total Score (0-100)
    total_score = sev_component + people_component + time_component + cat_component
    total_score = max(0.0, min(100.0, total_score))

    # Priority Label
    if total_score >= 75.0:
        label = "Critical"
    elif total_score >= 50.0:
        label = "High"
    elif total_score >= 25.0:
        label = "Medium"
    else:
        label = "Low"

    breakdown = {
        "severity_score": int(round(sev_score)),
        "severity_component": round(sev_component, 2),
        "people_affected": effective_people,
        "people_score": round(people_score, 2),
        "people_component": round(people_component, 2),
        "minutes_active": round(minutes_since_created, 1),
        "time_score": round(time_score, 2),
        "time_component": round(time_component, 2),
        "category_code": cat_code,
        "category_base_weight": int(base_weight),
        "category_score": round(category_score, 2),
        "category_component": round(cat_component, 2),
    }

    return {
        "score": round(total_score, 1),
        "label": label,
        "breakdown": breakdown,
    }

