# ResQNet — Frontend (Code Clash 2026, Round 1)

React 18 + Vite + React Router v6 + Tailwind CSS v3. Uses plain `fetch` and no UI libraries.

## Run

```bash
cd frontend && npm install && npm run dev
```

The app runs at http://localhost:5173 and talks to the FastAPI backend at `VITE_API_URL`
(default `http://localhost:8000/api`). Copy `.env.example` to `.env` to change it.

No backend running? `npm run dev:mock` runs the whole app on sample data in your browser,
following the same API contract. Data is kept in localStorage; clear site data to reset it.

Demo admin: **admin@codeclash.dev / admin123**

Other scripts:

- `npm run build`: production build into `dist/`
- `npm run preview`: serve the build on port 5173
- `npm run lint`: run oxlint

## Structure

```
src/
  main.jsx, App.jsx (routes), index.css (Tailwind + small component classes)
  api.js        request() helper: token, 401 → /admin/login, FastAPI error parsing; one function per endpoint
  severity.js   client mirror of the severity rules (live preview only; the server decides)
  constants.js  severity/status colours, category fallback list, safety tips, en-IN date helpers
  mock.js       in-browser backend used only by `npm run dev:mock`
  components/   SeverityBadge, StatusChip, CategoryTile, StatCard, CriticalBanner, IncidentTable,
                ReasonChips, Timeline, ConfirmDialog, Toast, AdminLayout, PublicLayout, Spinner,
                EmptyState (+ ErrorState), Logo
  pages/        ReportPage, ReportSuccessPage, TrackPage, LoginPage, DashboardPage,
                IncidentsPage, IncidentDetailPage
```

## Routes

| Route | Screen |
|---|---|
| `/` → `/report` | Report an emergency: category tiles, live severity preview, GPS, contact info |
| `/report/success` | Reference code with Copy button, summary, "Why this severity?" |
| `/track?ref=` | Status lookup by reference code |
| `/login`, `/register` | Citizen sign in and sign up |
| `/account` | My reports: the signed-in citizen's own reports with live progress |
| `/admin/login` | Admin sign in (citizen accounts are refused) |
| `/admin` | Dashboard: critical banner, stat cards, category bars, status/severity bars, latest 5; refreshes every 15s |
| `/admin/incidents` | Search, filters and sort, all kept in the URL; status chips; ⋯ menu; pages of 10; cards on mobile |
| `/admin/incidents/:id` | Detail: status update with note, severity override, timeline, contact, delete |

## Accounts and anonymous reports

- **One session for everyone.** Citizens and admins share one session, and the `role` decides access. `/admin` requires `role: "admin"`.
- **How a report gets linked.** When a signed-in citizen reports, the token is sent and the server links the report to their account. The "Report anonymously" switch sends `anonymous: true` instead, and the server must not store the user's id.
- **Signed-out reports** never send a token, so they are anonymous.
- **Expired sessions.** If the token has expired, the app resubmits the report anonymously, so a report is never lost.
- **Admins** see a Registered or Anonymous badge on every incident, and a "By reporter" bar on the dashboard.
- **Current backend.** Until it adds the account endpoints, sign-up shows a clear "not enabled yet" message and every report is anonymous.
- **Backend spec:** [`docs/server-auth-plan.md`](../docs/server-auth-plan.md).

Citizen demo in mock mode: `priya@example.com / priya1234`.

## Trust layer (v2)

**Core rule:** low trust never hides or delays an emergency. Trust is shown next to severity, never instead of it, and active Critical incidents stay red and on top even when unverified.

**Report form**

- **Device id:** every report sends `X-Device-Id`, a random per-browser UUID from `src/lib/device.js`.
- **Location:** "Use my location" (`src/hooks/useGeolocation.js`) shows the GPS accuracy, warns when it is above 1 km, and handles denied, timeout and no-HTTPS cases.
- **Typed address:** optional once GPS is attached, because the server reverse-geocodes it. Older servers that still require it get the coordinates as text.
- **Honeypot:** a hidden `website` field, which real people never fill.
- **429 (rate limit):** shows a live countdown and a big "Call 112 now" button. The countdown survives a page reload.
- **Network or 500 errors:** keep everything typed and offer a Retry button.

**Success page**

- Shows the verification badge, plus "report n of N" when other people reported the same incident.
- Trust scores are never shown to the public.

**Admin**

- **Incidents list:**
  - Trust and Verification columns, with a cluster pill next to the title.
  - Filters: Verification dropdown, "Suspicious only" and "Corroborated" chips, "Group by incident" (with expandable member rows) and "Show duplicates", all kept in the URL.
  - Row styles: suspicious rows get a dashed amber edge; false alarms are faded with the title struck through.
- **Incident detail:**
  - The header shows the trust meter, cluster pill and cluster estimate, plus a duplicate banner when relevant.
  - A Verification panel with signed trust reasons, location info, and "Mark verified" and "False alarm" buttons (with confirmation and an optional note).
  - An AI check card that polls every 3 s for up to 30 s, and a Related reports card.
- **Dashboard:** a second stat row (Corroborated, Unverified, Suspicious, False alarms, Rate-limited today), a largest-cluster callout, and a critical banner showing the verification breakdown.

**Against a backend without the trust layer,** every trust widget hides itself and nothing breaks.

**The mock backend** (`npm run dev:mock`) simulates the whole layer:
- rate limit of 3 reports per 10 minutes per device,
- AI check that finishes about 5 s after a report,
- trust scoring,
- 1.5 km / 3 h clustering,
- same-device duplicates within 30 minutes,
- verification and device reputation.

### Trust layer test script (`npm run dev:mock`)

1. **Location and success page.** On `/report`, use **Use my location** and allow it. A chip shows the accuracy (e.g. "GPS attached · ±40 m"). Submit, and the success page shows **Unverified** with "We're verifying your report in the background". In Velachery it joins the seeded cluster and shows **Corroborated** instead.
2. **Rate limit.** Submit 4 reports quickly from one browser. The 4th shows the 429 panel with a countdown and **Call 112 now**, and Submit stays disabled.
3. **Suspicious report.** Submit "test asdf". In the admin list it shows **Suspicious** with a dashed edge, and its AI check card says it looks like gibberish or a test.
4. **Clusters.** The seed data has three Velachery flood reports. **Group by incident** shows one row ×3, all **Corroborated**, and the chevron lists the members with distance and time apart.
5. **False alarm.** Open one member, choose **False alarm**, add a note and confirm. The badge changes to ~~False Alarm~~, the cluster drops to ×2, and the dashboard's Corroborated and False alarms counts update.

## Manual test script

1. **Submit a Critical report.** On `/report`, pick **Building Collapse**.
   - Title: *Building collapsed near market*
   - Description: *Two-storey building collapsed, people trapped under debris, child missing.*
   - Location: *Vandalur Market*
   - People affected: **8**

   The live preview shows **CRITICAL** with reason chips. Click **🚨 Submit Emergency Report**.
2. **Check the success page.** It shows the reference code (click **Copy** to get a "Copied" toast) and the server's severity reasons. **Track status** opens `/track` with the code filled in.
3. **Log in.** Go to `/admin/login` and sign in with `admin@codeclash.dev` / `admin123`.
4. **Check the dashboard banner.** The red banner reads "N active critical incidents" and lists the new report. **View** opens the incident list filtered to Critical.
5. **Change the status twice.** Open the incident, choose **In Progress**, add a note, then **Save status**. You get a toast and a new timeline entry. Repeat with **Resolved**. On `/admin`, Resolved goes up by one, and the banner drops by one or disappears.
6. **Delete a duplicate.** On `/admin/incidents`, open the **⋯** menu on any row and choose **Delete**, then **Delete** again in the dialog. The toast reads "Incident deleted" and the total goes down by one.
