# 03 — IMPLEMENTATION PLAYBOOK (MVP)
### SentinelView — PS06 PPE/Fire Compliance Detection | 4-Person Team

**Priority order for this document:** WORKING > COMPLETE > RELIABLE > POLISHED > OPTIMIZED.

---

## Team Roles

| Person | Role | Owns |
|---|---|---|
| **P1** | ML/CV Engineer | Datasets, model setup/fine-tuning, inference wrapper, detection output |
| **P2** | Backend/Data Engineer | FastAPI, PostgreSQL, schemas, incident engine, zone mapping, pipeline orchestration |
| **P3** | Frontend/Product Engineer | React/TS dashboard, upload screen, incident UI, API integration, UX states |
| **P4** | Integration/DevOps/QA Lead | Repo setup, environment, connecting all three layers **from Day 1**, deployment, testing, demo reliability |

**Critical rule (explicit in instructions):** P4 integrates continuously, not just at the end. P4 attends every handoff point below.

---

## MVP Scope Freeze

| Bucket | Items |
|---|---|
| **MUST HAVE** | Single-video upload, frame extraction, PPE detection, fire/smoke detection, person-PPE association, 2-of-3 debounce, static zone mapping, incident creation + snapshot storage, incident list + detail on dashboard, acknowledgement, graceful error states |
| **SHOULD HAVE** (only if golden path is stable) | Own-footage validation clips run through the pipeline, basic confidence display on incident cards, minimal camera/zone read-only screen polish |
| **LATER (explicitly out of MVP)** | Live CCTV/RTSP ingestion, multi-camera concurrency (**conflict flagged in 02_SYSTEM_DESIGN.md** — Blueprint V3 wanted this as P0; deferred here per MVP-first instruction), WebSocket push, Redis pub/sub, ONNX export, WhatsApp/SMS/email notifications, analytics/trend charts, role-based multi-user admin, Kubernetes/microservices, any LLM/RAG/vector DB, blockchain |

---

## Integration Contract (agreed before Phase 1 ends)

Internal ML output → Backend transforms → Frontend consumes. See `02_SYSTEM_DESIGN.md` §D for the exact JSON shapes. **P1 and P2 must agree on the raw detection JSON shape before P1 starts training** so P2 can build against a mock of it in parallel.

**Mocking strategy for parallel work:**
- P2 can build the Incident API against a **hand-written mock detection JSON** (matching the agreed contract) before P1's model exists.
- P3 can build the Dashboard/Upload UI against **mocked `/incidents` and `/demo/status` responses** before P2's real endpoints exist.
- P4 wires real components together as they become available, replacing mocks incrementally — never waiting for a "big bang" integration at the end.

---

## Milestones

| Milestone | Definition |
|---|---|
| **M0 — Repo + Environment** | Everyone can clone and run the project locally (empty/stub services acceptable) |
| **M1 — AI Baseline** | Uploaded video → PPE model + fire model → raw detection JSON printed to console/log (no DB yet) |
| **M2 — Backend** | API + database live; Incident CRUD works against mock detection data |
| **M3 — Frontend** | Dashboard + Upload screen connected to backend (real or mocked) |
| **M4 — Golden Path** | Real video → real detection → real incident → real dashboard display, end to end |
| **M5 — Reliability** | Debounce active, error handling in place, evidence snapshots stored, acknowledgement works |
| **M6 — Demo MVP** | Full end-to-end flow works repeatedly (10/10), rehearsed, documented |

---

## Phase-by-Phase Plan

### Phase 1 — Foundation
- **Objective:** Everyone can run something.
- **Owner:** P4 (repo/env), all contribute stubs.
- **Dependencies:** None.
- **Tasks:**
  - P4: create repo structure (`02_SYSTEM_DESIGN.md` §G), `.env.example`, `README.md` setup instructions.
  - P2: stub FastAPI app (`main.py`, empty routers), plus local PostgreSQL setup instructions in `README.md`. **[DECISION]** Docker/`docker-compose` is optional convenience only, not a requirement — nothing in the source Blueprint calls for containerization, and adding it unprompted risks the "unnecessary infrastructure" rule. Use it only if the team is already comfortable with it; a plain local Postgres install is equally valid for MVP.
  - P1: download Construction-PPE + gengyanlei fire-smoke baseline (per `01_INFORMATION_RESOURCES.md`).
  - P3: scaffold React app with routing stubs for the 4 core screens.
  - **P1 and P2 finalize the ML→Backend JSON contract before this phase ends.**
- **Expected files:** repo skeleton, `.env.example`, empty routers, dataset files downloaded (gitignored), React route stubs.
- **Integration point:** P4 confirms all 4 members can run their piece locally.
- **Verification:** clean clone + setup script → each service starts without error.
- **Definition of Done:** M0 reached.
- **Parallel:** all 4 tasks above run simultaneously.
- **Must NOT start before this:** nothing — this is Phase 1.

---

### Phase 2 — AI Baseline
- **Objective:** Get real detections out of real models.
- **Owner:** P1.
- **Dependencies:** Phase 1 datasets downloaded.
- **Tasks:**
  - Fine-tune YOLOv8n/YOLO11n on Construction-PPE (short training run, MVP does not need many epochs — enough to produce reasonable boxes, not competition-grade accuracy yet).
  - Load pretrained fire/smoke baseline weights (no fine-tuning required for MVP).
  - Write `ml/inference_wrapper.py` (or equivalent) exposing `run_ppe(frame)` / `run_fire(frame)` returning the agreed JSON contract.
  - Test against 2–3 sample images/clips, confirm output matches the contract shape exactly.
- **Expected files:** `ml/ppe_model/weights/best.pt`, `ml/fire_model/weights/<baseline>.pt`, `ml/inference_wrapper.py`.
- **Integration point:** hand the wrapper functions + a sample output JSON to P2.
- **Verification:** wrapper runs standalone (`python inference_wrapper.py test.jpg`) and prints valid contract JSON.
- **Definition of Done:** M1 reached.
- **Parallel with:** Phase 3 (Backend) and Phase 4 (Frontend) — both proceed against mocks while this runs.
- **Must NOT start before:** Phase 1 dataset download complete.

---

### Phase 3 — Backend Core
- **Objective:** API + DB live, working against mock detections.
- **Owner:** P2.
- **Dependencies:** Phase 1 contract agreed; does NOT depend on Phase 2 finishing (uses mock JSON).
- **Tasks:**
  - Implement DB schema (`02_SYSTEM_DESIGN.md` §E) via SQLAlchemy models + migrations.
  - Seed zones/cameras (static MVP mapping).
  - Implement `incidents.py`, `cameras.py` routers against real DB.
  - Implement `incident_service.py`: given a mock detection JSON, create an Incident + Evidence row.
  - Implement `demo.py` upload endpoint (accept file, store to `UPLOAD_DIR`, return `job_id`) — processing logic itself can be a stub returning "done" immediately for now.
- **Expected files:** `backend/models/`, `backend/schemas/`, `backend/routers/incidents.py`, `backend/routers/cameras.py`, `backend/routers/demo.py`, `backend/services/incident_service.py`.
- **Integration point:** P3 can now build against real (not mocked) `/incidents` and `/cameras` endpoints.
- **Verification:** Postman/curl tests for every endpoint in `02_SYSTEM_DESIGN.md` §D's API table.
- **Definition of Done:** M2 reached.
- **Parallel with:** Phase 2 (ML) and Phase 4 (Frontend).
- **Must NOT start before:** Phase 1 contract agreed.

---

### Phase 4 — Frontend Core
- **Objective:** Dashboard shell navigable with data (mocked or real).
- **Owner:** P3.
- **Dependencies:** Phase 1 route stubs; can start against a hand-written mock `/incidents` response before Phase 3 finishes.
- **Tasks:**
  - Build Upload screen (file input + status polling UI, initially against a mock).
  - Build Dashboard (incident list, polling every ~3s).
  - Build Incident Detail (snapshot placeholder, ack button).
  - Build all required UX states (loading/empty/error) per `02_SYSTEM_DESIGN.md` §F.
- **Expected files:** `frontend/src/pages/Upload.tsx`, `Dashboard.tsx`, `IncidentDetail.tsx`, `frontend/src/api/client.ts`.
- **Integration point:** swap mock API base URL for P2's real backend as soon as Phase 3 endpoints are live.
- **Verification:** manual click-through of all 4 screens with mock data, no console errors.
- **Definition of Done:** M3 reached.
- **Parallel with:** Phase 2, Phase 3.
- **Must NOT start before:** Phase 1 route stubs exist.

---

### Phase 5 — Core Integration (Golden Path)
- **Objective:** Real video in, real incident out, visible on real dashboard.
- **Owner:** P4 (drives), P1+P2 pair to wire inference into the backend pipeline.
- **Dependencies:** Phase 2 wrapper working, Phase 3 DB/API working, Phase 4 frontend pointed at real backend.
- **Tasks:**
  - P2 implements `demo.py`'s real processing: on upload, run background task calling P1's `run_ppe`/`run_fire` on extracted frames.
  - P2 implements `detection_processing.py` (person-PPE association) and `zone_mapping.py` (static lookup).
  - **Debounce deferred to Phase 6** — for this phase, create an incident on the *first* confident detection to prove the path works end-to-end fast.
  - P4 runs the full path with one real test video and confirms an incident appears on the dashboard.
- **Expected files:** working `backend/services/detection_processing.py`, `zone_mapping.py`, real background task in `demo.py`.
- **Integration point:** this IS the integration point — all three layers meet here.
- **Verification:** upload a real test clip → see a real incident on the dashboard within a reasonable time.
- **Definition of Done:** M4 reached.
- **Parallel:** none — this phase requires P1+P2+P4 focused together; P3 can simultaneously polish UI states not on the critical path.
- **Must NOT start before:** Phase 2, 3, and 4 all individually verified.

---

### Phase 6 — Reliability Pass
- **Objective:** Make the golden path trustworthy, not just functional once.
- **Owner:** P2 (debounce, error handling), P1 (confidence tuning), P3 (evidence display, ack UI polish), P4 (drives testing).
- **Dependencies:** Phase 5 golden path working.
- **Tasks:**
  - P2: implement the real 2-of-3 debounce logic (`debounce.py`), replacing Phase 5's "first detection" shortcut.
  - P2: add error handling for invalid video, model inference failure, DB failure (see Testing section below).
  - P1: tune confidence threshold using a handful of real test clips (own-footage capture can start here if time allows — SHOULD HAVE).
  - P3: display confidence + snapshot image properly on Incident Detail; finish ack flow with optimistic update + error rollback.
  - P4: run the E2E test repeatedly (target 10/10 success).
- **Expected files:** `backend/services/debounce.py` (real implementation), updated error handling across routers.
- **Integration point:** re-run Phase 5's test video, confirm debounce doesn't break the golden path.
- **Verification:** E2E test passes 10/10; each failure-test case (below) behaves gracefully, not with a crash.
- **Definition of Done:** M5 reached.
- **Parallel:** the four sub-tasks above can run mostly in parallel since they touch different files.
- **Must NOT start before:** Phase 5 golden path confirmed working at least once.

---

### Phase 7 — Demo Preparation
- **Objective:** MVP is demo-ready, not just code-complete.
- **Owner:** P4 (drives), all participate in rehearsal.
- **Dependencies:** Phase 6 complete.
- **Tasks:**
  - Select and lock the primary demo video clip(s) (pre-recorded, documented as such).
  - Run 3 full dry-run demos end-to-end.
  - Write `README.md` setup instructions verified by a clean clone (not just "it works on my machine").
  - Prepare a one-page fallback plan: if live processing fails, what's shown instead (per Blueprint's Demo Engineering matrix — same principle applies at MVP scale, minus the multi-camera parts).
- **Expected files:** finalized `README.md`, demo script notes in `docs/`.
- **Integration point:** final full-team review of the demo flow.
- **Verification:** 3/3 dry runs succeed without manual intervention.
- **Definition of Done:** M6 reached — MVP complete per checklist below.
- **Parallel:** none — full team focus.
- **Must NOT start before:** Phase 6 Definition of Done met.

---

## Testing Strategy

### Unit Tests
- `detection_processing.py`: person-PPE bbox overlap logic (compliant/non-compliant cases).
- `debounce.py`: 2-of-3 logic with synthetic frame-signal sequences.
- `zone_mapping.py`: camera→zone lookup, including unknown-camera case.

### Integration Tests
- Backend ↔ Database: incident creation persists and is retrievable.
- Backend ↔ ML wrapper: wrapper output correctly consumed by `detection_processing.py`.
- Frontend ↔ Backend: Dashboard correctly renders a live API response (not just a mock).

### End-to-End Test (primary)
**Upload video → process → detect → validate → map zone → create incident → store DB → display dashboard → acknowledge incident.**
This is the single most important test in the project — it must be run manually at the end of every phase from Phase 5 onward, and automated if time allows.

### Failure Tests (must degrade gracefully, not crash)
| Case | Expected Behavior |
|---|---|
| Invalid video file | 400 error, clear frontend message |
| Empty/corrupt video | Backend logs error, marks job "failed," frontend shows failure state, not infinite spinner |
| Model loading failure at startup | App fails fast with a clear log message, not a silent hang |
| Inference failure on one frame | Frame skipped, logged, processing continues |
| Database failure | API returns 500, frontend shows retry-able error state |
| API failure (backend down) | Frontend shows a clear "can't reach server" state, not a blank screen |
| Missing zone for a camera | Incident still created with `zone: "Unassigned"` rather than failing the whole pipeline |
| Malformed detection JSON | Backend validates shape, rejects/logs rather than crashing the background task |
| Frontend API failure mid-poll | Polling retries with backoff, doesn't spam errors to the user |

---

## Demo Requirement

- Demo does **not** depend on live internet, a live external API, or an untested model.
- Video input is explicitly a **pre-recorded, pre-tested clip** — this is documented openly, not disguised as "live CCTV."
- No manually-edited database rows for the demo — every incident shown must have been produced by the real pipeline running on the real clip.
- No fake/hardcoded frontend data in the demo build — the Upload/Demo screen is the actual entry point, not a bypass.

---

## Definition of Done (MVP)

- [ ] Repository runs from a clean clone using only `README.md` instructions
- [ ] Frontend runs (`npm start` or equivalent)
- [ ] Backend runs (`uvicorn` or equivalent)
- [ ] Database runs and schema is seeded
- [ ] Both models load successfully at backend startup
- [ ] A video can be uploaded and processed
- [ ] PPE detection produces at least one correct result on the test clip
- [ ] Fire/smoke detection produces at least one correct result on the test clip
- [ ] A confirmed detection becomes an Incident (post-debounce)
- [ ] Zone information is attached to the incident
- [ ] Incident is stored in PostgreSQL
- [ ] Dashboard displays the incident
- [ ] Evidence/snapshot image is displayed on Incident Detail
- [ ] Acknowledgement works and updates status
- [ ] All 9 failure-test cases above behave gracefully (no crash)
- [ ] End-to-end flow succeeds 10/10 consecutive runs
- [ ] Setup instructions are documented and verified by someone other than the original author

**MVP is not "done" until every box above is checked — partial completion is not completion.**

---

## Source of Truth
- Main Hackathon Blueprint (`PS06_Final_Master_Hackathon_Blueprint.md`) — only source used.
- `02_SYSTEM_DESIGN.md` (this session's companion document) for schema/API/architecture references.

## Open Questions
- **[OPEN]** Exact epoch/training-time budget for P1's PPE fine-tune — not specified in any source file; team must decide based on remaining time when Phase 2 starts.
- **[OPEN]** Whether authentication is in MVP scope at all (see `02_SYSTEM_DESIGN.md` Open Questions) — affects whether Phase 1 needs an `auth.py` stub.
- **[OPEN]** Target hardware for the demo (team laptop CPU specs) — affects realistic FPS expectations, not confirmed in source.

## MVP Boundary
This playbook covers Phases 1–7, ending at a working, rehearsed, single-video-upload MVP (M0–M6). It explicitly does **not** cover: multi-camera scalability work, own-footage validation as a blocking gate, model accuracy optimization beyond "works on the test clip," or any competitive-hardening work from the Blueprint's Version 3. Those resume in a separate post-MVP cycle, as instructed.
