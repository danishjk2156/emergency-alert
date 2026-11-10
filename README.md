# 🚨 ResQNet

> **Emergency Incident Reporting, Explainable Severity & Trust Triage, Spatial Corroboration, and Nearest-Team Dispatch Platform.**

![Python](https://img.shields.io/badge/python-3.10%2B-blue.svg)
![FastAPI](https://img.shields.io/badge/backend-FastAPI-009688.svg)
![React](https://img.shields.io/badge/react-18.3-61DAFB.svg)
![Vite](https://img.shields.io/badge/vite-6.0-646CFF.svg)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-3.4-38B2AC.svg)
![SQLite](https://img.shields.io/badge/database-SQLite%20%7C%20SQLAlchemy-003B57.svg)
![Leaflet](https://img.shields.io/badge/maps-Leaflet%20%7C%20OSRM-199900.svg)
![Hackathon](https://img.shields.io/badge/Code%20Clash-2026-D7191F.svg)

---

## 📌 Problem Statement

When a city faces a fire, flood, building collapse or road pile-up, the emergency control room is flooded with reports at the exact moment it has the least time to read them. Conventional phone-and-spreadsheet intake breaks down in four ways:

1. **First-come, first-served queues:** Reports are handled in arrival order, so a building collapse with people trapped can wait behind a minor complaint that happened to arrive first. Nothing ranks incidents by severity, people affected, waiting time and hazard type.
2. **Spam, hoaxes and repeat submissions:** Public reporting channels attract prank reports, bots and panicked people who submit the same report five times. Without rate limits, device reputation and plausibility checks, dispatchers spend scarce minutes chasing noise.
3. **Fragmented situational awareness:** When twenty bystanders report the same fire, the dispatcher sees twenty unrelated tickets. Nobody links them, adds up the people affected, or notices that independent witnesses make the event *more* credible.
4. **Slow, manual dispatch:** Once an incident is understood, someone still has to work out which units are free, which are suitable for this kind of emergency, and which is closest — then track the incident until it is resolved while keeping unit availability up to date.

**ResQNet** closes this loop in a single web platform. Citizens report from any phone browser — anonymously or signed in — with GPS location. Every report is scored by a **deterministic, explainable severity engine**, checked for plausibility by **Google Gemini** (with an offline fallback), and given a **trust score** built from GPS precision, contact details, device history and **independent corroborating reports** found by a spatial-temporal clustering engine. Dispatchers work from a **live priority queue**, see the **nearest suitable available team** with distance and ETA, assign it in one click, track the incident through **Reported → Assigned → In Progress → Resolved**, and watch everything on a **live map with road routes** and an **analytics dashboard**.

---

## 🚀 Features

### Round 2 — Required Features

| # | Feature | Subsystem | Mechanism | Output | Status |
|---|---|---|---|---|---|
| 1 | **Intelligent Incident Prioritization** | Priority Engine (`services/priority.py`, `PriorityQueue.jsx`) | Live, time-aware weighted score: `0.35·severity + 0.25·people + 0.20·time + 0.20·category`, computed on every read so waiting incidents escalate. | Ranked queue with Critical / High / Medium / Low label, 0–100 score and per-factor breakdown tooltip. Auto-refreshes every 30 s. | ✅ Integrated |
| 2 | **Emergency Response Team Management** | Teams API (`routers/teams.py`, `TeamsPage.jsx`) | CRUD for units with code, name, category (Fire / Medical / Rescue / Police), depot coordinates picked on a map, Available/Busy toggle and current assigned incident. | Filterable team table (category, availability) with links to the assigned incident. | ✅ Integrated |
| 3 | **Location-Based Team Assignment** | Dispatch (`/incidents/{id}/nearest-teams`, `/assign`, `AssignmentPanel.jsx`) | Category → suitable team mapping, Haversine distance from depot to incident, ETA at 40 km/h; manual pick or auto-assign nearest. | Nearest teams list with km, ETA and a *Recommended* badge; one-click **Auto-Assign Nearest**. | ✅ Integrated |
| 4 | **Assignment & Incident Tracking** | Lifecycle (`PATCH /incidents/{id}/status`, `AssignmentPanel.jsx`) | Enforced state machine `Reported → Assigned → In Progress → Resolved` (+ False Alarm); team set Busy on assign and freed on resolve; every change logged. | 4-step lifecycle stepper, assigned team card (distance/ETA), audit timeline. | ✅ Integrated |
| 5 | **Route & Location Visualization** | Map (`MapView.jsx`, `MapPage.jsx`) | React-Leaflet map of incidents (coloured by priority) and teams; OSRM road route from assigned team to incident, falling back to a straight line. | Live map with layer toggles, legend, route polylines and distance/ETA labels. | ✅ Integrated |
| 6 | **Advanced Analytics Dashboard** | Analytics (`routers/analytics.py`, `DashboardPage.jsx`) | Aggregates over non-duplicate incidents and teams; 7-day intake series. | KPI cards (total, critical, available teams, busy teams, assigned, resolved), category donut, status bar chart, 7-day trend line. | ✅ Integrated |

### Round 1 & Trust Layer

| Feature | Subsystem | Mechanism | Output |
|---|---|---|---|
| **Citizen Emergency Reporting** | `ReportPage.jsx`, `POST /api/incidents` | Category tiles, people-affected stepper, browser GPS capture, optional contact details, anonymous toggle, live client-side severity preview with safety tips. | Reference code `ER-2026-XXXX` and a confirmation page. |
| **Explainable Severity Triage** | `severity.py` / `severity.js` | Category base weight + people points + capped critical/serious keyword bonuses + hard life-threat override. | Level (Low → Critical), 0–100 score and human-readable reasons. |
| **AI Plausibility Check** | `llm.py`, `gemini_triage.py`, `LlmInsight.jsx` | Gemini (`gemini-3.5-flash-lite`, falling back to older Flash models) judges plausibility, gibberish/test content and category match, with a 6 s timeout. | Verdict + confidence shown to the admin; feeds the trust score. Skipped cleanly without an API key. |
| **Spatial-Temporal Corroboration** | `corroboration.py`, `RelatedReports.jsx`, `ClusterPill.jsx` | Reports within **500 m** (or ≥ 60 % address-token similarity) and **±30 min** are compared; independent reporters corroborate, same-device or copy-pasted reports become duplicates. | Clusters with combined people affected, severity escalation, *Corroborated* badges and related-report lists. |
| **Multi-Factor Trust Score** | `trust.py`, `TrustMeter.jsx` | Starts at 50; adjusted by phone, GPS accuracy, corroboration, AI verdict, GPS-vs-address mismatch, device history and description length. | 0–100 score with reasons and band (*Suspicious* / *Unverified* / *Likely genuine*). |
| **Abuse Protection** | `rate_limit.py`, honeypot field | Sliding-window limits per device (3 / 10 min), per IP (10 / 10 min) and globally (60 / min); hidden `website` honeypot; salted SHA-256 device/IP hashes. | HTTP 429 with `Retry-After`; frontend shows a countdown. |
| **Admin Verification** | `PATCH /incidents/{id}/verify` | Admin marks *Verified* or *False Alarm*; updates the reporting device's reputation used in future trust scores. | Verification badge and adjusted reporter history. |
| **Public Tracking** | `TrackPage.jsx`, `GET /incidents/track/{ref}` | Lookup by reference code — no login needed. | Status progress, severity and trust summary. |
| **Incident Management** | `IncidentsPage.jsx`, `IncidentDetailPage.jsx` | Search, filters (status, severity, category, verification), sorting, pagination, severity override, delete, status changes limited to legal transitions. | Full admin console with timeline and location panel. |
| **Offline Demo Mode** | `mock.js` | In-browser mock backend implementing every endpoint with seeded Chennai data. | `npm run dev:mock` runs the whole UI without Python. |

---

## 🏗️ Tech Stack

### Frontend Client
| Component | Version | Role in Architecture | Technical Rationale |
|---|---|---|---|
| **React** | `^18.3.1` | Single-page application | Hook-based components for the citizen portal and the admin console. |
| **Vite** | `^6.0.7` | Dev server & bundler | Instant HMR in development; `--mode mock` switches the API layer to the in-browser mock. |
| **React Router** | `^6.28.0` | Routing & guards | Separate public (`/report`, `/track`) and admin (`/admin/*`) trees; admin routes require the admin role. |
| **Tailwind CSS** | `^3.4.17` | Styling | Utility-first, mobile-first layouts with emergency colour tokens for severity and status. |
| **Leaflet + React-Leaflet** | `^1.9.4` / `^4.2.1` | Maps | OpenStreetMap tiles, custom `divIcon` markers, polylines for dispatch routes, click-to-pick depot locations. |
| **Recharts** | `^2.15.0` | Charts | Donut, bar and line charts on the analytics dashboard. |
| **oxlint** | `^1.90.0` | Linting | Fast lint pass over `src/`. |

### Backend Services
| Component | Version | Role in Architecture | Technical Rationale |
|---|---|---|---|
| **Python** | `3.10+` | Runtime | Type hints throughout; tested on 3.11. |
| **FastAPI** | latest (unpinned) | REST API | Pydantic validation, dependency-injected auth and rate limiting, `BackgroundTasks` for enrichment, auto-generated `/docs`. |
| **Uvicorn** | latest (`uvicorn[standard]`) | ASGI server | Hot reload in development. |
| **SQLAlchemy** | latest (unpinned) | ORM | Declarative models for incidents, teams, users, status history and reporter reputation. |
| **Pydantic v2** | via FastAPI | Data contracts | Request validation with field-level error messages turned into readable 422 responses. |
| **Google Gemini API** | `gemini-3.5-flash-lite` (+ fallbacks) | AI plausibility | Optional; called over HTTPS with a hard timeout so reporting never waits on the AI. |

### Storage & External Services
| Component | Role in Architecture | Technical Rationale |
|---|---|---|
| **SQLite** (`emergency.db`) | Primary database | Zero-setup file database, created and seeded on first start; missing columns are added automatically on upgrade. |
| **In-memory sliding windows** | Rate limiting & sessions | `collections.deque` windows per device/IP/global; bearer tokens held in memory. |
| **OpenStreetMap Nominatim** | Geocoding | Reverse geocoding of GPS-only reports and GPS-vs-typed-address mismatch checks (self-throttled). |
| **OSRM public router** | Road routing | Driving route geometry and duration between a team and its incident on the map. |

---

## 📂 Project Structure

```
cobotex/
├── backend/
│   ├── app/
│   │   ├── routers/
│   │   │   ├── auth.py            # POST /auth/login → bearer token
│   │   │   ├── categories.py      # GET /categories (codes, names, base weights)
│   │   │   ├── dashboard.py       # GET /dashboard/stats (status/severity/category/trust counts)
│   │   │   ├── incidents.py       # Report intake, tracking, list/detail, status, verify, severity,
│   │   │   │                      #   related reports, prioritized queue, nearest teams, assign/unassign
│   │   │   ├── teams.py           # Response team CRUD + availability toggle
│   │   │   └── analytics.py       # GET /analytics/summary (KPIs, breakdowns, 7-day trend)
│   │   ├── services/
│   │   │   └── priority.py        # Live priority scoring engine (score, label, breakdown)
│   │   ├── auth.py                # Salted SHA-256 password hashing, token store, require_admin
│   │   ├── corroboration.py       # Spatial-temporal clustering, duplicates, cluster escalation
│   │   ├── database.py            # SQLAlchemy engine/session (sqlite:///./emergency.db)
│   │   ├── enrich.py              # Background enrichment: geocoding, AI check, re-cluster, re-score
│   │   ├── gemini_triage.py       # Gemini classification for /incidents/ai-classify (+ offline fallback)
│   │   ├── geo.py                 # Haversine distance, Nominatim reverse/forward geocoding, mismatch
│   │   ├── llm.py                 # Gemini plausibility check with model fallbacks and timeout
│   │   ├── models.py              # ORM: Category, User, Incident, ResponseTeam, StatusHistory, Reputation
│   │   ├── rate_limit.py          # Device/IP/global sliding-window limits, salted identifier hashing
│   │   ├── schemas.py             # Pydantic request/response models and validators
│   │   ├── seed.py                # Categories, admin user, 10 Chennai teams, 12 sample incidents
│   │   ├── severity.py            # Deterministic, explainable severity classifier
│   │   ├── trust.py               # Explainable trust scoring (+ runnable self-tests)
│   │   └── main.py                # App factory, CORS, error handler, startup migration + seeding
│   ├── requirements.txt
│   ├── .env.example               # Gemini key, salts, rate-limit and corroboration tuning
│   └── README.md                  # Backend API reference
│
├── frontend/
│   ├── index.html                 # App shell
│   ├── public/favicon.svg
│   ├── src/
│   │   ├── api.js                 # One request helper + one function per endpoint; normalizes
│   │   │                          #   backend shapes (teams, priority breakdown, analytics)
│   │   ├── mock.js                # In-browser mock backend for `npm run dev:mock`
│   │   ├── constants.js           # Statuses, lifecycle transitions, team categories, styles, tips
│   │   ├── severity.js            # Client-side severity preview (mirrors severity.py)
│   │   ├── auth.jsx               # Session context (token + role)
│   │   ├── hooks/useGeolocation.js
│   │   ├── lib/device.js          # Random per-browser device ID sent as X-Device-Id
│   │   ├── components/
│   │   │   ├── PriorityQueue.jsx  # Ranked dispatch queue with score breakdown
│   │   │   ├── AssignmentPanel.jsx# Nearest teams, auto-assign, lifecycle stepper
│   │   │   ├── MapView.jsx        # Leaflet map, markers, OSRM routes
│   │   │   ├── TrustMeter.jsx, VerificationBadge.jsx, LlmInsight.jsx,
│   │   │   ├── RelatedReports.jsx, ClusterPill.jsx, LocationInfo.jsx,
│   │   │   ├── IncidentTable.jsx, Timeline.jsx, CriticalBanner.jsx, StatCard.jsx,
│   │   │   └── AdminLayout.jsx, PublicLayout.jsx, Toast.jsx, ConfirmDialog.jsx, …
│   │   ├── pages/
│   │   │   ├── ReportPage.jsx, ReportSuccessPage.jsx, TrackPage.jsx   # Citizen
│   │   │   ├── UserLoginPage.jsx, RegisterPage.jsx, MyReportsPage.jsx # Citizen accounts
│   │   │   ├── LoginPage.jsx                                         # Admin sign-in
│   │   │   ├── DashboardPage.jsx, IncidentsPage.jsx, IncidentDetailPage.jsx,
│   │   │   └── TeamsPage.jsx, MapPage.jsx                            # Admin console
│   │   ├── App.jsx                # Route table
│   │   └── main.jsx, index.css
│   ├── .env.example               # VITE_API_URL
│   ├── package.json, vite.config.js, tailwind.config.js, postcss.config.js
│
├── docs/server-auth-plan.md       # Design notes for citizen accounts on the server
└── README.md
```

---

## ⚙️ Installation & Setup

### Prerequisites
- **Python** `3.10+` (3.11 recommended)
- **Node.js** `18.x` or `20.x` LTS with `npm`
- **Git**
- Internet access is optional but enables Gemini, Nominatim geocoding, map tiles and OSRM routes.

---

### Step 1: Clone the Repository

```bash
git clone https://github.com/danishjk2156/emergency-alert.git
cd emergency-alert
```

---

### Step 2: Configure Environment Variables (optional)

The backend runs without any configuration. To enable the AI check or tune the trust layer, create `backend/.env`:

```bash
# Linux / macOS
cp backend/.env.example backend/.env

# Windows (PowerShell)
Copy-Item backend/.env.example backend/.env
```

```env
# AI plausibility check (leave unset to skip; rule-based scoring still works)
GEMINI_API_KEY=your_gemini_api_key_here

# Salt for hashing device IDs and IPs
TRUST_SALT=change_me

# Contact sent to Nominatim per its usage policy
NOMINATIM_EMAIL=you@example.com

# Rate limiting
RL_DEVICE_MAX=3          # reports per device per window
RL_IP_MAX=10             # reports per IP per window
RL_WINDOW_SEC=600        # window length (10 minutes)
RL_GLOBAL_PER_MIN=60     # reports per minute across everyone

# Corroboration engine
CORR_WINDOW_MIN=30       # ± minutes to look for related reports
CORR_RADIUS_M=500        # metres
```

To point the frontend at a different backend, create `frontend/.env` with `VITE_API_URL=http://localhost:8000/api`.

---

### Step 3: Backend Setup & Execution

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# Linux / macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the API (creates and seeds emergency.db on first run)
python -m uvicorn app.main:app --reload --port 8000
```

- **API base:** `http://localhost:8000/api`
- **Interactive docs (Swagger):** `http://localhost:8000/docs`
- **Health check:** `http://localhost:8000/api/health`

> Run the server from inside `backend/` so it always uses `backend/emergency.db`. Delete that file and restart for fresh sample data.

---

### Step 4: Frontend Setup & Execution

```bash
cd frontend
npm install

# Option A — full stack (talks to the FastAPI backend)
npm run dev

# Option B — offline demo (in-browser mock backend, no Python needed)
npm run dev:mock
```

- **Citizen portal:** `http://localhost:5173/report`
- **Track a report:** `http://localhost:5173/track`
- **Admin console:** `http://localhost:5173/admin` — sign in with `admin@codeclash.dev` / `admin123`

---

### Step 5: Smoke Test

Submit a report:

```bash
curl -X POST http://localhost:8000/api/incidents \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: smoke-test-device" \
  -d '{
    "category_code": "COLLAPSE",
    "title": "Building collapse near market",
    "description": "Two-storey building collapsed, people trapped under rubble, smell of gas leak.",
    "location": "Guindy Industrial Estate, Chennai",
    "latitude": 13.0067,
    "longitude": 80.2206,
    "location_accuracy_m": 15,
    "people_affected": 8,
    "contact_phone": "9840012345"
  }'
```

**Response (`HTTP 201 Created`, abridged):**
```json
{
  "id": 13,
  "ref_code": "ER-2026-0013",
  "status": "Reported",
  "severity": "Critical",
  "severity_score": 95,
  "severity_reasons": [
    "Building Collapse base +35",
    "8 people affected +20",
    "keyword 'trapped' +25",
    "keyword 'collapsed' +15",
    "keyword 'gas leak' (max critical bonus reached)",
    "override: life-threat keyword with 5+ people"
  ],
  "trust_score": 80,
  "verification_status": "Unverified"
}
```

Then dispatch it (replace `<TOKEN>` with the `token` from `POST /api/auth/login`):

```bash
curl -X POST http://localhost:8000/api/incidents/13/assign \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d '{}'
```

The nearest available Rescue or Fire team is assigned, the incident moves to `Assigned`, and the team turns `Busy`.

---

## 🧠 How It Works

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              RESQNET PIPELINE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  STAGE 1: CITIZEN INTAKE & ABUSE FILTERING                                  │
│                                                                             │
│  Phone browser ➔ GPS (lat/lng + accuracy) ➔ POST /api/incidents             │
│               ➔ Rate limits (device 3/10min · IP 10/10min · global 60/min)  │
│               ➔ Honeypot check ➔ Pydantic validation                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  STAGE 2: SEVERITY, CORROBORATION & TRUST (synchronous, on save)            │
│                                                                             │
│  Severity rules (category + people + keywords + override)                   │
│               ➔ Corroboration (500 m · ±30 min · independence checks)       │
│               ➔ Trust score (phone, GPS, corroboration, device history)     │
│               ➔ Reference code ER-2026-XXXX returned to the citizen         │
├─────────────────────────────────────────────────────────────────────────────┤
│  STAGE 3: BACKGROUND ENRICHMENT (FastAPI BackgroundTasks)                   │
│                                                                             │
│  Nominatim geocoding / GPS-vs-address mismatch                              │
│               ➔ Gemini plausibility check (6 s timeout, optional)           │
│               ➔ Re-run corroboration ➔ Re-compute trust score               │
├─────────────────────────────────────────────────────────────────────────────┤
│  STAGE 4: PRIORITIZATION, DISPATCH & TRACKING                               │
│                                                                             │
│  Live priority queue (recomputed per request, UI polls every 30 s)          │
│               ➔ Nearest suitable available team (Haversine + ETA)           │
│               ➔ Assign ➔ Assigned ➔ In Progress ➔ Resolved (team freed)     │
│               ➔ Live map with OSRM routes · Analytics dashboard             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 1. Citizen Intake & Abuse Filtering
1. **No-friction reporting:** `/report` works on any phone browser without an account. The citizen picks a category, describes the emergency, sets people affected and either shares GPS or types an address. A live severity preview (the same rules as the server, in `severity.js`) shows how the report will be triaged, together with category-specific safety tips.
2. **Device identity without tracking people:** The browser generates a random device ID (`lib/device.js`) sent as `X-Device-Id`. The server never stores it raw — device IDs and IPs are salted and SHA-256 hashed (`rate_limit.py`).
3. **Sliding-window rate limits:** Per device (3 per 10 min), per IP (10 per 10 min) and globally (60 per minute). Exceeding a limit returns **HTTP 429** with a `Retry-After` header; the UI turns it into a countdown instead of an error.
4. **Honeypot:** The intake schema has a hidden `website` field. If a bot fills it, the API returns a fake `201` and stores nothing.

---

### 2. Explainable Severity Triage
`severity.py` produces a level, a 0–100 score and a list of reasons a dispatcher can read:

$$\text{Score} = \min\big(100,\; \text{Base}_{cat} + P(\text{people}) + K_{crit} + K_{ser}\big)$$

- **Category base:** Collapse 35 · Fire 30 · Flood 25 · Medical 20 · Road 20 · Other 10
- **People points $P$:** ≤1 → 0 · 2–5 → 10 · 6–20 → 20 · 21–50 → 30 · >50 → 40
- **Critical keywords $K_{crit}$** (*trapped, unconscious, not breathing, explosion, collapsed, spreading, heavy bleeding, gas leak, child, drowning*): +25 each, capped at +40
- **Serious keywords $K_{ser}$** (*injured, smoke, rising water, stuck, elderly, burn, fracture, blocked*): +10 each, capped at +20
- **Levels:** <30 Low · 30–54 Medium · 55–79 High · ≥80 Critical
- **Hard override:** 5+ people **and** *not breathing / explosion / trapped* → always **Critical**

---

### 3. Corroboration, AI Check & Trust Score
1. **Candidate search:** For each new report, `corroboration.py` looks at non-duplicate incidents created within **±30 minutes**, pre-filtered to a ~550 m lat/lng box. Two reports are *nearby* if their Haversine distance is ≤ **500 m**:
   $$d = 2R \arcsin\left(\sqrt{\sin^2\tfrac{\Delta\phi}{2} + \cos\phi_1\cos\phi_2\sin^2\tfrac{\Delta\lambda}{2}}\right)$$
   or, when coordinates are missing, if their address tokens have **Jaccard similarity ≥ 0.6** (local stopwords like *road, nagar, near* removed). Categories must match or be a related pair (Fire↔Collapse, Flood↔Collapse).
2. **Independence:** A nearby report only *corroborates* if it comes from a different device, its description is not a near copy (`difflib` ratio < 0.85), and neither reporter has 2+ past false alarms. Otherwise it is marked a **duplicate** of the earliest report.
3. **Clusters:** Corroborating reports share a cluster; the cluster's people affected are combined, the root incident's severity is escalated to the highest member's, and clusters of 3+ get an extra +10 severity score. Members are marked **Corroborated**.
4. **AI plausibility (background):** If `GEMINI_API_KEY` is set, `llm.py` asks Gemini whether the text is plausible, gibberish/test content, and consistent with the chosen category. The call has a 6 s timeout; failures are recorded and the rule-based score is kept.
5. **Trust score** (`trust.py`), starting from 50 and clamped to 0–100:

   | Signal | Effect |
   |---|---|
   | Contact phone given | +15 |
   | GPS accuracy ≤ 100 m / ≤ 1000 m | +15 / +5 |
   | Corroborated by *n* independent reports | +25, plus +10 per extra report (max +45) |
   | Possible duplicate | −5 |
   | AI: plausible with confidence ≥ 0.6 | +10 |
   | AI: implausible / gibberish or test | −20 / −30 |
   | AI: category mismatch | −10 |
   | GPS more than 5 km from typed address | −15 |
   | Device's past false alarms | −20 each (max −40) |
   | Device's past verified reports | +5 each (max +15) |
   | Description under 15 characters | −10 |

   Bands: **<30 Suspicious · 30–69 Unverified · ≥70 Likely genuine.** When an admin marks a report *Verified* or *False Alarm*, the device's reputation is updated and affects all of its future reports.

---

### 4. Prioritization, Dispatch & Tracking
1. **Live priority score** (`services/priority.py`), recomputed on every request so older unresolved incidents rise automatically:
   $$\text{Priority} = 0.35\,S_{sev} + 0.25\,S_{people} + 0.20\,S_{time} + 0.20\,S_{cat}$$
   - $S_{sev}$ = severity score (0–100)
   - $S_{people} = \min(\text{people}/50,\,1)\times 100$ (uses cluster total when available)
   - $S_{time} = \min(\text{minutes open}/120,\,1)\times 100$ (0 once Resolved / False Alarm)
   - $S_{cat}$ = category base weight ÷ 35 × 100
   - Labels: **≥75 Critical · ≥50 High · ≥25 Medium · <25 Low**

   `GET /api/incidents/prioritized` returns active, non-duplicate incidents ranked by this score with the full breakdown, which the queue shows on hover.
2. **Suitable teams:** Each incident category maps to the team types that can respond:

   | Incident | Suitable teams |
   |---|---|
   | Fire | Fire |
   | Medical | Medical |
   | Building Collapse | Rescue, Fire |
   | Flood | Rescue |
   | Road Accident | Medical, Rescue, Police |
   | Other | All |

3. **Nearest team & ETA:** Available suitable teams are sorted by Haversine distance from their depot to the incident; ETA assumes 40 km/h (`ETA = round(km / 40 × 60)`, minimum 1 min). The closest is marked *Recommended*.
4. **Assignment:** `POST /api/incidents/{id}/assign` with a `team_id` (manual) or empty body (auto-nearest) updates incident and team together: incident → `Assigned` with distance and ETA stored, team → `Busy`. A team that is already busy returns **409**, and the UI refreshes the list.
5. **Lifecycle:** The status endpoint only allows `Reported → Assigned → In Progress → Resolved`, plus `False Alarm` from any open state. Resolving or marking false alarm frees the team. Unassigning returns the incident to `Reported` and frees the team. Every transition is written to the status history with the admin and a note.
6. **Map & analytics:** The map draws incidents (coloured by priority), teams (available/busy) and an OSRM road route for each active assignment. The dashboard combines `/analytics/summary` and `/dashboard/stats` and refreshes every 30 s.

---

## 📈 Scalability

ResQNet is built as a single-node hackathon deployment, with clear paths to scale:

1. **Bounded corroboration cost:** Clustering never scans the whole table — it filters by a ±30-minute window and a ~550 m lat/lng box before computing exact distances, so the work per report stays small as history grows.
2. **Non-blocking intake:** Slow network calls (Nominatim, Gemini) run as FastAPI background tasks after the citizen already has their reference code, and Gemini calls have a hard timeout.
3. **Computed-on-read priority:** Priority is derived from stored fields at query time, so there are no scheduled jobs to keep scores fresh.
4. **Thin, normalizing API layer:** The frontend talks to the backend through a single adapter (`api.js`), so the backend can change storage or be split into services without touching the pages.
5. **What to change for multi-instance production:**
   - Move from SQLite to PostgreSQL (SQLAlchemy models are portable; only `database.py` changes).
   - Move rate-limit windows and the bearer-token store from process memory to Redis so several API replicas share them.
   - Self-host Nominatim and OSRM to remove public API rate limits.

---

## 💡 Feasibility

- **Runs on a laptop:** SQLite, no Docker, no message queue. `pip install` + `npm install` and two commands.
- **Works offline-first for demos:** `npm run dev:mock` runs the entire UI with realistic Chennai data and no backend at all.
- **Degrades gracefully:** No Gemini key → rule-based triage only. No internet → no geocoding and straight-line routes instead of road routes. Old database file → missing columns are added on startup.
- **Open-source foundations:** React, FastAPI, SQLAlchemy, Leaflet, OpenStreetMap and OSRM — no paid licences.
- **Citizens need nothing installed:** It is a web page; reporting doesn't require an account.

---

## 🌟 Novelty & Comparative Analysis

### Competitive Matrix

| Capability | ResQNet | Phone + manual logbook | Generic ticketing / forms | Typical CAD system |
|---|---|---|---|---|
| **Triage** | ⚡ Instant rule-based score with readable reasons + optional AI | ⏳ Human judgement per call | ❌ None | ⚠️ Protocol-driven, manual entry |
| **Ranking** | 🧠 Live weighted priority that rises with waiting time | ❌ Arrival order | ❌ Arrival order | ⚠️ Fixed priority codes |
| **Duplicate / corroboration handling** | 🧩 Automatic 500 m / 30 min clustering with independence checks | ❌ Memory of the operator | ❌ None | ⚠️ Manual merge |
| **Report credibility** | 🛡️ Explainable trust score + device reputation | ❌ None | ⚠️ Captcha at best | ⚠️ Caller ID only |
| **Nearest unit** | 🗺️ Suitable-type filter + distance + ETA + auto-assign | ❌ Radio round | ❌ None | ✅ Usually (AVL) |
| **Citizen feedback** | 📱 Public tracking by reference code | ❌ None | ⚠️ Email | ❌ None |
| **Setup** | 🚀 Minutes, laptop-grade | — | ⚠️ Custom configuration | ⏳ Months, expensive |

### Core Innovation: Explainable, Self-Correcting Triage
Every number ResQNet shows a dispatcher comes with its reasons: *"Building Collapse base +35 · 8 people +20 · keyword 'trapped' +25"* for severity, *"Corroborated by 2 independent reports +35"* for trust, and the four weighted components for priority. Independent witnesses strengthen a report, copy-paste or same-device repeats weaken it, the AI acts as an advisory signal rather than a gatekeeper, and admin verification feeds back into device reputation — so the system becomes harder to spam the more it is used, while staying fully auditable.

---

## 🔧 Feature Depth & Edge-Case Engineering

### 1. Edge-Case Handling
- **Never block a real report:** If a signed-in citizen's session expired, the frontend resubmits the report anonymously instead of failing.
- **Rate-limit UX:** 429 responses carry `Retry-After`; the backend exposes the header via CORS and the form shows a live countdown.
- **Shared networks:** The per-IP limit (10 per 10 min) is set higher than the per-device limit (3), so people reporting from the same campus or hospital network aren't blocked by each other.
- **Same person, many reports:** Same-device or near-identical text is a *duplicate*, not corroboration — it can't inflate trust.
- **Busy-team race:** Assigning a team that just became busy returns **409**; the panel shows the message and reloads nearby teams.
- **Missing coordinates:** Nearest-team search returns a clear 400 (*"Incident does not have latitude/longitude coordinates"*), which the panel shows; manual assignment by team ID still works.
- **Illegal status jumps:** The backend rejects e.g. `Reported → Resolved`; the UI disables options that aren't legal from the current status and routes *Assigned* through the dispatch panel so a team is always attached.
- **Schema upgrades:** On startup the backend adds any columns missing from an older `emergency.db`, so teammates' databases keep working after pulls.
- **AI outages:** Gemini errors or timeouts are stored as `{error: …}`; trust scoring ignores them and the UI labels the check as unavailable.

### 2. Incident Data Contract (abridged)

```json
{
  "id": 7,
  "ref_code": "ER-2026-0007",
  "title": "Commercial building collapse near Flower Bazaar",
  "category": { "code": "COLLAPSE", "name": "Building Collapse", "base_weight": 35 },
  "location": "Flower Bazaar, George Town, Chennai",
  "latitude": 13.0905,
  "longitude": 80.2821,
  "location_accuracy_m": 20,
  "people_affected": 10,
  "severity": "Critical",
  "severity_score": 95,
  "severity_reasons": ["Building Collapse base +35", "10 people affected +20", "keyword 'trapped' +25"],
  "status": "Assigned",
  "trust_score": 85,
  "trust_reasons": ["Baseline unverified trust: 50", "Corroborated by 1 nearby independent report(s) +25"],
  "verification_status": "Corroborated",
  "cluster_id": 7,
  "cluster_size": 2,
  "cluster_people_affected": 14,
  "is_duplicate": false,
  "assigned_team_id": 6,
  "assigned_team": { "id": 6, "code": "RESCUE-01", "name": "…", "category": "Rescue", "availability": "Busy" },
  "assignment_distance_km": 2.4,
  "eta_minutes": 4,
  "priority_score": 78.2,
  "priority_label": "Critical",
  "priority_breakdown": {
    "severity_component": 33.25, "people_component": 5.0,
    "time_component": 20.0, "category_component": 20.0,
    "minutes_active": 479.0
  },
  "created_at": "2026-11-10T08:00:00Z"
}
```

*`priority_*` fields are returned by `/incidents/prioritized`; values shown are illustrative.*

### 3. API Overview

| Method & Path | Auth | Purpose |
|---|---|---|
| `POST /api/incidents` | Public (rate-limited) | Submit a report |
| `GET /api/incidents/track/{ref_code}` | Public | Track by reference code |
| `GET /api/categories` | Public | Emergency categories |
| `POST /api/auth/login` | Public | Admin sign-in → bearer token |
| `GET /api/incidents` | Admin | List with filters, sort, pagination |
| `GET /api/incidents/prioritized` | Admin | Live priority queue |
| `GET /api/incidents/{id}` · `DELETE` | Admin | Detail with history · delete |
| `PATCH /api/incidents/{id}/status` · `/severity` · `/verify` | Admin | Lifecycle, severity override, verification |
| `GET /api/incidents/{id}/related` | Admin | Corroborating and duplicate reports |
| `GET /api/incidents/{id}/nearest-teams` | Admin | Suitable available teams by distance |
| `POST /api/incidents/{id}/assign` · `/unassign` | Admin | Dispatch / release a team |
| `GET /api/teams` · `POST` · `PUT /{id}` · `DELETE /{id}` | Admin for writes | Team management |
| `PATCH /api/teams/{id}/availability` | Admin | Available / Busy toggle |
| `GET /api/analytics/summary` · `GET /api/dashboard/stats` | Admin | Dashboard data |

Full request/response schemas are at `http://localhost:8000/docs`.

---

## 🚧 Known Limitations

- **Citizen accounts are frontend-only for now.** The backend implements admin login only; the sign-up, *My reports* and citizen sign-in pages detect this and tell the user to report anonymously or track by reference code (see `docs/server-auth-plan.md`).
- **Sessions and rate limits live in memory**, so they reset when the server restarts and aren't shared between multiple server processes.
- **Passwords use salted SHA-256**, which is fine for a demo but should be replaced with bcrypt/argon2 before real deployment.
- **Reference codes use a fixed `ER-2026-` prefix.**
- **Map routes and geocoding depend on public OSRM and Nominatim services**, which have rate limits.

---

## ⚠️ Ethical Use & Operational Disclaimer

ResQNet is a **decision-support tool for emergency coordination**, built for the Code Clash 2026 hackathon.

- **Humans decide:** Severity, trust, priority and AI verdicts are recommendations with visible reasons. Dispatching, overriding severity and closing incidents are always admin actions.
- **Privacy by default:** Reports can be anonymous; device IDs and IPs are stored only as salted hashes; the AI receives only the category, people affected, location, title and description — never the reporter's name, phone or email.
- **Not a replacement for official emergency numbers:** ResQNet should complement, not replace, national emergency lines such as 112 and certified dispatch systems.

---

## 📜 License

No license file has been added to this repository yet. Until one is, all rights are reserved by the authors. Add a `LICENSE` file (for example MIT or Apache-2.0) before reusing or redistributing the code.

---

## 🧩 Author & Team

**Team CobotEx — Code Clash 2026**
- Muhammad Danish J
- Nivedha Palani
- **Repository:** [github.com/danishjk2156/emergency-alert](https://github.com/danishjk2156/emergency-alert)
- **Issues:** [github.com/danishjk2156/emergency-alert/issues](https://github.com/danishjk2156/emergency-alert/issues)
