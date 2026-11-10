from typing import Optional


def get_trust_band(score: int) -> str:
    """Return UI human-readable band for trust score."""
    if score < 30:
        return "Suspicious"
    elif score < 70:
        return "Unverified"
    else:
        return "Likely genuine"


def compute_trust(
    phone_given: bool = False,
    location_accuracy_m: Optional[float] = None,
    corroborating_count: int = 0,
    llm_assessment: Optional[dict] = None,
    location_mismatch_km: Optional[float] = None,
    past_verified_count: int = 0,
    past_false_alarm_count: int = 0,
    description_length: int = 0,
    is_duplicate: bool = False,
    duplicate_ref: Optional[str] = None,
) -> tuple[int, list[str]]:
    """
    Compute explainable, deterministic trust score between 0 and 100.
    Returns (trust_score, reasons_list).
    """
    score = 50
    reasons: list[str] = ["Baseline unverified trust: 50"]

    # 1. Contact phone
    if phone_given:
        score += 15
        reasons.append("Contact phone verified +15")

    # 2. GPS location accuracy
    if location_accuracy_m is not None:
        if location_accuracy_m <= 100:
            score += 15
            reasons.append(f"High-precision GPS accuracy (±{int(location_accuracy_m)}m) +15")
        elif location_accuracy_m <= 1000:
            score += 5
            reasons.append(f"Moderate GPS accuracy (±{int(location_accuracy_m)}m) +5")

    # 3. Corroborating reports (Strongest signal)
    if corroborating_count > 0:
        bonus = 25 + max(0, min(20, (corroborating_count - 1) * 10))
        score += bonus
        reasons.append(f"Corroborated by {corroborating_count} nearby independent report(s) +{bonus}")

    # 4. Duplicate penalty
    if is_duplicate:
        score -= 5
        dup_text = f" of {duplicate_ref}" if duplicate_ref else ""
        reasons.append(f"Possible duplicate report{dup_text} -5")

    # 5. LLM Plausibility signals
    if llm_assessment and "error" not in llm_assessment:
        plausible = llm_assessment.get("plausible", True)
        confidence = float(llm_assessment.get("confidence", 0.0))
        gibberish = llm_assessment.get("gibberish_or_test", False)
        cat_matches = llm_assessment.get("category_matches", True)

        if gibberish:
            score -= 30
            reasons.append("AI flagged report as gibberish, spam or test -30")
        elif not plausible:
            score -= 20
            reasons.append("AI flagged report text as implausible -20")
        elif plausible and confidence >= 0.6:
            score += 10
            reasons.append("AI verified plausible emergency description +10")

        if not cat_matches:
            sugg = llm_assessment.get("suggested_category", "")
            sugg_str = f" (suggested: {sugg})" if sugg else ""
            score -= 10
            reasons.append(f"AI category mismatch detected{sugg_str} -10")

    # 6. Location mismatch (> 5 km)
    if location_mismatch_km is not None and location_mismatch_km > 5.0:
        score -= 15
        reasons.append(f"Location mismatch: GPS is {location_mismatch_km}km from address -15")

    # 7. Reporter reputation history
    if past_false_alarm_count > 0:
        penalty = min(40, past_false_alarm_count * 20)
        score -= penalty
        reasons.append(f"Device history: {past_false_alarm_count} past false alarms -{penalty}")

    if past_verified_count > 0:
        bonus = min(15, past_verified_count * 5)
        score += bonus
        reasons.append(f"Device history: {past_verified_count} past verified reports +{bonus}")

    # 8. Description length penalty (< 15 chars)
    if description_length < 15:
        score -= 10
        reasons.append("Very brief description (<15 chars) -10")

    final_score = max(0, min(100, score))
    return final_score, reasons


# ---------------------------------------------------------------------------
# Unit Tests
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("--- Running Trust Engine Unit Tests ---")

    # Case 1: Genuine GPS + phone
    s1, r1 = compute_trust(phone_given=True, location_accuracy_m=42.0, description_length=80)
    assert s1 == 80  # 50 + 15 + 15
    assert get_trust_band(s1) == "Likely genuine"
    print(f"[PASS] Genuine GPS + Phone: Score {s1} ({get_trust_band(s1)})")

    # Case 2: Corroborated pair
    s2, r2 = compute_trust(corroborating_count=2, description_length=50)
    assert s2 == 85  # 50 + 35
    assert get_trust_band(s2) == "Likely genuine"
    print(f"[PASS] Corroborated pair: Score {s2} ({get_trust_band(s2)})")

    # Case 3: Gibberish
    llm_gib = {"gibberish_or_test": True, "plausible": False, "confidence": 0.9}
    s3, r3 = compute_trust(llm_assessment=llm_gib, description_length=10)
    assert s3 == 10  # 50 - 30 - 10
    assert get_trust_band(s3) == "Suspicious"
    print(f"[PASS] Gibberish report: Score {s3} ({get_trust_band(s3)})")

    # Case 4: Location mismatch
    s4, r4 = compute_trust(location_mismatch_km=12.4, description_length=40)
    assert s4 == 35  # 50 - 15
    assert get_trust_band(s4) == "Unverified"
    print(f"[PASS] Location mismatch > 5km: Score {s4} ({get_trust_band(s4)})")

    print("ALL TRUST ENGINE UNIT TESTS PASSED! 🚀")
