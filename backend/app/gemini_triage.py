import json
import os
from pathlib import Path
import urllib.request
import urllib.error
from typing import Optional

# ---------------------------------------------------------------------------
# Load API Key from backend/.env or system environment
# ---------------------------------------------------------------------------
def _load_api_key() -> str:
    key = os.getenv("GEMINI_API_KEY", "")
    if key:
        return key.strip()

    # Look for .env in current and parent directory
    base_dir = Path(__file__).resolve().parent.parent
    env_file = base_dir / ".env"
    if env_file.exists():
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("GEMINI_API_KEY="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


GEMINI_API_KEY = _load_api_key()
PRIMARY_MODEL = "gemini-3.5-flash-lite"

SYSTEM_PROMPT = """You are an Emergency Triage AI for a municipal disaster management platform.
Analyze the incident and classify severity strictly into one of: Low, Medium, High, Critical.
Reply ONLY with a valid JSON object matching this schema:
{
  "severity": "Low" | "Medium" | "High" | "Critical",
  "confidence": float,
  "severity_score": int,
  "summary": "1-2 sentence assessment",
  "extracted_hazards": ["detected hazard 1", "hazard 2"],
  "recommended_dispatch": ["units to deploy"],
  "reasons": ["rule explanation 1", "rule explanation 2"]
}
Triage Rules:
- Critical (80-100): Imminent death threat, people trapped, collapsed buildings, explosion, toxic gas leak, respiratory arrest, major trauma, multiple casualties.
- High (55-79): Serious injury, spreading fire, rapidly rising water, severe burns, bone fractures.
- Medium (30-54): Minor vehicle collision, localized situation, stable patients, non-spreading incidents.
- Low (0-29): Isolated non-urgent requests, mild symptoms, minor property queries.
"""


def call_gemini_flash_lite(
    category_code: str,
    people: int,
    title: str,
    description: str,
) -> Optional[dict]:
    """Call Google Gemini 3.5 Flash Lite using structured JSON generation."""
    api_key = _load_api_key()
    if not api_key:
        return None

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{PRIMARY_MODEL}:generateContent?key={api_key}"
    prompt_text = (
        f"{SYSTEM_PROMPT}\n\n"
        f"--- INCIDENT REPORT ---\n"
        f"Category: {category_code}\n"
        f"People Affected: {people}\n"
        f"Title: {title}\n"
        f"Description: {description}\n"
    )

    payload = {
        "contents": [{"parts": [{"text": prompt_text}]}],
        "generationConfig": {
            "response_mime_type": "application/json",
            "temperature": 0.1,
        },
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=5.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            candidate = data.get("candidates", [])[0]
            raw_text = candidate["content"]["parts"][0]["text"]
            parsed = json.loads(raw_text)

            # Ensure valid severity string
            valid_sevs = {"Low", "Medium", "High", "Critical"}
            sev = parsed.get("severity", "Medium").title()
            if sev not in valid_sevs:
                sev = "Medium"

            return {
                "model": f"Google Gemini Flash Lite ({PRIMARY_MODEL})",
                "severity": sev,
                "confidence": float(parsed.get("confidence", 0.95)),
                "severity_score": int(parsed.get("severity_score", 75)),
                "summary": str(parsed.get("summary", "Emergency incident evaluated by AI.")),
                "extracted_hazards": list(parsed.get("extracted_hazards", [])),
                "recommended_dispatch": list(parsed.get("recommended_dispatch", ["Emergency Response Unit"])),
                "reasons": list(parsed.get("reasons", [f"Evaluated by {PRIMARY_MODEL}"])),
            }
    except Exception as e:
        # Fallback will seamlessly take over
        return None


def fallback_semantic_triage(
    category_code: str,
    people: int,
    title: str,
    description: str,
) -> dict:
    """Local offline safety fallback to ensure 100% demo uptime."""
    from .severity import classify

    level, score, reasons = classify(category_code, people, title, description)

    hazards = []
    text = f"{title} {description}".lower()
    for kw in ["trapped", "fire", "explosion", "gas leak", "water", "injured"]:
        if kw in text:
            hazards.append(f"Detected keyword hazard: {kw}")

    if not hazards:
        hazards.append("Localized emergency signal")

    dispatch = ["Municipal Quick Response Team"]
    if level == "Critical":
        dispatch = ["Heavy Rescue Taskforce", "ALS Paramedic Ambulance"]
    elif level == "High":
        dispatch = ["Fire & Rescue Services", "Emergency Ambulance"]

    return {
        "model": "Local Semantic Triage Engine (Offline Fallback)",
        "severity": level,
        "confidence": 0.92,
        "severity_score": score,
        "summary": f"{level.upper()} PRIORITY: {title}. Automatic safety triage applied.",
        "extracted_hazards": hazards,
        "recommended_dispatch": dispatch,
        "reasons": reasons,
    }


def classify_with_gemini(
    category_code: str,
    people: int,
    title: str,
    description: str,
) -> dict:
    """
    Main entry point:
    1. Tries Gemini 3.5 Flash Lite live.
    2. Seamlessly falls back to local semantic engine if network/API drops.
    """
    res = call_gemini_flash_lite(category_code, people, title, description)
    if res and res.get("severity"):
        return res
    return fallback_semantic_triage(category_code, people, title, description)
