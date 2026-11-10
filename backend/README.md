# Emergency Response & Disaster Management Platform — Backend API

FastAPI backend for **Code Clash 2026 Round 1** — Emergency Response & Disaster Management Platform.

## Stack
- **Framework**: Python 3.11+, FastAPI, Uvicorn
- **ORM / Database**: SQLAlchemy 2.0 (sync), SQLite (`emergency.db`)
- **Validation**: Pydantic v2
- **Triage Engine**: Rule-based explainable severity scoring (0–100)
- **Documentation**: Interactive OpenAPI Swagger documentation at `/docs`

---

## Quick Start

### 1. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Run the Server
```bash
uvicorn app.main:app --reload --port 8000
```

The database tables and initial seed data (6 categories, admin user, 12 realistic Chennai demo incidents) are automatically created on startup.

- **API Base URL**: `http://localhost:8000/api`
- **Interactive Swagger Docs**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

---

## Seeded Admin Credentials

| Role  | Email                 | Password   |
|-------|-----------------------|------------|
| Admin | `admin@codeclash.dev` | `admin123` |

Obtain an auth token by calling `POST /api/auth/login`.

---

## Quick curl Example: Report an Emergency

```bash
curl -X POST http://localhost:8000/api/incidents \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Building collapsed near bus stand",
    "description": "3-storey commercial building collapsed, people trapped under debris",
    "category_code": "COLLAPSE",
    "location": "Vandalur Main Rd, Chennai",
    "latitude": 12.8923,
    "longitude": 80.0810,
    "people_affected": 10,
    "contact_name": "Ravi",
    "contact_phone": "9840123456",
    "contact_email": "ravi@example.com"
  }'
```

---

## 5-Step End-to-End Test Plan (curl Commands)

### Step 1: Admin Login (Obtain Token)
```bash
curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@codeclash.dev", "password": "admin123"}'
```
*Expected: Returns JSON with `"token": "<token_hex>"` and admin user info.*

---

### Step 2: Create a New Incident (Public Report)
```bash
curl -s -X POST http://localhost:8000/api/incidents \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Heavy smoke and fire spreading in warehouse",
    "description": "Industrial warehouse on fire with heavy smoke spreading quickly, 3 workers trapped",
    "category_code": "FIRE",
    "location": "Ambattur Industrial Estate, Chennai",
    "people_affected": 3,
    "contact_name": "Security Guard",
    "contact_phone": "9840998877"
  }'
```
*Expected: 201 Created with auto-generated `ref_code` (e.g. `ER-2026-0013`), calculated severity `Critical` (score 95 with reasons), status `"Reported"`.*

---

### Step 3: List Incidents with Priority Sort (Admin)
Replace `<TOKEN>` with your token from Step 1:
```bash
curl -s -X GET "http://localhost:8000/api/incidents?sort=priority" \
  -H "Authorization: Bearer <TOKEN>"
```
*Expected: Returns list of incidents with active Critical emergencies ranked at the top.*

---

### Step 4: Update Incident Status to "In Progress" (Admin)
Replace `13` with the incident ID and `<TOKEN>` with your token:
```bash
curl -s -X PATCH "http://localhost:8000/api/incidents/13/status" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"status": "In Progress", "note": "Fire brigade and rescue units dispatched"}'
```
*Expected: Updated incident status `"In Progress"`, with a new entry added to status audit history.*

---

### Step 5: Fetch Dashboard Aggregated Statistics (Admin)
Replace `<TOKEN>` with your token:
```bash
curl -s -X GET "http://localhost:8000/api/dashboard/stats" \
  -H "Authorization: Bearer <TOKEN>"
```
*Expected: Returns total counts, critical_active, counts by status, counts by severity, all 6 category breakdowns, and recent unresolved critical items.*

---

### Step 6: Delete Incident (Admin Cleanup)
Replace `13` with the incident ID and `<TOKEN>` with your token:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE "http://localhost:8000/api/incidents/13" \
  -H "Authorization: Bearer <TOKEN>"
```
*Expected: HTTP 204 No Content. Deletion cascades to status history records.*
