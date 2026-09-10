# 01 — INFORMATION & RESOURCES (MVP)
### SentinelView — PS06 PPE/Fire Compliance Detection

**Note on sourcing:** Only one of the four referenced files — the **Main Hackathon Blueprint** (`PS06_Final_Master_Hackathon_Blueprint.md`, generated earlier in this chat) — was actually supplied. The "Hackathon PRD," "Information/Resources Markdown," and "System/Design Markdown" were referenced but never uploaded. Everything below is derived from the Blueprint only. Anything the missing three files would normally confirm is marked **[VERIFY BEFORE USE]**.

---

## 1. Datasets for MVP

**MVP decision rule:** use the fastest-to-bring-up option per pipeline, not the largest. Broader/merged datasets are explicitly deferred (see MVP Boundary).

### A. PPE Detection

| Use | Dataset | Source/Location | Classes | Access Method | Prep Needed |
|---|---|---|---|---|---|
| **MVP primary** | Ultralytics Construction-PPE | docs.ultralytics.com/datasets/detect/constructionppe | 11 classes: helmet, gloves, vest, boots, goggles + missing-gear variants | Direct download via Ultralytics docs page / YOLO-format zip | None — already YOLO-format, ready to train |
| **Post-MVP (SHOULD/LATER)** | SH17 | ScienceDirect SH17 dataset paper | 17 classes, broader industrial coverage | Per paper's dataset link [VERIFY BEFORE USE — exact download URL not in source] | Format conversion may be needed depending on export |
| **Post-MVP (LATER, only if role-based helmet color demoed)** | CHV (Color Helmet & Vest) | Search "CHV dataset PPE" on Roboflow Universe | Helmet colors + vest | Roboflow download | None if pulled via Roboflow SDK |

**[FACT — Blueprint]** Construction-PPE is explicitly recommended as the starting dataset because it's "clean, small, fast to prototype." This is the correct MVP choice.

### B. Fire & Smoke Detection

| Use | Dataset/Repo | Source/Location | Notes | Access Method |
|---|---|---|---|---|
| **MVP primary (fast-start)** | gengyanlei fire-smoke-detect-yolov4 | github.com/gengyanlei/fire-smoke-detect-yolov4 | 10,827 imgs, Pascal VOC → convertible to YOLO, **comes with pretrained YOLOv5 weights** | `git clone` from GitHub |
| **Alternative fast-start** | Roboflow fire-and-smoke (fire-rqbio workspace) | github.com/luminous0219/fire-and-smoke-detection-yolov8 | Comes with a trained YOLOv8n model, fine-tunable directly | `git clone` from GitHub |
| **Post-MVP (SHOULD/LATER, accuracy upgrade)** | FireAndSmoke (Catargiu et al., 2024) | Referenced in Sensors journal, DOI 10.3390/s24175597 | 22,000+ imgs / 93,000 instances — largest, most rigorous set; requires locating dataset link via the paper | [VERIFY BEFORE USE — exact download URL not in source, only the DOI/paper reference is] |

**[FACT — Blueprint]** The gengyanlei/Roboflow options are explicitly recommended as "a fast-start baseline with existing pretrained weights if hackathon time is short" — this matches the MVP-first objective exactly.

### C. Own Captured Footage (post-M4 validation, not blocking golden path)
- Not a downloadable dataset — captured locally on campus/lab per the validation plan already in the Blueprint (§33 of the Blueprint document).
- **MVP Boundary note:** capturing/labeling this footage is valuable but is a **SHOULD HAVE**, not required to reach a working golden path. Do not let it block M4.

---

## 2. Training / Fine-Tuning Resources

| Resource | Purpose | Source |
|---|---|---|
| Ultralytics YOLOv8/YOLO11 | Base architecture for both PPE and fire/smoke fine-tuning | **[FACT — Blueprint]** named explicitly as "best speed/accuracy tradeoff" |
| Ultralytics `yolo` CLI | Training, validation, export (ONNX) | **[FACT — Blueprint]** listed under "Real-time inference" tooling |
| Roboflow (free tier) | Dataset hosting/versioning, one-line SDK download, auto train/val/test split, augmentation presets | **[FACT — Blueprint]** |
| CVAT or LabelImg | Annotation of own-captured footage (CVAT preferred for video frame extraction + team annotation) | **[FACT — Blueprint]** |

---

## 3. Model Resources

| Model | Role | Weights Source |
|---|---|---|
| YOLOv8n / YOLO11n (nano) | PPE detection — fine-tuned on Construction-PPE | Ultralytics pretrained COCO weights, fine-tuned |
| YOLOv5 (pretrained, from gengyanlei repo) | Fire/smoke detection — MVP fast-start baseline | Bundled in gengyanlei/fire-smoke-detect-yolov4 repo |
| YOLOv8n (pretrained, from luminous0219 repo) | Fire/smoke detection — alternative fast-start | Bundled in luminous0219/fire-and-smoke-detection-yolov8 repo |

**[DECISION]** Nano-sized models chosen specifically because the Blueprint's demo-reliability strategy requires CPU-only inference to work without depending on venue GPU availability.

---

## 4. Required Python Packages (Backend + ML)

**Updated for consistency with `02_SYSTEM_DESIGN.md`'s MVP simplifications** (Redis and ONNX are explicitly deferred there — this table now matches).

| Package | Purpose | MVP? | Status |
|---|---|---|---|
| `ultralytics` | YOLO training/inference | **Yes** | **[FACT — Blueprint]**, named directly |
| `opencv-python` | Frame extraction from video | **Yes** | **[FACT — Blueprint]**, named directly ("OpenCV, ~2-5 FPS sampling") |
| `fastapi` | Backend API framework | **Yes** | **[FACT — Blueprint]**, named directly |
| `uvicorn` | ASGI server to run FastAPI | **Yes** | **[ASSUMPTION]** — standard FastAPI companion, not explicitly named in source; **[VERIFY BEFORE USE]** |
| `sqlalchemy` + `psycopg2-binary` | ORM + PostgreSQL driver | **Yes** | **[ASSUMPTION]** — PostgreSQL was the Blueprint's DB decision; the specific driver/ORM library wasn't named in source. **[VERIFY BEFORE USE]** |
| `pydantic` | Request/response schemas (ships with FastAPI) | **Yes** | **[ASSUMPTION]** — standard FastAPI dependency |
| `python-multipart` | File upload handling in FastAPI | **Yes** | **[ASSUMPTION]** — required by FastAPI for file uploads, not named in source. **[VERIFY BEFORE USE]** |
| `python-jose` or `pyjwt` | JWT auth | **Only if auth is in MVP scope — see Open Questions** | **[ASSUMPTION]** — Blueprint decided JWT auth but didn't name a library. **[VERIFY BEFORE USE]** |
| `passlib[bcrypt]` | Password hashing | **Only if auth is in MVP scope** | **[ASSUMPTION]** — Blueprint's security section says "hashed passwords (bcrypt)" but no library named. **[VERIFY BEFORE USE]** |
| `redis` (python client) | Pub/sub + dedupe cache | **No — LATER** | **[DECISION — MVP simplification, see 02_SYSTEM_DESIGN.md §D]**: polling replaces WebSocket push, so Redis is not required until that feature is built post-MVP. Redis itself remains a **[FACT — Blueprint]** technology choice for that later phase. |
| `onnxruntime` | ONNX inference (optimization) | **No — LATER** | **[DECISION — MVP simplification, see 02_SYSTEM_DESIGN.md §C]**: MVP uses native `ultralytics` CPU inference directly. ONNX export was the Blueprint's demo-reliability recommendation and remains the right move before the real hackathon demo — just not required to reach a working golden path. |

---

## 5. Frontend Packages

| Package | Purpose | Status |
|---|---|---|
| `react` + `typescript` | Core framework | **[FACT — Blueprint]**, named directly ("React + TypeScript") |
| `react-router-dom` | Page routing (Upload, Dashboard, Incident detail) | **[ASSUMPTION]** — standard React routing choice, not named in source. **[VERIFY BEFORE USE]** |
| `axios` or native `fetch` | API calls to backend | **[ASSUMPTION]** — not named in source; either is acceptable, `fetch` avoids an extra dependency. **[DECISION for MVP: use native fetch]** |
| Charting library (e.g., recharts) | Analytics screen | **[FACT — Blueprint]** mentions recharts only in the context of a broader claude-artifact environment reference, **not** confirmed as this project's chosen library. **[VERIFY BEFORE USE]** — and note analytics is SHOULD/LATER, not MVP-blocking. |

---

## 6. Database Requirements

| Component | Choice | MVP? | Source |
|---|---|---|---|
| Primary relational DB | PostgreSQL | **Yes** | **[FACT — Blueprint]**, explicit decision with rationale (relational integrity across zone/camera/incident) |
| Cache / pub-sub | Redis | **No — LATER** | **[FACT — Blueprint]**, explicit decision for real-time dedupe + WebSocket push, but that feature itself is deferred (see §4 above and 02_SYSTEM_DESIGN.md §D) — MVP has no component that needs Redis yet |
| Object storage (snapshots) | Local filesystem for MVP | **Yes** | **[DECISION — MVP simplification]**: Blueprint says "object storage" generically; for MVP, store snapshot images on local disk under a known path rather than standing up cloud object storage. Defer real object storage to LATER. |

---

## 7. Environment / Setup Requirements

| Requirement | Status |
|---|---|
| Python 3.10+ | **[ASSUMPTION]** — not explicitly stated in source; reasonable minimum for `ultralytics`. **[VERIFY BEFORE USE]** |
| Node.js 18+ | **[ASSUMPTION]** — not explicitly stated in source. **[VERIFY BEFORE USE]** |
| PostgreSQL 14+ | **[ASSUMPTION]** — version not specified in source. **[VERIFY BEFORE USE]** |
| Redis 7+ | **No — LATER**, not needed until WebSocket push is built post-MVP (see §4, §6 above) |
| CPU-only capable machine (no GPU dependency) | **[FACT — Blueprint]** — explicit demo-reliability requirement |
| `ngrok` (or equivalent tunnel) | **[FACT — Blueprint]** — named explicitly as the primary demo networking path |

---

## 8. Licensing Considerations

| Resource | License | Source |
|---|---|---|
| Roboflow/Ultralytics-hosted datasets | CC BY 4.0 | **[FACT — Blueprint]**, stated directly |
| gengyanlei / luminous0219 GitHub repos | **[VERIFY BEFORE USE]** — repo-level license not stated in source Blueprint; check each repo's LICENSE file before using bundled pretrained weights competitively |
| SH17, FireAndSmoke (Sensors journal) | **[VERIFY BEFORE USE]** — academic dataset licensing not confirmed in source |

---

## 9. Manual-Download vs. Locally-Generated Resources

**Must be downloaded manually / via SDK before Day 1 ends:**
- Construction-PPE dataset (Ultralytics)
- gengyanlei fire-smoke-detect-yolov4 repo (dataset + pretrained weights)
- (Optional fast-start alternative) luminous0219 fire-and-smoke-detection-yolov8 repo

**Can be generated/collected locally:**
- Own campus/lab validation footage (SHOULD HAVE, non-blocking for golden path)
- Roboflow augmentations (brightness/blur/rotation) applied to the downloaded PPE dataset
- Seed/demo data (mock cameras, zones) for frontend development before backend is ready

---

## Source of Truth
- Main Hackathon Blueprint (`PS06_Final_Master_Hackathon_Blueprint.md`) — **only** source used.

## Open Questions
- **[OPEN]** Exact download URLs for SH17 and FireAndSmoke datasets — only paper/DOI references exist in source, not direct dataset links.
- **[OPEN]** Repo-level licenses for gengyanlei and luminous0219 GitHub projects.
- **[OPEN]** Exact package versions (Python/Node/Postgres/Redis) — no version pins existed in any supplied file.
- **[OPEN]** Whether a frontend charting library is actually approved for this project, or was only referenced generically.

## MVP Boundary
This document covers **only** what's needed to reach a working golden path: PPE dataset, fast-start fire/smoke baseline, core backend/frontend/DB packages. It explicitly **excludes** (deferred to post-MVP): SH17/FireAndSmoke dataset merges, own-footage validation dataset construction, ONNX export/optimization, and any analytics-charting dependency.
