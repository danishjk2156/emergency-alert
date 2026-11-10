CATEGORY_BASE = {
    "FIRE": 30,
    "ROAD": 20,
    "MEDICAL": 20,
    "FLOOD": 25,
    "COLLAPSE": 35,
    "OTHER": 10,
}

CATEGORY_DISPLAY = {
    "FIRE": "Fire Emergency",
    "ROAD": "Road Accident",
    "MEDICAL": "Medical Emergency",
    "FLOOD": "Flood",
    "COLLAPSE": "Building Collapse",
    "OTHER": "Other Emergencies",
}

CRITICAL_KEYWORDS = [
    "trapped",
    "unconscious",
    "not breathing",
    "explosion",
    "collapsed",
    "spreading",
    "heavy bleeding",
    "gas leak",
    "child",
    "drowning",
]

SERIOUS_KEYWORDS = [
    "injured",
    "smoke",
    "rising water",
    "stuck",
    "elderly",
    "burn",
    "fracture",
    "blocked",
]

HARD_OVERRIDE_KEYWORDS = [
    "not breathing",
    "explosion",
    "trapped",
]


def calculate_people_points(people: int) -> int:
    """Calculate points contributed by the number of people affected."""
    if people <= 1:
        return 0
    elif people <= 5:
        return 10
    elif people <= 20:
        return 20
    elif people <= 50:
        return 30
    else:
        return 40


def classify(
    category_code: str,
    people: int,
    title: str,
    description: str,
) -> tuple[str, int, list[str]]:
    """
    Classify incident severity using a deterministic, explainable rule-based engine.
    Returns: (severity_level, severity_score, reasons_list)
    """
    code = (category_code or "OTHER").strip().upper()
    cat_name = CATEGORY_DISPLAY.get(code, code.title())
    base_score = CATEGORY_BASE.get(code, 10)

    score = base_score
    reasons: list[str] = [f"{cat_name} base +{base_score}"]

    # 1. People points
    pp = calculate_people_points(people)
    if pp > 0:
        score += pp
        reasons.append(f"{people} people affected +{pp}")

    # 2. Keyword analysis (case-insensitive on title + description)
    text = f"{title or ''} {description or ''}".lower()

    # Critical keywords: +25 each, capped at +40 total
    matched_crit = [k for k in CRITICAL_KEYWORDS if k in text]
    crit_remaining = 40
    for kw in matched_crit:
        pts = min(25, crit_remaining)
        if pts > 0:
            score += pts
            crit_remaining -= pts
            reasons.append(f"keyword '{kw}' +{pts}")
        else:
            reasons.append(f"keyword '{kw}' (max critical bonus reached)")

    # Serious keywords: +10 each, capped at +20 total
    matched_ser = [k for k in SERIOUS_KEYWORDS if k in text]
    ser_remaining = 20
    for kw in matched_ser:
        pts = min(10, ser_remaining)
        if pts > 0:
            score += pts
            ser_remaining -= pts
            reasons.append(f"keyword '{kw}' +{pts}")
        else:
            reasons.append(f"keyword '{kw}' (max serious bonus reached)")

    # Score capped at 100
    score = min(score, 100)

    # 3. Base severity level from score
    if score < 30:
        level = "Low"
    elif score < 55:
        level = "Medium"
    elif score < 80:
        level = "High"
    else:
        level = "Critical"

    # 4. Hard override: if people >= 5 and text contains any of [not breathing, explosion, trapped] -> Critical
    if people >= 5 and any(kw in text for kw in HARD_OVERRIDE_KEYWORDS):
        level = "Critical"
        reasons.append("override: life-threat keyword with 5+ people")

    return level, score, reasons
