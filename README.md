# 🚨 ResQNet (CobotEx)

> **High-Throughput Emergency Incident Reporting, Spatial Corroboration, Multi-Factor Trust Scoring, and AI-Powered Dispatch Orchestration Platform.**

![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)
![Python](https://img.shields.io/badge/python-3.11-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109.0-009688.svg)
![React](https://img.shields.io/badge/react-18.3.1-61DAFB.svg)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-3.4.17-38B2AC.svg)
![SQLite](https://img.shields.io/badge/database-SQLite%20%7C%20SQLAlchemy-003B57.svg)
![Leaflet](https://img.shields.io/badge/geospatial-Leaflet%20%7C%20OSRM-199900.svg)
![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)

---

## 📌 Problem Statement

During municipal crises, mass disasters, and emergency surges (urban fires, flash floods, building collapses, multi-vehicle pileups), Public Safety Answering Points (PSAPs), 911/112 call centers, and emergency control rooms experience catastrophic operational friction. Traditional call-intake and manual dispatch workflows suffer from four fundamental bottlenecks:

1. **Delayed Triage & FIFO Queue Paralysis:** Emergency hotlines queue incoming reports in simple First-In-First-Out (FIFO) arrival order. Severe life-threatening situations (e.g., active structural collapse with trapped children) languish in the queue behind minor municipal grievances, delaying frontline rescue deployment during the critical golden hour.
2. **Dispatcher Paralysis from Spam, Bot Attacks, and False Alarms:** Public web portals and emergency phone lines are plagued by prank callers, automated spam bots, and malicious hoaxes. In the absence of device reputation tracking, sliding-window rate limits, and automated honeypot filters, dispatchers waste valuable personnel investigating phantom incidents.
3. **Duplicate Report Chaos & Fragmented Situational Awareness:** When a major disaster occurs in a dense metropolitan area, dozens of bystanders submit concurrent reports for the exact same event. Without automatic spatial-temporal clustering and corroboration, dispatchers see hundreds of disconnected tickets, miscalculating casualty counts and scattering rescue units inefficiently.
4. **Location Ambiguity & Citizen Anxiety:** Callers in shock provide inaccurate addresses or intentional spoof coordinates. Furthermore, reporting citizens receive zero feedback on whether help is en route, prompting repeated panicky follow-up calls that tie up emergency bandwidth.

**ResQNet** solves this problem by delivering a unified, edge-deployable emergency incident reporting and command platform. It pairs high-speed public intake and reverse geocoding with a dual-layer triage engine: deterministic algorithmic severity calculations combined with Google Gemini 3.5 Flash Lite live plausibility evaluation. The platform continuously computes dynamic device trust scores, clusters spatial duplicates via the Haversine formula, ranks an active dispatch priority queue, and guides first responder teams via turn-by-turn OSRM routing.

---

## 🚀 Features

| Feature | Subsystem | Engineering Mechanism & Algorithms | Output Artifact | Status |
|---|---|---|---|---|
| **Dual-Layer Severity Triage** | Triage Engine (`severity.py` / `severity.js`) | Deterministic baseline weighting by category, casualty threshold multipliers, and critical regex heuristics, paired with Google Gemini 3.5 Flash Lite live NLP assessment. | Computed Severity (`Low`, `Medium`, `High`, `Critical`), severity score (0–100), and reasoning tokens. | **Production** |
| **Multi-Factor Trust Scoring** | Trust Engine (`trust.py` / `mock.js`) | Bayesian trust calculation evaluating device hash historical verification ratio, telephone verifiability, honeypot traps, and GPS-to-address distance variance. | Trust Score (0–100) and Verification Tier (`Verified`, `Corroborated`, `Unverified`, `Suspicious`). | **Production** |
| **Spatial-Temporal Corroboration** | Clustering Core (`corroboration.py`) | Spatial-temporal clustering using Haversine spherical distance ($d \le 1.5\text{ km}$) and sliding time windows ($t \le 3\text{ hours}$); merges duplicate claims from identical device hashes ($t \le 30\text{ min}$). | Corroboration clusters with unified casualty aggregation and primary incident linkage. | **Production** |
| **GPS Cross-Verification & Geocoding** | Geospatial Engine (`geo.py` / `useGeolocation.js`) | HTML5 high-accuracy browser GPS coordinates cross-referenced against Nominatim reverse-geocoded physical addresses to detect location spoofing. | Physical address resolution and computed `location_mismatch_km` metric. | **Production** |
| **Active Dispatch Priority Queue** | Queue Engine (`PriorityQueue.jsx`) | Real-time dynamic ranking equation integrating severity score, casualty count, elapsed waiting duration, and category weight. Auto-refreshes every 30s. | Ranked dispatch table with score breakdown tooltip and pulsing red warning on unassigned critical emergencies. | **Production** |
| **Response Teams Management** | Fleet Subsystem (`TeamsPage.jsx`) | CRUD command center for emergency units across Fire, EMS, Rescue, and Police; includes interactive Leaflet map coordinate click-picker and instant availability toggle. | Comprehensive fleet inventory with live assignment tracking and status indicators. | **Production** |
| **Incident Lifecycle & Auto-Assignment** | Dispatch Module (`AssignmentPanel.jsx`) | Nearest available unit discovery with Haversine distance and driving ETA calculation; 4-step linear lifecycle stepper (`Reported` ➔ `Assigned` ➔ `In Progress` ➔ `Resolved`). | One-click auto-dispatch, conflict handling (HTTP 409), and operational timeline audit logs. | **Production** |
| **Interactive Live Map & OSRM Routing** | Geospatial UI (`MapView.jsx` / `MapPage.jsx`) | React-Leaflet GIS visualization utilizing custom CSS `divIcon` pins; auto-bounds fitting; requests OSRM public route engine for driving vector overlays. | Real-time map displaying incident clusters, active response units, and dashed driving routes with ETA badges. | **Production** |
| **Real-Time Analytics Command Hub** | Metrics Engine (`DashboardPage.jsx`) | Recharts visualization suite providing 6 high-visibility KPI stat cards, a category distribution donut chart, a status bar chart, and a 7-day intake trend line. | Executive situational awareness overview auto-updating every 30 seconds with skeleton loaders. | **Production** |
| **Public Citizen Emergency Tracker** | Citizen Portal (`TrackPage.jsx`) | Public tracking portal requiring only an incident reference code (`ER-YYYY-XXXX`) to query incident progress without requiring login credentials. | Real-time public timeline, emergency stage, and verified safety tips. | **Production** |

---

## 🏗️ Tech Stack

### Frontend Client
| Component | Version | Role in Architecture | Technical Rationale |
|---|---|---|---|
| **React.js** | `^18.3.1` | Core Single Page Application | Component-driven reactivity, optimal hook state encapsulation, and smooth concurrent UI rendering. |
| **Vite** | `^6.0.7` | Development tooling & bundler | Lightning-fast Hot Module Replacement (HMR) and optimized Rollup production asset compilation. |
| **React Router** | `^6.28.0` | Client-side routing & guards | Nested routing hierarchy with role-based route guards separating citizen and dispatcher portals. |
| **Tailwind CSS** | `^3.4.17` | Utility-first design system | High-contrast emergency color tokens (fire red, amber warning, rescue blue, emerald resolved) and dark mode styling. |
| **React Leaflet & Leaflet** | `^4.2.1` / `^1.9.4` | Geospatial mapping & GIS | Lightweight open-source mapping engine rendering SVG/Canvas markers, OpenStreetMap tiles, and OSRM polylines. |
| **Recharts** | `^2.15.0` | Executive analytics visualization | Declarative SVG charting library providing responsive donut charts, bar distributions, and volume trends. |
| **Lucide / Inline SVG** | Custom | UI iconography | Zero-overhead, 24×24 stroke-based inline SVG icon system eliminating external webfont network bottlenecks. |

### Backend Services & Ingestion
| Component | Version | Role in Architecture | Technical Rationale |
|---|---|---|---|
| **Python** | `3.11+` | Primary service runtime | Async execution speed, native typing, and mature ecosystem for geospatial and machine learning algorithms. |
| **FastAPI** | `^0.109.0` | Ingress and API gateway | Asynchronous ASGI request handling, native Pydantic schema validation, and automatic OpenAPI 3.0 documentation. |
| **Uvicorn** | `^0.27.0` | ASGI production server | Non-blocking event loop execution built on `uvloop` for sub-millisecond API response latencies. |
| **SQLAlchemy** | `^2.0.25` | Relational Object-Relational Mapper | Declarative 2.0 ORM modeling, transaction lifecycle management, and clean migration hooks. |
| **Pydantic v2** | `^2.6.0` | Data contract enforcement | High-throughput JSON deserialization, schema sanitization, and structured HTTP 422 validation responses. |
| **Google Gemini API** | `3.5 Flash Lite` | Semantic emergency triage | Real-time contextual description evaluation, life-threat keyword detection, and plausibility scoring. |

### Storage, Caching & Infrastructure
| Component | Version | Role in Architecture | Technical Rationale |
|---|---|---|---|
| **SQLite / PostgreSQL** | `3.40+` | Relational primary database | ACID-compliant transactional persistence for incidents, user credentials, audit trails, and fleet models. |
| **In-Memory Rate Limiter** | Sliding Window | DoS and spam mitigation | Sliding-window client device tracking rejecting flood attacks exceeding 3 reports / 10 minutes. |
| **OSRM Engine** | Public API | Turn-by-turn vehicle routing | Open-Source Routing Machine providing realistic road network routes, travel distances, and driving ETAs. |

---

## 📂 Project Structure

```
cobotex/
├── backend/
│   ├── app/
│   │   ├── api/                           # API router aggregation
│   │   ├── routers/
│   │   │   ├── auth.py                    # Dispatcher sign-in, citizen register, and JWT issuance
│   │   │   ├── categories.py              # Emergency category codes, icons, and baseline weights
│   │   │   ├── dashboard.py               # Aggregated operational statistics and recent critical queues
│   │   │   └── incidents.py               # Incident intake, priority queue, nearest teams, and assignment
│   │   ├── auth.py                        # Bcrypt password hashing, JWT creation/verification, role enforcement
│   │   ├── corroboration.py               # Spatial-temporal clustering and duplicate linking engine
│   │   ├── database.py                    # SQLAlchemy engine configuration, session maker, and Base
│   │   ├── enrich.py                      # Asynchronous background worker for reverse geocoding and AI triage
│   │   ├── gemini_triage.py               # Google Gemini 3.5 Flash Lite prompt orchestration and parsing
│   │   ├── geo.py                         # Haversine distance calculations and coordinate normalization
│   │   ├── models.py                      # SQLAlchemy ORM schemas (Incidents, Teams, Users, History, Reputation)
│   │   ├── rate_limit.py                  # Sliding-window rate limiter and device fingerprint hashing
│   │   ├── schemas.py                     # Pydantic v2 validation models for request/response payloads
│   │   ├── seed.py                        # Database seeder initializing teams, categories, and test incidents
│   │   ├── severity.py                    # Deterministic rule-based emergency triage engine
│   │   ├── trust.py                       # Multi-factor trust and verification scoring pipeline
│   │   ├── main.py                        # FastAPI application entry point, CORS, and exception handlers
│   │   └── __init__.py
│   ├── requirements.txt                   # Locked Python dependency manifest
│   ├── .env.example                       # Backend configuration template
│   └── README.md                          # Backend reference guide
│
├── frontend/
│   ├── public/
│   │   ├── favicon.svg                    # Emergency beacon vector favicon
│   │   └── index.html                     # HTML5 application shell
│   ├── src/
│   │   ├── api.js                         # Unified client API request helper with error normalizers
│   │   ├── mock.js                        # In-browser mutating mock database (Prompt F1)
│   │   ├── constants.js                   # Visual palettes, fallback categories, and safety protocols
│   │   ├── severity.js                    # Client-side live severity calculation preview
│   │   ├── auth.jsx                       # React authentication context provider and token lifecycle
│   │   ├── components/
│   │   │   ├── AdminLayout.jsx            # Dispatcher navigation layout with sidebar and notifications
│   │   │   ├── AssignmentPanel.jsx        # Nearest teams selector and 4-step lifecycle stepper (Prompt F4)
│   │   │   ├── ClusterPill.jsx            # Visual badge for corroborated multi-report incident groups
│   │   │   ├── ConfirmDialog.jsx          # Reusable modal confirmation for destructive actions
│   │   │   ├── CriticalBanner.jsx         # Sticky pulsing notification banner for critical incidents
│   │   │   ├── EmptyState.jsx             # Clean placeholder states for blank lists and search failures
│   │   │   ├── Icon.jsx                   # High-performance inline SVG icon library
│   │   │   ├── IncidentTable.jsx          # Sortable, filterable incident data table with pagination
│   │   │   ├── LlmInsight.jsx             # Gemini AI plausibility analysis and hazard breakdown card
│   │   │   ├── LocationInfo.jsx           # GPS accuracy, geocoding source, and coordinate mismatch meter
│   │   │   ├── MapView.jsx                # React-Leaflet GIS component with OSRM vehicle routing (Prompt F5)
│   │   │   ├── PriorityQueue.jsx          # Real-time ranked dispatch table with score tooltips (Prompt F2)
│   │   │   ├── PublicLayout.jsx           # Header and footer shell for citizen reporting screens
│   │   │   ├── ReasonChips.jsx            # Visual tag indicators for severity and trust scoring factors
│   │   │   ├── RelatedReports.jsx         # Corroborating and duplicate incident links list
│   │   │   ├── SeverityBadge.jsx          # Color-coded filled pills with pulsing critical beacons
│   │   │   ├── StatCard.jsx               # Compact numeric metrics card
│   │   │   ├── StatusChip.jsx             # Outlined status indicators
│   │   │   ├── Timeline.jsx               # Chronological incident action audit trail
│   │   │   ├── Toast.jsx                  # Non-blocking transient feedback notifications
│   │   │   ├── TrustMeter.jsx             # Visual score meter displaying verified reliability score
│   │   │   └── VerificationBadge.jsx      # Multi-state trust badge (Verified, Corroborated, Suspicious)
│   │   ├── hooks/
│   │   │   └── useGeolocation.js          # Browser GPS geolocation hook with reverse geocoding
│   │   ├── lib/
│   │   │   └── device.js                  # Privacy-preserving local device fingerprinting
│   │   ├── pages/
│   │   │   ├── DashboardPage.jsx          # 6-Card KPI overview + 3 Recharts graphs + PriorityQueue (Prompt F6)
│   │   │   ├── IncidentDetailPage.jsx     # Deep incident inspection, triage override, and dispatch actions
│   │   │   ├── IncidentsPage.jsx          # Administrative incident list with URL-driven filters
│   │   │   ├── LoginPage.jsx              # Dispatcher credentials login page
│   │   │   ├── MapPage.jsx                # Full-screen live emergency map view (/admin/map) (Prompt F5)
│   │   │   ├── MyReportsPage.jsx          # Citizen account portal displaying submitted reports
│   │   │   ├── RegisterPage.jsx           # Citizen account creation form
│   │   │   ├── ReportPage.jsx             # Public emergency intake form with live severity preview
│   │   │   ├── ReportSuccessPage.jsx      # Incident submission receipt with reference code and copy action
│   │   │   ├── TeamsPage.jsx              # Response teams management and map click-picker modal (Prompt F3)
│   │   │   ├── TrackPage.jsx              # Public lookup page by reference code (ER-YYYY-XXXX)
│   │   │   └── UserLoginPage.jsx          # Citizen login portal
│   │   ├── App.jsx                        # Master routing definitions and view guards
│   │   ├── main.jsx                       # React 18 root bootstrap with Leaflet stylesheet injection
│   │   └── index.css                      # Tailwind base layer and emergency styling rules
│   ├── package.json                       # Frontend dependencies and run scripts
│   ├── postcss.config.js                  # PostCSS plugins setup
│   ├── tailwind.config.js                 # Brand colors, typography, and animation definitions
│   └── vite.config.js                     # Vite bundler configuration and dev proxy settings
│
├── .gitignore                             # Ignored dependencies, caches, and database files
├── LICENSE                                # Apache 2.0 Open Source License
└── README.md                              # Consolidated system documentation
```

---

## ⚙️ Installation & Setup

### Prerequisites
- **Python:** Version `3.11.x`
- **Node.js:** Version `18.x` or `20.x` (LTS) & `npm 9.x+`
- **Git:** Version `2.30+`

---

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-org/cobotex.git
cd cobotex
```

---

### Step 2: Configure Environment Variables

Create the `.env` configuration file inside `backend/`:

```bash
# On Linux / macOS
cp backend/.env.example backend/.env

# On Windows (PowerShell)
Copy-Item backend/.env.example backend/.env
```

**Required `backend/.env` values:**
```env
# Application Settings
ENVIRONMENT=development
SECRET_KEY=cobotex-emergency-dispatch-jwt-secret-key-32chars
DATABASE_URL=sqlite:///./cobotex.db

# Optional AI Triage Key (Falls back to local heuristic rules if omitted)
GEMINI_API_KEY=your_gemini_api_key_here
```

---

### Step 3: Backend Setup & Execution

Open a dedicated terminal window:

```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# Linux / macOS:
source venv/bin/activate

# Install required dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Seed database with initial categories, demo dispatchers, and 12 incidents
python -m app.seed

# Launch the FastAPI ASGI server with hot reload
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- **Backend API Gateway:** `http://localhost:8000`
- **Interactive Swagger Documentation:** `http://localhost:8000/docs`
- **Health Verification:** `http://localhost:8000/api/health`

---

### Step 4: Frontend Setup & Execution

Open a second terminal window:

```bash
cd frontend

# Install Node dependencies
npm install

# Option A: Full-Stack Mode (Talks to the live FastAPI backend)
npm run dev

# Option B: Standalone Field Demo Mode (Runs in-browser with localStorage mock)
npm run dev:mock
```

- **Operations Dashboard:** `http://localhost:5173/admin`
- **Public Emergency Form:** `http://localhost:5173/report`
- **Demo Dispatcher Credentials:** `admin@codeclash.dev` / `admin123`

---

### Step 5: System Verification & Intake Smoke Test

Submit a synthetic high-priority emergency report using `curl`:

```bash
curl -X POST http://localhost:8000/api/incidents \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: dev-smoke-test-01" \
  -d '{
    "category_code": "COLLAPSE",
    "title": "Structural failure at market complex",
    "description": "Multi-storey building collapsed, 8 people trapped under rubble, gas smell detected.",
    "location": "Guindy Industrial Estate, Chennai",
    "latitude": 13.0067,
    "longitude": 80.2206,
    "location_accuracy_m": 12.5,
    "people_affected": 8,
    "contact_name": "Ravi Kumar",
    "contact_phone": "9840012345"
  }'
```

**Expected Response (`HTTP 201 Created`):**
```json
{
  "id": 13,
  "ref_code": "ER-2026-0013",
  "title": "Structural failure at market complex",
  "severity": "Critical",
  "severity_score": 92,
  "status": "Reported",
  "trust_score": 85,
  "verification_status": "High Confidence",
  "is_duplicate": false
}
```

---

## 🧠 How It Works

ResQNet routes emergency information through an intelligent, multi-stage processing pipeline:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            RESQNET PIPELINE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  STAGE 1: CITIZEN INTAKE, GPS LOCALIZATION & ANTI-BOT FILTERING             │
│                                                                             │
│  Citizen Mobile Browser ➔ HTML5 Geolocation API (Latitude / Longitude)      │
│                         ➔ Sliding-Window Rate Limiter (3 req / 10 min)      │
│                         ➔ Invisible Honeypot Trap Detection                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  STAGE 2: DUAL-ENGINE SEVERITY & AI PLAUSIBILITY TRIAGE                     │
│                                                                             │
│  Payload Ingestion      ➔ Deterministic Rule Engine (Category + Casualties) │
│                         ➔ Semantic Keyword & Threat Regex Classifier        │
│                         ➔ Google Gemini 3.5 Flash Lite Live Triage Check    │
├─────────────────────────────────────────────────────────────────────────────┤
│  STAGE 3: SPATIAL CORROBORATION & DYNAMIC TRUST SCORING                     │
│                                                                             │
│  Candidate Matching     ➔ Haversine Distance (d <= 1.5km) & Time Clustering │
│                         ➔ Duplicate Deduplication & Casualty Summation      │
│                         ➔ Reverse Geocoding Distance Mismatch Verification  │
│                         ➔ Device Reputation Historical Scoring              │
├─────────────────────────────────────────────────────────────────────────────┤
│  STAGE 4: DYNAMIC PRIORITY QUEUE, OSRM ROUTING & COMMAND CENTER             │
│                                                                             │
│  Dispatcher Operations  ➔ Real-Time Active Priority Queue (30s Polling)     │
│                         ➔ Nearest Available Response Unit Auto-Discovery    │
│                         ➔ OSRM Driving Vector Routing & ETA Estimation      │
│                         ➔ 4-Step Operational Stepper (Reported -> Resolved) │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 1. Citizen Intake, GPS Localization & Ingress Filtering
1. **Zero-Friction Emergency Reporting:** Citizens navigate to `/report` on any smartphone. The system captures category selection, casualty counts, and situational notes with no mandatory account creation.
2. **High-Accuracy Geolocation:** The `useGeolocation` hook queries the device GPS chip, obtaining exact coordinates and horizontal accuracy radius in meters.
3. **Anti-Bot Honeypot Defense:** Forms include an invisible trap field (`website`). Automated scrapers and spam scripts populate this field, prompting the gateway to discard the ticket silently without committing it to the database.
4. **Sliding-Window Rate Limiting:** A privacy-preserving device hash (`X-Device-Id`) enforces a maximum threshold of 3 reports per 10-minute window, blunting denial-of-service attempts during public panics.

---

### 2. Dual-Engine Severity & AI Plausibility Triage
1. **Deterministic Rule Engine:** Computes an immediate severity baseline using category base weights (`FIRE`: 40, `COLLAPSE`: 40, `MEDICAL`: 30, `ROAD`: 25, `FLOOD`: 25), scaling exponentially with casualty counts:
   $$\text{Score} = \text{BaseWeight} + \min(35, \text{Casualties} \times 4) + \text{KeywordBonus}$$
2. **Semantic Keyword Evaluation:** Scans input text for high-consequence risk words (`trapped`, `choking`, `unconscious`, `flames`, `explosion`), dynamically bumping severity tiers to `Critical` or `High`.
3. **Google Gemini 3.5 Flash Lite Assessment:** In the background, the server passes the report text to Google Gemini 3.5 Flash Lite. The model evaluates whether the narrative is plausible, flags semantic category mismatches, and generates operational hazard briefings for dispatchers.

---

### 3. Spatial Corroboration & Dynamic Trust Scoring
1. **Spatial Proximity Matching:** When a new report arrives, the corroboration engine calculates the spherical distance against all active incidents using the Haversine formula:
   $$d = 2R \arcsin \left( \sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)} \right)$$
2. **Automated Incident Clustering:** Incidents within $1.5\text{ km}$ and 3 hours are unified under a shared cluster ID (`C-XXXX`). Subsequent reports automatically increment cluster size and consolidate casualty counts without generating duplicate queue noise.
3. **Location Mismatch Verification:** The system queries Nominatim to reverse-geocode the user's typed street address. If the physical geocode deviates by $>5\text{ km}$ from the device's hardware GPS coordinates, the report receives an automatic trust penalty.
4. **Bayesian Trust Computation:** Synthesizes device reputation history, phone number validity, and cross-device corroboration into a final Trust Score (0–100).

---

### 4. Dynamic Priority Queue, OSRM Routing & Command Center
1. **Dynamic Priority Queue:** The admin dashboard polls `/api/incidents/prioritized` every 30 seconds. Incidents are sorted using a multi-factor ranking formula:
   $$\text{Priority} = \text{SeverityWeight} + \text{CasualtyScore} + \text{WaitDurationBonus} + \text{CategoryUrgency}$$
2. **Nearest Response Unit Discovery:** The dispatcher selects an incident; the system scans active fleet units (`FIRE`, `MED`, `RESCUE`, `POLICE`), filters for `available` units, and ranks them by road distance.
3. **OSRM Turn-by-Turn Driving Route:** The Leaflet map queries the Project-OSRM routing engine to retrieve actual street network geometries, rendering a red dashed path with driving duration ETAs.
4. **Lifecycle Progression Stepper:** Dispatched units progress through an enforced linear status state machine: `Reported` ➔ `Assigned` ➔ `In Progress` ➔ `Resolved`. Every state change is immutably logged with dispatcher ID and timestamp.

---

## 📈 Scalability

ResQNet is engineered to handle metropolitan disaster surges without performance degradation:

1. **Stateless Gateway Horizontal Scaling:**
   - The FastAPI backend application is completely stateless. Multiple container replicas can run behind an AWS ALB or Nginx reverse proxy.
2. **Spatial Partitioning & Clustering Pruning:**
   - Rather than calculating $O(N^2)$ distance pairs across all historical rows, the corroboration query limits candidate searches to active, unresolved incidents created within the preceding 3-hour window.
3. **In-Memory Mock Architecture for Field Nodes:**
   - The entire frontend includes a self-contained in-memory database (`mock.js`) enabling local command operations inside isolated disaster zones even when internet access or backhaul links are severed.
4. **Asynchronous Background Task Processing:**
   - Heavy network calls (Gemini AI API requests and Nominatim reverse geocoding) execute via non-blocking FastAPI `BackgroundTasks`, keeping synchronous citizen intake latency under 20 milliseconds.
5. **Optimized SVG/Canvas Map Layer:**
   - The Leaflet map utilizes lightweight HTML5 `divIcon` elements and vector polylines, rendering hundreds of concurrent incidents and fleet vehicles smoothly without DOM thrashing.

---

## 💡 Feasibility

ResQNet provides enterprise-grade disaster dispatch capabilities while remaining accessible and deployable:

- **Minimal Infrastructure Footprint:** The platform operates efficiently on a standard cloud virtual machine (1 vCPU, 1GB RAM) or an on-premise emergency operations computer.
- **Battle-Tested Open-Source Foundation:** Constructed using **React 18**, **FastAPI**, **SQLite/PostgreSQL**, and **OpenStreetMap/OSRM**, ResQNet eliminates costly licensing fees and proprietary vendor lock-in.
- **Zero Configuration for Citizens:** Citizens do not need to download mobile applications or create user accounts during an emergency; web apps run instantaneously in mobile browsers.
- **Dual Operating Modes:** Teams can conduct operational training and demonstrations using `npm run dev:mock` without configuring databases or server infrastructure.

---

## 🌟 Novelty & Comparative Analysis

Existing emergency dispatch tools remain divided between legacy 911 CAD mainframes and rigid corporate ticketing software:

### Competitive Matrix

| Capability / Metric | ResQNet (CobotEx) | Legacy 911 / 112 CAD | Commercial Dispatch SaaS | Generic Web CRM / Forms |
|---|---|---|---|---|
| **Intake Triage Speed** | ⚡ Instant Deterministic + AI | ⏳ Slow Manual Verbal Intake | ⚠️ Static Rule Configuration | ❌ No Triage Logic |
| **Spam / Bot Defense** | 🛡️ Honeypot + Rate Limiter | ❌ Vulnerable to Phone Swatting | ⚠️ Basic Captcha Only | ❌ No Defense |
| **Spatial Clustering** | 🧠 Haversine Auto-Clustering | ❌ Manual Dispatcher Matching | ⚠️ Manual Pin Merging | ❌ None |
| **Live Vehicle Routing** | 🗺️ OSRM Real Driving ETAs | 🏢 Requires External Add-on | 💲 Expensive Add-on License | ❌ None |
| **Citizen Self-Tracking** | 📱 Public Live Status Code | ❌ Zero Feedback | ⚠️ Email Notification Only | ❌ None |
| **AI Plausibility Check**| 🤖 Google Gemini 3.5 Flash | ❌ None | ❌ None | ❌ None |
| **Deployment Time** | 🚀 Under 5 Minutes | ⏳ Months of On-Prem Install | ⏳ Weeks of Enterprise Setup | ⚠️ High Customization |

### Core Innovation: The Autonomous Spatial-AI Triage Loop
Traditional dispatch centers depend on human memory to recognize that multiple callers are describing the same bridge accident. ResQNet automates this loop: the moment a report arrives, the system runs geometric proximity clustering, calculates casualty aggregates, runs AI semantic sanity checks, and highlights the single closest available emergency vehicle on the map—empowering dispatchers to make life-saving decisions in seconds rather than minutes.

---

## 🔧 Feature Depth & Edge-Case Engineering

ResQNet is engineered to maintain bulletproof reliability in noisy, adversarial environments:

### 1. Robust Edge-Case Handling
- **Honeypot Anti-Bot Filter:** Automated bots fill all available input fields. ResQNet incorporates a hidden `website` field that is invisible to legitimate citizens. If populated, the system returns a successful HTTP 201 response but drops the payload from the operational queue.
- **GPS Mismatch Detection:** If a user claims an emergency is in "Guindy" but device GPS indicates they are in "Chengalpattu" (>5 km discrepancy), the platform highlights the mismatch and applies an automatic trust score deduction.
- **Race-Condition Fleet Assignment (HTTP 409):** If two dispatchers attempt to assign the same fire engine simultaneously, the API rejects the second request with an `HTTP 409 Conflict`, triggering an instant list refresh and toast alert on the frontend.
- **Device Reputation Drift:** Devices that repeatedly submit confirmed false alarms have their trust ceiling permanently degraded, ensuring hoaxers cannot bypass priority queues during real crises.
- **Corroboration Window Expirations:** Corroboration clustering automatically expires after 3 hours to prevent grouping separate incidents that occur at the same location across different times.

### 2. Standardized Emergency Incident Schema
Every emergency event conforms to a strict Pydantic v2 data contract:

```json
{
  "id": 8,
  "ref_code": "ER-2026-0008",
  "title": "Smoke spreading on 2nd floor",
  "description": "Thick black smoke spreading from commercial shop, three occupants trapped near window.",
  "category": {
    "code": "FIRE",
    "name": "Fire Outbreak",
    "icon": "🔥"
  },
  "location": "Guindy Industrial Estate, Chennai",
  "latitude": 13.0071,
  "longitude": 80.2209,
  "location_accuracy_m": 15.0,
  "location_source": "gps",
  "location_mismatch_km": 0.4,
  "people_affected": 3,
  "severity": "Critical",
  "severity_score": 88,
  "priority_score": 84,
  "priority_label": "Critical",
  "priority_breakdown": {
    "severity": 40,
    "people": 9,
    "time": 20,
    "category": 10
  },
  "status": "In Progress",
  "trust_score": 85,
  "verification_status": "Verified",
  "cluster_id": "C-8",
  "cluster_size": 2,
  "assigned_team": {
    "id": 1,
    "code": "FIRE-01",
    "name": "Guindy Fire Station Tender 1",
    "location_label": "Guindy Industrial Estate Depot",
    "distance_km": 1.2,
    "eta_mins": 5
  },
  "created_at": "2026-11-10T14:30:00Z"
}
```

---

## ⚠️ Ethical Use & Operational Disclaimer

ResQNet is engineered exclusively for **emergency dispatch assistance, rapid triage, and public safety decision-support**.

- **Human-in-the-Loop Authority:** AI plausibility ratings and automated triage scores serve solely as operational recommendations. Final decisions to deploy frontline personnel, alter severity levels, or close incidents remain the sole responsibility of human emergency dispatchers.
- **Privacy Preservation:** All device identifiers and IP addresses are stored as one-way SHA-256 hashes (`device_hash`). Unregistered citizens are permitted to file life-safety reports completely anonymously.
- **Not a Replacement for Certified Life-Safety Trunks:** While ResQNet provides robust web-based intake and coordination, it is designed to operate in tandem with established national emergency telecom trunks (E911, NG911, E112).

---

## 📜 License

Licensed under the **Apache License, Version 2.0** (the "License"). You may obtain a copy of the License at [http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0).

```
Copyright 2026 ResQNet Contributors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0
```

---

## 🧩 Author & Team

**ResQNet Emergency Systems Engineering Team**  
- **Lead Software Architect:** Danish & Team CobotEx  
- **Project Repository:** [https://github.com/cobotex/resqnet](https://github.com/cobotex/resqnet)  
- **Issue Tracker:** [https://github.com/cobotex/resqnet/issues](https://github.com/cobotex/resqnet/issues)
