# 🦺 Argus Safety AI — Unified Dataset & Model Showcase
**Production-Grade Industrial PPE & Spatial Vision System for Hackathon Showcase**

---

## 📌 Executive Summary

To achieve robust, industrial-grade compliance detection in unpredictable workplace environments, the Argus AI system transitioned beyond single-source prototype datasets. By unifying **4 diverse safety datasets** into a single canonical corpus, the model was trained and validated on **22,138 high-resolution images** with **52,008 annotations**.

The old baseline hackathon model has been retired, and the system now runs exclusively on the **Unified Master Model (`ppe_master.pt`)**, delivering high-speed, high-accuracy inference with zero dependency on outdated legacy checkpoints.

---

## 📊 Dataset Architecture & Provenance

### 1. Multi-Source Composition (22,138 Images Total)

| # | Dataset Source | Image Count | Safety Annotations | Key Characteristics |
|:---:|:---|:---:|:---:|:---|
| **1** | **Industrial PPE Safety Dataset v3** (Roboflow) | **12,078** | ~20,000 | Diverse factory, construction, and warehouse scenes. Contains all 6 canonical PPE classes. Auto-oriented 640×640. |
| **2** | **Safety Helmet Wearing Dataset (SHWD)** | **5,000** | **19,252** | High-density head/helmet annotations across complex angles and lighting. Converted from Pascal VOC XML to YOLO format. |
| **3** | **Chinese Helmet & Vest Dataset (CHV)** | **1,330** | ~3,500 | Multi-color helmets and high-visibility vests. Re-mapped to canonical class IDs. |
| **4** | **SH17 Industrial PPE Dataset** | **3,730** | **11,422** | Comprehensive multi-class safety equipment: safety shoes, gloves, masks, and goggles. |
| **TOTAL** | **4-Dataset Unified Corpus** | **22,138** | **52,008** | **Full Workplace Safety Spectrum** |

---

### 2. Leak-Free Train / Validation / Test Splits

The dataset enforces strict dataset-level grouping to prevent data leakage between splits:

```
Total Corpus: 22,138 images | 52,008 annotations
├── Train Set (76.1%):  16,841 images | 40,810 annotations  (used for model gradient training)
├── Valid Set (13.7%):   3,036 images |  5,899 annotations  (used for hyperparameter tuning & early stopping)
└── Test Set  (10.2%):   2,261 images |  5,299 annotations  (held-out unseen benchmark)
```

---

### 3. Canonical 6-Class Mapping

All datasets were normalized to a unified 6-class zero-indexed scheme:

```json
{
  "0": "Gloves",
  "1": "Vest",
  "2": "goggles",
  "3": "helmet",
  "4": "mask",
  "5": "safety_shoe"
}
```

---

## 🖼️ Visual Training Evidence (Showcase Gallery)

All showcase visual assets are located in [`ml/datasets/showcase/`](file:///c:/hackthon-/ml/datasets/showcase):

### 1. Training Batches & Augmentations
The model was trained with **Mosaic (1.0)**, **Mixup (0.1)**, horizontal flip, and multi-scale jittering.
* **Label Distribution**: [`ml/datasets/showcase/training_batches/labels.jpg`](file:///c:/hackthon-/ml/datasets/showcase/training_batches/labels.jpg)
  * Visualizes the bounding box spatial center distribution and label counts across all 6 classes.
* **Batch 0 Mosaic**: [`ml/datasets/showcase/training_batches/train_batch0.jpg`](file:///c:/hackthon-/ml/datasets/showcase/training_batches/train_batch0.jpg)
* **Batch 1 Mosaic**: [`ml/datasets/showcase/training_batches/train_batch1.jpg`](file:///c:/hackthon-/ml/datasets/showcase/training_batches/train_batch1.jpg)
* **Batch 2 Mosaic**: [`ml/datasets/showcase/training_batches/train_batch2.jpg`](file:///c:/hackthon-/ml/datasets/showcase/training_batches/train_batch2.jpg)

### 2. Validation Ground Truth vs. Model Predictions
* **Ground Truth Labels**: [`ml/datasets/showcase/validation_predictions/val_batch0_labels.jpg`](file:///c:/hackthon-/ml/datasets/showcase/validation_predictions/val_batch0_labels.jpg)
* **Model Predictions**: [`ml/datasets/showcase/validation_predictions/val_batch0_pred.jpg`](file:///c:/hackthon-/ml/datasets/showcase/validation_predictions/val_batch0_pred.jpg)
* Demonstrates precise spatial localization on unseen workers in challenging industrial orientations.

### 3. Evaluation Metrics & Convergence Curves
* **Precision-Recall Curve**: [`ml/datasets/showcase/metrics/BoxPR_curve.png`](file:///c:/hackthon-/ml/datasets/showcase/metrics/BoxPR_curve.png)
* **F1-Confidence Curve**: [`ml/datasets/showcase/metrics/BoxF1_curve.png`](file:///c:/hackthon-/ml/datasets/showcase/metrics/BoxF1_curve.png)
* **Normalized Confusion Matrix**: [`ml/datasets/showcase/metrics/confusion_matrix_normalized.png`](file:///c:/hackthon-/ml/datasets/showcase/metrics/confusion_matrix_normalized.png)
* **Training Losses & mAP Evolution**: [`ml/datasets/showcase/metrics/results.png`](file:///c:/hackthon-/ml/datasets/showcase/metrics/results.png)

---

## 🎯 Benchmark Performance on Unseen Test Set (2,261 Images)

Evaluated strictly on held-out test images never seen during training:

| Class | Precision | Recall | mAP@50 | Industrial Compliance Utility |
|:---|:---:|:---:|:---:|:---|
| **helmet** | **88.1%** | **76.9%** | **86.5%** | Primary life-safety enforcement |
| **Vest** | **76.7%** | **81.7%** | **82.9%** | High-visibility hazard avoidance |
| **goggles** | 76.9% | 59.9% | 65.9% | Eye protection in welding/chemical zones |
| **mask** | 70.5% | 51.8% | 56.5% | Dust/respiratory hazard compliance |
| **Gloves** | 51.1% | 36.2% | 37.4% | Hand safety & pinch-point defense |
| **safety_shoe** | 51.2% | 33.4% | 32.1% | Footwear enforcement |
| **OVERALL** | **69.1%** | **56.7%** | **60.2%** | **Comprehensive 6-Class Mean** |

> **Key Takeaway:** For the system's primary compliance checks (**Helmets & High-Vis Vests**), the model achieves **83%–88% mAP@50**, providing industrial reliability while maintaining **~6.4 ms latency** (over 150 FPS on a GTX 1650).

---

## ⚙️ Model Architecture & Inference Pipeline

The live application runs a two-stage spatial compliance pipeline:

```
[Video / Camera Stream]
           │
           ▼
[1. Person Detection (yolov8n @ 416px)] ──▶ Extracts worker bounding boxes [x1, y1, x2, y2]
           │
           ▼
[2. PPE Detection (ppe_master.pt @ 640px)] ──▶ Detects helmets, vests, goggles, gloves, etc.
           │
           ▼
[3. Anatomical Spatial Matching]
           ├── Head Zone (Top 28% of person): IoU match with helmet detection
           └── Torso Zone (20%-72% of person): IoU match with vest detection
           │
           ▼
[4. 2-of-3 Temporal Debounce Filter] ──▶ Eliminates transient frame flickers / false alarms
           │
           ▼
[5. Real-Time Dashboard & WebSocket Event Stream] ──▶ Live incident alert, evidence snapshot, audio alert
```

---

## 📂 Repository File Layout

```
ml/
├── DATASET_SHOWCASE.md            # This comprehensive showcase document
├── configs/
│   └── model_config.yaml          # Active configuration (mode: optimized, master model)
├── datasets/
│   ├── dataset_inventory.json     # Complete dataset metadata and provenance
│   ├── dataset_stats.json         # Statistical class distributions and split counts
│   ├── master_dataset/
│   │   ├── data.yaml              # YOLO dataset configuration
│   │   ├── class_mapping.json     # Canonical class definitions
│   │   ├── images/ [linked]       # Full 22,138 images (train, val, test)
│   │   └── labels/ [linked]       # 52,008 YOLO label files
│   └── showcase/                  # Curated visual showcase gallery for judges
│       ├── training_batches/      # labels.jpg, train_batch0/1/2.jpg
│       ├── validation_predictions/# val_batch0/1 labels vs predictions
│       └── metrics/               # PR curves, confusion matrix, loss curves
├── models/
│   ├── loader.py                  # Dynamic model loader with checksum verification
│   └── ensemble.py                # Weighted Box Fusion (WBF) ensemble engine
├── inference/
│   └── engine.py                  # High-throughput production inference engine
├── training/
│   └── train_yolov8n.py           # Reproducible training pipeline with AMP
└── weights/
    ├── ppe_master.pt              # PRIMARY ACTIVE MODEL (22,138 images trained)
    ├── fire_best.pt               # Active Fire & Smoke model
    └── yolov8n.pt                 # Fast person detection model
```
