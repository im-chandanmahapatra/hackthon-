# PPE Model Comparison Report
## Status: PENDING FULL BENCHMARK

This report will be updated when `python -m ml.evaluation.compare_models` is run.

## Current Known Performance (from existing evaluation)

### ppe_master.pt (Current Primary)
Test set: 2,261 images (unseen held-out)

| Metric | Value |
|:-------|------:|
| Precision | 69.07% |
| Recall | 56.65% |
| mAP@50 | 60.19% |
| mAP@50-95 | 36.27% |
| Latency | ~6.4 ms (GTX 1650, imgsz=640) |
| FPS (model only) | ~156 FPS |

### Per-Class (ppe_master.pt)
| Class | Precision | Recall | mAP@50 | mAP@50-95 |
|:------|----------:|-------:|-------:|----------:|
| helmet | 88.08% | 76.94% | 86.47% | 55.67% |
| Vest | 76.66% | 81.68% | 82.87% | 57.23% |
| goggles | 76.90% | 59.94% | 65.85% | 31.78% |
| mask | 70.53% | 51.79% | 56.46% | 29.08% |
| Gloves | 51.13% | 36.15% | 37.42% | 27.05% |
| safety_shoe | 51.16% | 33.38% | 32.08% | 16.82% |

### ppe_best.pt (Legacy Fallback)
- Benchmark: Not yet run on same test set
- Status: Preserved for fallback comparison

### ppe_merged_best.pt
- Status: Not yet created (requires `python -m ml.training.train_yolov8n`)

## Gap Analysis vs 98% Target

| Class | Current mAP@50 | Gap to 98% | Priority |
|:------|---------------:|:-----------|:---------|
| helmet | 86.47% | -11.53% | HIGH |
| Vest | 82.87% | -15.13% | HIGH |
| goggles | 65.85% | -32.15% | HIGH |
| mask | 56.46% | -41.54% | CRITICAL |
| Gloves | 37.42% | -60.58% | CRITICAL |
| safety_shoe | 32.08% | -65.92% | CRITICAL |

## Key Observations

1. **Helmet and Vest perform best** — These are the primary PPE items in the pipeline
2. **Gloves, safety_shoe, mask** have low performance — These classes are underrepresented in training data
3. **Overall mAP@50 = 60.19%** — Significant gap to 98% target
4. **The 98% target is not achieved** — This is the honest result; further training and data augmentation needed

## Path to Improvement

1. **More training data for weak classes**: gloves, safety_shoe, mask, goggles need more labeled examples
2. **Higher-resolution training**: imgsz=640 used; could try 1280 at the cost of speed
3. **Extended training**: Current model trained ~21 epochs; could benefit from more with cosine annealing
4. **Focal loss tuning**: Class imbalance may benefit from weighted focal loss per class

## Commands to Run Full Comparison

```bash
# 1. First run model comparison on all available models:
python -m ml.evaluation.compare_models --imgsz 640 --batch 16

# 2. (Optional) Retrain on master dataset:
python -m ml.training.train_yolov8n --epochs 30 --batch 16 --run-name merged_run

# 3. After training, re-run comparison:
python -m ml.evaluation.compare_models
```

## Current Active Configuration
- **mode**: optimized
- **Primary model**: ppe_master.pt
- **Fallback**: ppe_best.pt (legacy)
- **Config file**: ml/configs/model_config.yaml
