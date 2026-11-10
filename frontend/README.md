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
| `/admin/login` | Admin sign in |
| `/admin` | Dashboard: critical banner, stat cards, category bars, status/severity bars, latest 5; refreshes every 15s |
| `/admin/incidents` | Search, filters and sort, all kept in the URL; status chips; ⋯ menu; pages of 10; cards on mobile |
| `/admin/incidents/:id` | Detail: status update with note, severity override, timeline, contact, delete |

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
