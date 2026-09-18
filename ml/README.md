# Argus ML — PPE Detection Module

## Overview
Multi-model PPE detection system with hot-swappable inference modes.

## Models
| Model | File | Status | mAP@50 |
|:------|:-----|:-------|-------:|
| Legacy | `weights/ppe_best.pt` | PRESERVED | N/A (pending benchmark) |
| Master | `weights/ppe_master.pt` | ACTIVE | 60.19% (2,261 test images) |
| Merged | `weights/ppe_merged_best.pt` | PENDING | Created after retraining |

## Quick Start

### Switch model mode
Edit `configs/model_config.yaml`:
```yaml
mode: optimized   # uses ppe_master.pt (default)
mode: legacy      # uses ppe_best.pt
mode: ensemble    # uses WBF fusion of master + legacy
```

### Run inference
```python
from ml.inference_wrapper import run_ppe, run_fire, infer_frame
import cv2

frame = cv2.imread("image.jpg")
ppe_violations = run_ppe(frame)
fire_detections = run_fire(frame)
full_result = infer_frame(frame)
```

### Run tests
```bash
python -m ml.tests.test_pipeline
```

### Benchmark models
```bash
python -m ml.evaluation.compare_models
```

### Retrain (fine-tune from master)
```bash
python -m ml.training.train_yolov8n --epochs 15 --batch 16
```

## Class Mapping
| ID | Class |
|:---|:------|
| 0 | Gloves |
| 1 | Vest |
| 2 | goggles |
| 3 | helmet |
| 4 | mask |
| 5 | safety_shoe |

## Performance (GTX 1650)
- Person detection: ~70ms warm (yolov8n @ 416)
- PPE detection: ~90ms warm (ppe_master @ 640)
- Total pipeline: ~120-150ms → ~6-8 FPS

## Critical Rules
1. **NEVER delete** `weights/ppe_best.pt` — original model, integrity-verified
2. **NEVER delete** `weights/ppe_master.pt` — primary production model
3. Retrained models save to `weights/ppe_merged_best.pt` only
4. Public API (`run_ppe`, `run_fire`, `infer_frame`) signatures MUST remain unchanged
