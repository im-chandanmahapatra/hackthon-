"""
ml/training/train_yolov8n.py
=============================
Reproducible YOLOv8n training/fine-tuning script for the Argus PPE project.

Usage:
    python -m ml.training.train_yolov8n --epochs 15 --batch 16
    python -m ml.training.train_yolov8n --epochs 30 --batch 8 --resume

Key design choices:
  - Fine-tunes from ppe_master.pt (or ppe_best.pt as fallback)
  - Uses the 22,138-image master dataset at C:/Model/PPE_Master_System/dataset/
  - Seeds all random generators for reproducibility
  - Saves output to ml/weights/ppe_merged_best.pt
  - Does NOT overwrite ppe_best.pt or ppe_master.pt
"""

from __future__ import annotations
import argparse
import os
import sys
import shutil
import hashlib
import json
import time
from pathlib import Path

# ── Env setup ─────────────────────────────────────────────────────────────────
REPO_ROOT    = Path(__file__).resolve().parent.parent.parent
WEIGHTS_DIR  = REPO_ROOT / "ml" / "weights"
DATASET_YAML = Path(r"C:\Model\PPE_Master_System\dataset\data.yaml")
RUNS_DIR     = REPO_ROOT / "ml" / "experiments" / "training_runs"

# ── Args ───────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Train YOLOv8n for PPE detection")
    p.add_argument("--epochs",   type=int,   default=15,      help="Training epochs (default: 15)")
    p.add_argument("--batch",    type=int,   default=16,      help="Batch size (default: 16)")
    p.add_argument("--imgsz",    type=int,   default=640,     help="Image size (default: 640)")
    p.add_argument("--lr0",      type=float, default=0.001,   help="Initial learning rate (default: 0.001)")
    p.add_argument("--lrf",      type=float, default=0.01,    help="LR final ratio (default: 0.01)")
    p.add_argument("--patience", type=int,   default=7,       help="Early stop patience (default: 7)")
    p.add_argument("--seed",     type=int,   default=42,      help="Random seed (default: 42)")
    p.add_argument("--device",   type=str,   default="auto",  help="Device: 0 | cpu | auto (default: auto)")
    p.add_argument("--weights",  type=str,   default=None,    help="Starting weights (default: ppe_master.pt)")
    p.add_argument("--run-name", type=str,   default="merged_run", help="Experiment name")
    p.add_argument("--resume",   action="store_true",          help="Resume from last checkpoint")
    p.add_argument("--workers",  type=int,   default=0,       help="DataLoader workers (default: 0 for Windows)")
    p.add_argument("--amp",      action=argparse.BooleanOptionalAction, default=True, help="Use Automatic Mixed Precision (default: True)")
    return p.parse_args()

# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    args = parse_args()

    print("=" * 70)
    print("  ARGUS — YOLOv8n PPE Model Training")
    print(f"  Epochs: {args.epochs}  Batch: {args.batch}  imgsz: {args.imgsz}")
    print("=" * 70)

    # Check dataset
    if not DATASET_YAML.exists():
        print(f"[ERROR] Dataset YAML not found: {DATASET_YAML}")
        print("  Expected: C:/Model/PPE_Master_System/dataset/data.yaml")
        sys.exit(1)

    # Import YOLO
    try:
        import torch
        from ultralytics import YOLO
    except ImportError as e:
        print(f"[ERROR] Missing dependency: {e}")
        sys.exit(1)

    # Device selection
    if args.device == "auto":
        device = 0 if torch.cuda.is_available() else "cpu"
    else:
        device = args.device

    if torch.cuda.is_available():
        gpu_name = torch.cuda.get_device_name(0)
        vram_gb  = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
        print(f"  GPU: {gpu_name} ({vram_gb:.1f} GB VRAM)")
        torch.cuda.empty_cache()
    else:
        print("  Device: CPU")

    # Resolve starting weights
    WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
    if args.weights:
        init_weights = Path(args.weights)
    else:
        # Priority: ppe_master > ppe_merged_best > yolov8n.pt
        for candidate in ["ppe_master.pt", "ppe_merged_best.pt", "yolov8n.pt"]:
            cand_path = WEIGHTS_DIR / candidate
            if cand_path.exists():
                init_weights = cand_path
                break
        else:
            init_weights = Path("yolov8n.pt")  # Downloads if needed

    print(f"  Starting weights: {init_weights}")
    print(f"  Dataset: {DATASET_YAML}")
    print(f"  Output run: {args.run_name}")

    # Safety: record checksums of models we must NOT overwrite
    protected = {}
    for pname in ["ppe_master.pt"]:
        ppath = WEIGHTS_DIR / pname
        if ppath.exists():
            h = hashlib.sha256()
            with open(ppath, "rb") as f:
                for chunk in iter(lambda: f.read(1 << 20), b""):
                    h.update(chunk)
            protected[pname] = h.hexdigest().upper()
            print(f"  Protected: {pname} SHA256={protected[pname][:16]}...")

    # Load model
    model = YOLO(str(init_weights))

    # Train
    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    t_start = time.perf_counter()

    try:
        results = model.train(
            data=str(DATASET_YAML),
            epochs=args.epochs,
            patience=args.patience,
            batch=args.batch,
            imgsz=args.imgsz,
            device=device,
            workers=args.workers,
            optimizer="AdamW",
            lr0=args.lr0,
            lrf=args.lrf,
            cos_lr=True,
            amp=args.amp,
            mosaic=1.0,
            mixup=0.1,
            copy_paste=0.0,
            seed=args.seed,
            deterministic=True,
            save_period=5,
            project=str(RUNS_DIR),
            name=args.run_name,
            exist_ok=True,
            save=True,
            plots=True,
            verbose=True,
            resume=args.resume,
        )
    except Exception as e:
        print(f"[ERROR] Training failed: {e}")
        sys.exit(1)

    elapsed = time.perf_counter() - t_start
    print(f"\n  Training completed in {elapsed / 60:.1f} minutes.")

    # Locate new best weights
    run_best = RUNS_DIR / args.run_name / "weights" / "best.pt"
    if not run_best.exists():
        print(f"[ERROR] best.pt not found at {run_best}")
        sys.exit(1)

    # Evaluate on test set
    print("\n  Evaluating on held-out test set...")
    try:
        new_model = YOLO(str(run_best))
        metrics = new_model.val(
            data=str(DATASET_YAML),
            split="test",
            imgsz=args.imgsz,
            batch=args.batch,
            device=device,
            workers=args.workers,
        )
        map50    = metrics.box.map50
        map5095  = metrics.box.map
        precision = metrics.box.mp
        recall   = metrics.box.mr

        print(f"\n  TEST SET RESULTS ({args.run_name}):")
        print(f"    Precision : {precision * 100:.2f}%")
        print(f"    Recall    : {recall    * 100:.2f}%")
        print(f"    mAP@50    : {map50     * 100:.2f}%")
        print(f"    mAP@50-95 : {map5095   * 100:.2f}%")
    except Exception as e:
        print(f"[WARN] Evaluation failed: {e}")
        map50 = map5095 = precision = recall = 0.0

    # Save as ppe_merged_best.pt (NEVER overwrite ppe_best.pt or ppe_master.pt)
    merged_dst = WEIGHTS_DIR / "ppe_merged_best.pt"
    shutil.copy2(str(run_best), str(merged_dst))
    print(f"\n  ✅ Saved: {merged_dst}")

    # Verify protected models were not touched
    all_ok = True
    for pname, expected_hash in protected.items():
        ppath = WEIGHTS_DIR / pname
        h = hashlib.sha256()
        with open(ppath, "rb") as f:
            for chunk in iter(lambda: f.read(1 << 20), b""):
                h.update(chunk)
        actual = h.hexdigest().upper()
        if actual == expected_hash:
            print(f"  ✅ Protected model intact: {pname}")
        else:
            print(f"  ❌ INTEGRITY ERROR: {pname} was modified! Expected {expected_hash[:16]} got {actual[:16]}")
            all_ok = False

    if not all_ok:
        print("[CRITICAL] Protected model was modified. Investigate immediately!")
        sys.exit(1)

    # Export to ONNX
    print("\n  Exporting to ONNX...")
    try:
        export_model = YOLO(str(merged_dst))
        onnx_path = export_model.export(format="onnx", imgsz=args.imgsz, dynamic=False, opset=12)
        onnx_dst  = WEIGHTS_DIR / "ppe_merged_best.onnx"
        if onnx_path and Path(str(onnx_path)).exists():
            shutil.copy2(str(onnx_path), str(onnx_dst))
            print(f"  ✅ ONNX exported: {onnx_dst}")
    except Exception as e:
        print(f"  ℹ️  ONNX export skipped: {e}")

    # Save training metadata
    meta = {
        "run_name":      args.run_name,
        "base_weights":  str(init_weights),
        "dataset_yaml":  str(DATASET_YAML),
        "epochs":        args.epochs,
        "batch":         args.batch,
        "imgsz":         args.imgsz,
        "lr0":           args.lr0,
        "lrf":           args.lrf,
        "patience":      args.patience,
        "optimizer":     "AdamW",
        "cos_lr":        True,
        "mosaic":        1.0,
        "mixup":         0.1,
        "seed":          args.seed,
        "device":        str(device),
        "elapsed_min":   round(elapsed / 60, 2),
        "test_metrics":  {
            "precision": round(precision * 100, 2),
            "recall":    round(recall    * 100, 2),
            "mAP50":     round(map50     * 100, 2),
            "mAP50_95":  round(map5095   * 100, 2),
        },
        "output": str(merged_dst),
    }
    meta_path = RUNS_DIR / args.run_name / "training_metadata.json"
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)
    print(f"\n  Metadata saved: {meta_path}")
    print("=" * 70)
    print("  TRAINING COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    main()
