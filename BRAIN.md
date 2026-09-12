# 🧠 BRAIN.md — Argus Project Memory
### Last updated: 2026-09-11 | PS06 Hackathon — PPE/Fire Compliance Detection

> **Purpose of this file:** Drop-in context for anyone joining, resuming, or reviewing this project.
> Read this first, then read the specific doc you need.
> Update the "Current Status" and "Last Session" sections every time you make meaningful progress.

---

## 🎯 What This Project Is

**Argus** is an AI-powered safety compliance platform built for a hackathon (PS06).

It detects:
- **PPE violations** (no helmet, no vest, no boots, no gloves, no goggles)
- **Fire & smoke hazards**

From a single **uploaded pre-recorded video** — not live CCTV (MVP scope).

The detected events become **Incidents** on a real-time dashboard with:
- Zone labelling, severity, confidence score, evidence snapshot
- Acknowledgement workflow

**Golden Path:**
```
Video Upload → Frame Extraction (2 FPS) → AI Inference (PPE + Fire)
→ 2-of-3 Debounce → Zone Mapping → Incident in DB → Dashboard → Acknowledge
```

---

## 👥 Team Roles

| Person | Role | Owns |
|---|---|---|
| **P1** | ML/CV Engineer | Datasets, YOLO fine-tuning, inference wrapper |
| **P2** | Backend/Data Engineer | FastAPI, PostgreSQL, schemas, incident engine |
| **P3** | Frontend/Product Engineer | React/TS dashboard, upload UI, API integration |
| **P4** | Integration/DevOps/QA Lead | Repo wiring, environment, demo reliability |

---

## 📁 Repository Map

```
hackthon-/
├── BRAIN.md                        ← YOU ARE HERE
├── 01_INFORMATION_RESOURCES.md    # Datasets, packages, tools (sourced from Blueprint)
├── 02_SYSTEM_DESIGN.md            # Architecture, API contracts, DB schema, screen map
├── 03_IMPLEMENTATION_PLAYBOOK.md  # Milestones M0–M6, phases 1–7, testing strategy
│
└── frontend/                       # ✅ COMPLETE (MVP UI)
    ├── .env.example                # Copy → .env, set VITE_API_BASE_URL
    ├── index.html                  # SEO tags, emoji favicon
    ├── package.json
    └── src/
        ├── main.tsx                # Entry point + StrictMode
        ├── App.tsx                 # BrowserRouter + 4 routes
        ├── index.css               # Design system (tokens, utilities, animations)
        │
        ├── api/
        │   ├── types.ts            # ★ SHARED CONTRACT — all TS interfaces for API data
        │   ├── client.ts           # ★ USE_MOCK flag here — flip to false for real backend
        │   └── mockData.ts         # 5 incidents, 5 cameras, 3 zones, job simulation
        │
        ├── hooks/
        │   ├── usePolling.ts       # Generic polling hook (dashboard 3s, upload 2s)
        │   └── useToast.ts         # Toast notification state
        │
        ├── components/
        │   ├── layout/
        │   │   ├── AppLayout.tsx   # Sidebar + main + toast container
        │   │   └── Sidebar.tsx     # Logo, nav links, live dot, open count badge
        │   └── ui/
        │       ├── Badge.tsx       # Severity/status/camera badges + type helpers
        │       ├── Spinner.tsx     # Amber SVG spinner (sm/md/lg + PageSpinner)
        │       ├── Toast.tsx       # ToastList component
        │       ├── EmptyState.tsx  # No-data placeholder
        │       └── ErrorState.tsx  # API error + retry button
        │
        └── pages/
            ├── Upload.tsx          # Drag/drop, validation, progress, poll job status
            ├── Dashboard.tsx       # Incident feed, filters, stats, polling, cards
            ├── IncidentDetail.tsx  # Detail + snapshot + optimistic ACK + rollback
            └── Cameras.tsx         # Zone-grouped table, read-only
```

> **backend/**, **ml/**, **data/**, **scripts/** — not yet created (Phases 2–3).

---

## ✅ What Is Done

### Frontend — 100% MVP Complete
- [x] **Vite + React + TypeScript** scaffold at `frontend/`
- [x] **Design system** — dark industrial theme (navy/amber/red), CSS custom properties, Inter font
- [x] **API layer** — typed `fetch` wrappers with `USE_MOCK` toggle, no Axios dependency
- [x] **Mock data** — realistic incidents, cameras, job simulation (works entirely offline)
- [x] **usePolling hook** — generic, reusable, handles cleanup on unmount
- [x] **All 4 MVP pages** (Upload, Dashboard, Incident Detail, Cameras)
- [x] **All UX states** — loading skeletons, empty states, error+retry, processing, done
- [x] **Optimistic ACK** — button updates immediately, rolls back with toast on API failure
- [x] **Filters** — zone / incident type / status on Dashboard
- [x] **Summary stats** — total / open / high-severity / acknowledged counts
- [x] **Confidence bars** — colour-coded per severity
- [x] **Evidence snapshot** — image with graceful fallback if URL missing
- [x] **Breadcrumb** — Incident Detail → Dashboard
- [x] **Live indicator** — pulse dot in sidebar shows polling is active
- [x] **TypeScript** — 0 errors (`npx tsc --noEmit`)
- [x] **Dev server** — running at `http://localhost:5173`
- [x] **SEO** — title, meta description, OG tags, favicon

---

## 🚧 What Is NOT Done (Next Steps)

### Backend — Phase 3 (P2 owns)
- [ ] FastAPI app scaffold (`backend/main.py`, routers, schemas, models)
- [ ] PostgreSQL schema (zones, cameras, incidents, detections, evidence)
- [ ] DB seeded with 3 zones + 5 cameras
- [ ] `GET /incidents`, `POST /incidents/{id}/ack`, `GET /cameras` endpoints live
- [ ] `POST /demo/upload` + `GET /demo/status/{job_id}` endpoints live
- [ ] All response shapes must match `frontend/src/api/types.ts`

### ML — Phase 2 (P1 owns)
- [ ] Construction-PPE dataset downloaded
- [ ] gengyanlei fire-smoke baseline weights downloaded
- [ ] YOLOv8n fine-tuned on Construction-PPE
- [ ] `ml/inference_wrapper.py` exposing `run_ppe(frame)` / `run_fire(frame)`
- [ ] Output matches agreed JSON contract (see `02_SYSTEM_DESIGN.md §C`)

### Integration — Phase 5 (P4 drives)
- [ ] Backend calls `run_ppe` / `run_fire` in background task
- [ ] End-to-end: upload video → incident on dashboard
- [ ] Debounce (2-of-3 rule) active
- [ ] Evidence snapshot stored and served

---

## 🔑 Critical Files for Each Role

| Role | Files to read first |
|---|---|
| **Anyone joining** | `BRAIN.md` (this file) → `02_SYSTEM_DESIGN.md` |
| **P1 (ML)** | `01_INFORMATION_RESOURCES.md`, `02_SYSTEM_DESIGN.md §C` |
| **P2 (Backend)** | `02_SYSTEM_DESIGN.md §D + §E`, `frontend/src/api/types.ts` |
| **P3 (Frontend)** | `frontend/src/api/client.ts` (USE_MOCK flag), `frontend/src/api/types.ts` |
| **P4 (QA/Integration)** | `03_IMPLEMENTATION_PLAYBOOK.md`, `02_SYSTEM_DESIGN.md §D` |

---

## 🔌 How to Connect Frontend to Real Backend (P2 → P4 handoff)

1. Open `frontend/src/api/client.ts`
2. Change line 22: `export const USE_MOCK = false;`
3. Create `frontend/.env`:
   ```
   VITE_API_BASE_URL=http://localhost:8000
   ```
4. Run `cd frontend && npm run dev`
5. The app will now call your real FastAPI endpoints
6. API responses **must** match shapes in `frontend/src/api/types.ts`

---

## 📋 API Contract Summary (from `02_SYSTEM_DESIGN.md §D`)

| Method | Path | Used by |
|---|---|---|
| `POST` | `/demo/upload` | Upload page — starts video processing |
| `GET` | `/demo/status/{job_id}` | Upload page — polled every 2s |
| `GET` | `/incidents` | Dashboard — polled every 3s |
| `GET` | `/incidents/{id}` | Incident Detail page |
| `POST` | `/incidents/{id}/ack` | Incident Detail — acknowledge button |
| `GET` | `/cameras` | Cameras page — polled every 30s |

All response types: see `frontend/src/api/types.ts`

---

## 🗂️ Milestone Tracker

| Milestone | Status | Notes |
|---|---|---|
| **M0** — Repo + Environment | ✅ Done | Frontend scaffold, docs, `.env.example` |
| **M1** — AI Baseline | ⬜ Not started | P1: YOLO models + inference wrapper |
| **M2** — Backend | ⬜ Not started | P2: FastAPI + PostgreSQL + CRUD |
| **M3** — Frontend | ✅ Done | All 4 pages, mock data, all UX states |
| **M4** — Golden Path | ⬜ Not started | Needs M1 + M2 complete |
| **M5** — Reliability | ⬜ Not started | Debounce, error handling, evidence |
| **M6** — Demo MVP | ⬜ Not started | Rehearsal, README, fallback plan |

---

## ⚙️ Running the Project

```powershell
# Frontend (works NOW — no backend needed, uses mock data)
cd frontend
npm install          # only needed once
npm run dev          # → http://localhost:5173

# TypeScript check (must stay at 0 errors)
npm run type-check   # or: npx tsc --noEmit

# Production build
npm run build
```

> Backend + ML commands will be added here when P2 and P1 complete their phases.

---

## 🧠 Design Decisions Locked In

| Decision | What | Why |
|---|---|---|
| **No Axios** | Use native `fetch` | Fewer dependencies per System Design doc |
| **No WebSocket** | Polling (3s dashboard, 2s upload status) | MVP simplification per `02_SYSTEM_DESIGN.md §D` |
| **No auth screen** | Single default user, no login page | Deferred per Open Questions in System Design |
| **No CRUD for cameras** | Read-only list | Seeded data only for MVP |
| **`USE_MOCK` flag** | In `api/client.ts` line 22 | Team can switch mock ↔ real with one line, zero component changes |
| **`types.ts` as contract** | All data shapes in one file | Both P2 and P3 reference the same interfaces |
| **Dark industrial theme** | Navy/amber/red | Safety monitoring context; amber = caution, red = danger |

---

## ⚠️ Open Questions (from System Design)

| # | Question | Impact |
|---|---|---|
| 1 | Is auth (login screen) needed for the hackathon demo? | If yes, add `Login.tsx` + JWT handling |
| 2 | Debounce: 2-of-3 or 3-of-5 frames? | Backend logic only — UI doesn't change |
| 3 | Confidence threshold: 0.5 is a placeholder | Backend/ML only |
| 4 | Severity rule: should fire always be "high" regardless of confidence? | Affects badge colours on cards |
| 5 | Evidence snapshot privacy/redaction before demo? | May affect how snapshots are displayed |

---

## 📝 Last Session Log

### 2026-09-11 (Session 1)
- **Who:** Antigravity AI (P3 role — Frontend)
- **What was done:**
  - Read all 3 planning docs (`01_INFORMATION_RESOURCES.md`, `02_SYSTEM_DESIGN.md`, `03_IMPLEMENTATION_PLAYBOOK.md`)
  - Created implementation plan, got team approval
  - Scaffolded Vite + React + TypeScript project at `frontend/`
  - Built complete MVP UI: 4 pages, 7 UI components, API layer, hooks, design system
  - TypeScript: 0 errors. Dev server: running at `http://localhost:5173`
  - Browser verified: all 4 pages render correctly with mock data
- **Status after session:** M3 complete. Frontend is merge-ready and team-handoff ready.
- **Next up:** P2 builds FastAPI backend (Phase 3). P1 downloads datasets and sets up models (Phase 2).

---

*Update this file at the end of every work session. Keep it honest — stale BRAIN.md is worse than no BRAIN.md.*
