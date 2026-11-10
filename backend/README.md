# ResQNet — Emergency Response & Disaster Management Platform
## Backend API (v2 Trust Layer)

FastAPI backend for **Code Clash 2026** — Emergency Response & Disaster Management Platform.

## Stack
- **Framework**: Python 3.11+, FastAPI, Uvicorn
- **ORM / Database**: SQLAlchemy 2.0 (sync), SQLite (`emergency.db`)
- **Validation**: Pydantic v2
- **Triage Engine**: Deterministic explainable severity scoring (0–100) + Google Gemini Flash Lite
- **Trust Layer**: Sliding-window rate limiting, Honeypot, Nominatim geocoding, Gemini LLM plausibility, Corroboration Engine, and Trust Scoring (0–100)
- **Documentation**: Interactive OpenAPI Swagger documentation at `/docs`

---

## Quick Start

### 1. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Environment Setup
Copy `.env.example` to `.env` and insert your Gemini API key:
```bash
cp .env.example .env
```

### 3. Run the Server
```bash
python -m uvicorn app.main:app --reload --port 8000
```

> **Note on Database**: Since there are no migrations, delete `emergency.db` if upgrading from v1. The database tables and seed dataset (corroborated clusters, duplicates, suspicious reports, and verified incidents) are automatically created on startup.

- **API Base URL**: `http://localhost:8000/api`
- **Interactive Swagger Docs**: `http://localhost:8000/docs`

---

## Seeded Admin Credentials

| Role  | Email                 | Password   |
|-------|-----------------------|------------|
| Admin | `admin@codeclash.dev` | `admin123` |

---

## Trust Layer Curl Test Plan

### Test 1: Rate Limiting (4th Request from Same Device Returns HTTP 429)
Submit 4 quick reports using the same `X-Device-Id` header:

```bash
# 1st Report (Allowed 201)
curl -s -X POST http://localhost:8000/api/incidents \
  -H "Content-Type: application/json" -H "X-Device-Id: dev-flood-user-1" \
  -d '{"title":"Street flooded","description":"Water logging on street","category_code":"FLOOD","location":"Velachery"}'

# 2nd Report (Allowed 201)
curl -s -X POST http://localhost:8000/api/incidents \
  -H "Content-Type: application/json" -H "X-Device-Id: dev-flood-user-1" \
  -d '{"title":"Street flooded again","description":"Water rising more","category_code":"FLOOD","location":"Velachery"}'

# 3rd Report (Allowed 201)
curl -s -X POST http://localhost:8000/api/incidents \
  -H "Content-Type: application/json" -H "X-Device-Id: dev-flood-user-1" \
  -d '{"title":"Still flooded","description":"Water entering house","category_code":"FLOOD","location":"Velachery"}'

# 4th Report -> Triggers HTTP 429 Too Many Requests
curl -i -X POST http://localhost:8000/api/incidents \
  -H "Content-Type: application/json" -H "X-Device-Id: dev-flood-user-1" \
  -d '{"title":"Excessive report","description":"Fourth report attempt","category_code":"FLOOD","location":"Velachery"}'
```
*Expected: HTTP 429 with `Retry-After: 600` and `{"detail": "Too many reports from this device. If this is a real emergency, call 112."}`.*

---

### Test 2: Obvious Gibberish / Spam Ends Up "Suspicious" (Trust < 30)
```bash
curl -s -X POST http://localhost:8000/api/incidents \
  -H "Content-Type: application/json" \
  -d '{"title":"test asdf","description":"asdf test 123","category_code":"OTHER","location":"unknown"}'
```
*Expected: Returns incident with `trust_score < 30` and `verification_status: "Unverified"` with AI flags indicating spam/test.*

---

### Test 3: Two Nearby Flood Reports from Different Devices Become "Corroborated"
```bash
# First report from Device A
curl -s -X POST http://localhost:8000/api/incidents \
  -H "Content-Type: application/json" -H "X-Device-Id: citizen-alpha" \
  -d '{
    "title": "Severe flooding on main road",
    "description": "Lake overflow inundating houses, water reaching waist height",
    "category_code": "FLOOD",
    "location": "Ram Nagar Main Road, Velachery, Chennai",
    "latitude": 12.9815, "longitude": 80.2180,
    "location_accuracy_m": 30.0, "location_source": "gps",
    "people_affected": 25, "contact_phone": "9840112233"
  }'

# Second report from Device B (within 200m and 10 minutes)
curl -s -X POST http://localhost:8000/api/incidents \
  -H "Content-Type: application/json" -H "X-Device-Id: citizen-beta" \
  -d '{
    "title": "Flooding near park street",
    "description": "Rising water in residential apartments, vehicles submerged",
    "category_code": "FLOOD",
    "location": "Ram Nagar 4th Cross, Velachery, Chennai",
    "latitude": 12.9822, "longitude": 80.2188,
    "location_accuracy_m": 45.0, "location_source": "gps",
    "people_affected": 30, "contact_phone": "9840223344"
  }'
```
*Expected: The Corroboration Engine links both reports into a cluster (`cluster_size: 2`), bumps both to `verification_status: "Corroborated"`, awards a `+25` trust bonus, and sets `cluster_people_affected: 30`.*

---

### Test 4: Admin Cluster View & Incident Relations
```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@codeclash.dev","password":"admin123"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# 1. Cluster view (one row per incident cluster root)
curl -s -X GET "http://localhost:8000/api/incidents?group=cluster" -H "Authorization: Bearer $TOKEN"

# 2. View corroborating and duplicate relations for Incident 1
curl -s -X GET "http://localhost:8000/api/incidents/1/related" -H "Authorization: Bearer $TOKEN"

# 3. Mark incident as Verified (bumps reputation and trust)
curl -s -X PATCH "http://localhost:8000/api/incidents/1/verify" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"verification_status": "Verified", "note": "Verified by ground response team"}'
```
