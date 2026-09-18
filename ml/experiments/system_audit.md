# System Audit Report
# Argus Safety Intelligence — PPE Detection System
# Generated: 2026-09-18

## 1. Project Structure

### Repository: C:\hackthon-
```
hackthon-/
├── backend/
│   ├── config.py          — Settings: DATABASE_URL, UPLOAD_DIR, EVIDENCE_DIR, MODELS_DIR
│   ├── db.py              — SQLAlchemy engine (SQLite default, PostgreSQL-swappable)
│   ├── main.py            — FastAPI app, CORS, static files, router registration
│   ├── models.py          — ORM: Zone, Camera, Incident, Detection, Evidence, ProcessingJob
│   ├── schemas.py         — Pydantic: UploadResponse, JobStatusResponse, IncidentResponse, etc.
│   ├── seed.py            — Default zones/cameras database seed
│   ├── routers/
│   │   ├── cameras.py     — Camera management endpoints
│   │   ├── demo.py        — /demo/upload, /demo/status/:id, /demo/infer-frame
│   │   └── incidents.py   — /incidents/* CRUD + acknowledge
│   └── services/
│       ├── annotator.py   — PIL-based evidence snapshot renderer
│       ├── debounce.py    — 2-of-3 temporal debounce filter (reduces spurious alerts)
│       └── pipeline.py    — Video processing worker (2 FPS sampling, 300 frame cap)
├── ml/
│   ├── inference_wrapper.py — PUBLIC API: run_ppe(), run_fire(), infer_frame()
│   └── weights/
│       ├── ppe_best.pt    — ORIGINAL HACKATHON MODEL [PRESERVED] SHA256=07172EF3...
│       ├── ppe_master.pt  — NEW MASTER MODEL         [PRESERVED] SHA256=12B23C4C...
│       ├── fire_best.pt   — Fire/Smoke detection model
│       └── yolov8n.pt     — Person detector (base YOLOv8n)
├── frontend/              — React/Vite TypeScript frontend
├── argus.db               — SQLite database (122 KB)
└── test_clip.mp4          — Test video (39 KB)
```

## 2. Inference Pipeline Flow

```
frame (numpy BGR array)
    ↓
[Person Detection] yolov8n.pt @ imgsz=416, conf=0.35
    → persons: List[bbox]
    ↓
[PPE Detection] ppe_master.pt @ imgsz=640, conf=0.30
    → ppe_items: {helmet, vest, gloves, goggles, mask, safety_shoe}
    ↓
[Spatial Matching]
    head_zone = person top 28%  → check helmet overlap (IoU ≥ 0.12)
    torso_zone = person 20-72%  → check vest overlap   (IoU ≥ 0.12)
    ↓
[Compliance State]
    COMPLIANT: PPE IoU ≥ 0.12
    UNCERTAIN: 0.12 > IoU ≥ 0.20 (low-confidence, reduced alarm confidence)
    VIOLATION: IoU < 0.20
    ↓
[Violations] returned as List[Dict]
    → class_name: no_helmet / no_vest
    → confidence: 0.88 / 0.84 (reduced to 0.60 if UNCERTAIN)
    → bbox: head/torso zone coordinates
    ↓
[Backend Pipeline] 2 FPS sampling, 2-of-3 temporal debounce
    → Incident DB write (if confirmed)
    → Evidence snapshot (PIL annotated JPEG)
    → WebSocket/REST response to frontend
```

## 3. Model Information

### ppe_best.pt (Legacy — PRESERVED)
- **File**: C:\hackthon-\ml\weights\ppe_best.pt
- **SHA256**: 07172EF3AE9E256C40A1FB0CE3EEFE5547D90170645AA73DDED0FFFC382CDB31
- **Size**: 5.6 MB
- **Architecture**: YOLOv8n (fine-tuned)
- **Classes**: 6 (Gloves, Vest, goggles, helmet, mask, safety_shoe)
- **Origin**: Hackathon training from Roboflow PPE v3 subset
- **Status**: PRESERVED — DO NOT DELETE

### ppe_master.pt (Primary)
- **File**: C:\hackthon-\ml\weights\ppe_master.pt
- **SHA256**: 12B23C4CFA5B4FBE2932B977D7E1D26D8081E54044DEB18EAB9A3AFEACCA0663
- **Size**: 5.9 MB
- **Architecture**: YOLOv8n (multi-stage fine-tuned)
- **Classes**: 6 (Gloves, Vest, goggles, helmet, mask, safety_shoe)
- **Training**: 22,138 images, 52,008 annotations, 4-dataset merge
- **Benchmark (test set, 2,261 images)**:
  - Precision: 69.07% | Recall: 56.65% | mAP@50: 60.19% | mAP@50-95: 36.27%
  - helmet: mAP@50=86.47% | Vest: mAP@50=82.87% | goggles: mAP@50=65.85%
  - mask: mAP@50=56.46% | Gloves: mAP@50=37.42% | safety_shoe: mAP@50=32.08%
- **Latency**: ~6.4 ms model inference (GTX 1650, imgsz=640)
- **Status**: ACTIVE PRIMARY

## 4. Dataset Inventory

### Master Dataset (C:\Model\PPE_Master_System\dataset)
| Split | Images | Annotations |
|:------|-------:|------------:|
| Train | 16,841 | 40,810 |
| Val   |  3,036 |  5,899 |
| Test  |  2,261 |  5,299 |
| **Total** | **22,138** | **52,008** |

### Source Datasets
| Dataset | Images | Notes |
|:--------|-------:|:------|
| Roboflow PPE v3 | 12,078 | All 6 PPE classes, 640x640 |
| SHWD (helmet) | 5,000 | 19,252 helmet annotations, Pascal VOC converted |
| CHV (helmet+vest) | 1,330 | Remapped to canonical IDs |
| SH17 Industrial | 3,730 | 11,422 annotations, all 6 classes |

**Original source datasets NOT available at C:\hackthon-\ — only in C:\Model\PPE_Master_System\dataset**

## 5. Class Mapping (Canonical — Both Models)
| ID | Class Name |
|:---|:-----------|
| 0 | Gloves |
| 1 | Vest |
| 2 | goggles |
| 3 | helmet |
| 4 | mask |
| 5 | safety_shoe |

**Both ppe_best.pt and ppe_master.pt use IDENTICAL class IDs — no remapping needed.**

## 6. Backend API Contract

### Public Functions (MUST NOT CHANGE SIGNATURE)
```python
run_ppe(frame: np.ndarray) -> List[Dict[str, Any]]
    # Returns: [{class_name, confidence, bbox}, ...]
    # class_name: "no_helmet" | "no_vest" | ...

run_fire(frame: np.ndarray) -> List[Dict[str, Any]]
    # Returns: [{class_name, confidence, bbox}, ...]
    # class_name: "fire" | "smoke"

infer_frame(frame: np.ndarray) -> Dict[str, Any]
    # Returns: {detections: [...], frame_width: int, frame_height: int}
    # Each detection: {class_name, label, confidence, bbox, is_violation}
```

### API Endpoints
- POST /demo/upload — Video upload + async processing
- GET /demo/status/{job_id} — Job status polling
- POST /demo/infer-frame — Real-time single frame inference
- GET /incidents/ — Incident list with filtering
- PATCH /incidents/{id}/acknowledge — Acknowledge incident
- GET /cameras/ — Camera management

## 7. Database Schema
Tables: zones, cameras, incidents, detections, evidence, processing_jobs
- SQLite (argus.db) by default
- PostgreSQL-ready via DATABASE_URL environment variable
- Schema is stable — no modifications planned

## 8. Identified Issues & Fixes Applied

### Issue 1: Tensor Indexing Deprecation (FIXED)
- **Problem**: `for box in r.boxes: box.xyxy[0]` triggers PyTorch 2.9 deprecation warning
- **Fix**: Changed to batch tensor access `r.boxes.xyxy.cpu().numpy()` in engine.py
- **Impact**: No more warnings; correct behavior maintained

### Issue 2: EnsembleModel vs YOLO predict() confusion (FIXED)
- **Problem**: YOLO has `.predict()` but returns Results, not dicts
- **Fix**: Use `isinstance(self.ppe_model, EnsembleModel)` to distinguish

### Issue 3: False PPE Violations (PARTIALLY ADDRESSED)
- **Problem**: No detection → assumed violation → false alarm
- **Fix**: Added UNCERTAIN state (low IoU → reduced confidence 0.60 vs 0.88)
- **Impact**: Reduces spurious high-confidence alarms; genuine violations still reported

## 9. Performance Benchmarks (Measured on GTX 1650)
- Person detection (yolov8n @ 416): ~109 ms (cold) / ~68-76 ms (warm)
- PPE detection (ppe_master @ 640): ~124 ms (cold) / ~85-125 ms (warm)
- Total pipeline per frame: ~120-150 ms warm → ~6-8 FPS
- Test video processing: 6.1 FPS achieved in test suite

## 10. Files Created by This Audit

### New Files (ml/ structure)
```
ml/
├── configs/model_config.yaml          — Mode-aware model configuration
├── datasets/
│   ├── dataset_inventory.json         — Full dataset inventory
│   ├── dataset_stats.json             — Statistical summary
│   └── master_dataset/
│       ├── data.yaml                  — Master dataset YAML reference
│       └── class_mapping.json         — Canonical class mapping + model compatibility
├── models/
│   ├── __init__.py
│   ├── loader.py                      — Priority-based model loading + integrity checks
│   └── ensemble.py                    — WBF ensemble implementation
├── inference/
│   ├── __init__.py
│   └── engine.py                      — New production inference engine
├── training/
│   ├── __init__.py
│   └── train_yolov8n.py               — Reproducible YOLOv8n training script
├── evaluation/
│   ├── __init__.py
│   └── compare_models.py              — Independent model comparison on test set
├── utils/
│   ├── __init__.py
│   └── box_ops.py                     — BBox utilities (IoU, NMS, clip, validate)
├── tests/
│   ├── __init__.py
│   └── test_pipeline.py               — Automated test suite (11 tests, all PASS)
├── experiments/
│   └── system_audit.md                — This document
└── weights/
    ├── ppe_best.pt                    — PRESERVED (SHA256 verified)
    ├── ppe_master.pt                  — ADDED (SHA256 verified)
    └── (ppe_merged_best.pt)           — To be created after retraining
```

### Modified Files
- `ml/inference_wrapper.py` — Updated to delegate to new engine with full legacy fallback

### Preserved Files (UNCHANGED)
- `ml/weights/ppe_best.pt` — SHA256: 07172EF3AE9E256C...
- `backend/services/pipeline.py`
- `backend/routers/demo.py`
- `backend/main.py`
- `argus.db`
- `test_clip.mp4`
