"""
ml/evaluation/compare_models.py
================================
Independent benchmarking of all registered PPE models on the same test set.

Produces:
    ml/experiments/model_comparison.md
    ml/experiments/model_comparison.json

Usage:
    python -m ml.evaluation.compare_models
    python -m ml.evaluation.compare_models --imgsz 640 --batch 16
"""

from __future__ import annotations
import argparse
import json
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

REPO_ROOT   = Path(__file__).resolve().parent.parent.parent
WEIGHTS_DIR = REPO_ROOT / "ml" / "weights"
EXP_DIR     = REPO_ROOT / "ml" / "experiments"
DATASET_YAML = Path(r"C:\Model\PPE_Master_System\dataset\data.yaml")


def parse_args():
    p = argparse.ArgumentParser(description="Compare PPE models on held-out test set")
    p.add_argument("--imgsz",  type=int, default=640, help="Image size")
    p.add_argument("--batch",  type=int, default=16,  help="Batch size")
    p.add_argument("--device", type=str, default="auto")
    return p.parse_args()


def _evaluate_model(model_path: Path, dataset_yaml: Path,
                    imgsz: int, batch: int, device) -> Optional[Dict[str, Any]]:
    """Run val on test split; return metrics dict or None on failure."""
    try:
        from ultralytics import YOLO
        model = YOLO(str(model_path))
        metrics = model.val(
            data=str(dataset_yaml),
            split="test",
            imgsz=imgsz,
            batch=batch,
            device=device,
            workers=0,
            verbose=False,
        )
        # Per-class AP50
        class_names = model.names
        per_class = {}
        for i, name in class_names.items():
            ap50 = float(metrics.box.ap50[i]) if i < len(metrics.box.ap50) else 0.0
            ap   = float(metrics.box.maps[i]) if i < len(metrics.box.maps) else 0.0
            p    = float(metrics.box.p[i])    if i < len(metrics.box.p)    else 0.0
            r    = float(metrics.box.r[i])    if i < len(metrics.box.r)    else 0.0
            per_class[name] = {"precision": round(p*100,2), "recall": round(r*100,2),
                                "mAP50": round(ap50*100,2), "mAP50_95": round(ap*100,2)}
        return {
            "precision": round(float(metrics.box.mp) * 100, 2),
            "recall":    round(float(metrics.box.mr) * 100, 2),
            "mAP50":     round(float(metrics.box.map50) * 100, 2),
            "mAP50_95":  round(float(metrics.box.map) * 100, 2),
            "per_class": per_class,
        }
    except Exception as e:
        print(f"  [WARN] Evaluation of {model_path.name} failed: {e}")
        return None


def _measure_latency(model_path: Path, imgsz: int = 640,
                     n_warmup: int = 5, n_iter: int = 50) -> Tuple[float, float]:
    """Returns (mean_ms, fps) measured on a random frame."""
    try:
        import torch
        import numpy as np
        from ultralytics import YOLO

        model = YOLO(str(model_path))
        frame = np.random.randint(0, 255, (imgsz, imgsz, 3), dtype=np.uint8)

        # Warmup
        for _ in range(n_warmup):
            model(frame, imgsz=imgsz, verbose=False)

        if torch.cuda.is_available():
            torch.cuda.synchronize()

        t0 = time.perf_counter()
        for _ in range(n_iter):
            model(frame, imgsz=imgsz, verbose=False)
        if torch.cuda.is_available():
            torch.cuda.synchronize()
        elapsed = time.perf_counter() - t0
        mean_ms = (elapsed / n_iter) * 1000
        fps     = 1000.0 / mean_ms
        return round(mean_ms, 1), round(fps, 1)
    except Exception as e:
        print(f"  [WARN] Latency measurement failed: {e}")
        return 0.0, 0.0


def main():
    args  = parse_args()
    EXP_DIR.mkdir(parents=True, exist_ok=True)

    try:
        import torch
        device = 0 if torch.cuda.is_available() else "cpu"
        if args.device != "auto":
            device = args.device
    except ImportError:
        device = "cpu"

    print("=" * 60)
    print("  ARGUS — PPE Model Comparison")
    print(f"  Test dataset: {DATASET_YAML}")
    print(f"  Image size:   {args.imgsz}")
    print(f"  Device:       {device}")
    print("=" * 60)

    if not DATASET_YAML.exists():
        print(f"[ERROR] Dataset YAML not found: {DATASET_YAML}")
        return

    models_to_test = [
        ("ppe_best.pt",        "Legacy (ppe_best.pt)"),
        ("ppe_master.pt",      "Master (ppe_master.pt)"),
        ("ppe_merged_best.pt", "Merged (ppe_merged_best.pt)"),
    ]

    results: Dict[str, Any] = {}

    for fname, label in models_to_test:
        path = WEIGHTS_DIR / fname
        if not path.exists():
            print(f"  ⚠️  Skipping {label}: not found at {path}")
            continue

        print(f"\n  Evaluating: {label}")
        metrics = _evaluate_model(path, DATASET_YAML, args.imgsz, args.batch, device)
        if metrics is None:
            continue

        print(f"    Precision: {metrics['precision']}%")
        print(f"    Recall:    {metrics['recall']}%")
        print(f"    mAP@50:    {metrics['mAP50']}%")
        print(f"    mAP@50-95: {metrics['mAP50_95']}%")

        print(f"  Measuring latency ({50} iterations)...")
        lat_ms, fps = _measure_latency(path, imgsz=args.imgsz)
        print(f"    Latency:   {lat_ms} ms  ({fps} FPS)")

        results[fname] = {
            "label":       label,
            "metrics":     metrics,
            "latency_ms":  lat_ms,
            "fps":         fps,
        }

    if not results:
        print("\n[ERROR] No models could be evaluated.")
        return

    # Save JSON
    json_path = EXP_DIR / "model_comparison.json"
    with open(json_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\n  Saved: {json_path}")

    # Write Markdown report
    _write_markdown(results, args.imgsz, args.batch, device)

    # Determine best model
    best_name = max(results, key=lambda k: results[k]["metrics"]["mAP50"])
    best_data = results[best_name]
    print(f"\n  🏆 Best model by mAP@50: {best_data['label']}")
    print(f"     mAP@50 = {best_data['metrics']['mAP50']}%")


def _write_markdown(results: Dict[str, Any], imgsz: int, batch: int, device: Any) -> None:
    EXP_DIR.mkdir(parents=True, exist_ok=True)
    md_path = EXP_DIR / "model_comparison.md"

    lines = [
        "# PPE Model Comparison Report",
        "",
        f"**Test Set**: `C:/Model/PPE_Master_System/dataset/test/` (2,261 images)",
        f"**Image Size**: {imgsz}  |  **Batch**: {batch}  |  **Device**: {device}",
        "",
        "## Overall Metrics",
        "",
        "| Metric | Legacy | Master | Merged |",
        "|:---|---:|---:|---:|",
    ]

    metrics_keys = ["precision", "recall", "mAP50", "mAP50_95"]
    metric_labels = ["Precision (%)", "Recall (%)", "mAP@50 (%)", "mAP@50-95 (%)"]

    def _get(fname, key):
        r = results.get(fname, {})
        m = r.get("metrics", {})
        return f"**{m.get(key, 'N/A')}**" if fname in results else "N/A"

    for mk, ml in zip(metrics_keys, metric_labels):
        row = f"| {ml} | {_get('ppe_best.pt', mk)} | {_get('ppe_master.pt', mk)} | {_get('ppe_merged_best.pt', mk)} |"
        lines.append(row)

    def _lat(fname): return results.get(fname, {}).get("latency_ms", "N/A")
    def _fps(fname): return results.get(fname, {}).get("fps", "N/A")
    lines += [
        f"| Latency (ms) | {_lat('ppe_best.pt')} | {_lat('ppe_master.pt')} | {_lat('ppe_merged_best.pt')} |",
        f"| FPS          | {_fps('ppe_best.pt')} | {_fps('ppe_master.pt')} | {_fps('ppe_merged_best.pt')} |",
        "",
        "## Per-Class Breakdown",
    ]

    all_classes = set()
    for r in results.values():
        all_classes.update(r["metrics"].get("per_class", {}).keys())

    for model_fname, model_data in results.items():
        lines += ["", f"### {model_data['label']}", ""]
        lines.append("| Class | Precision (%) | Recall (%) | mAP@50 (%) | mAP@50-95 (%) |")
        lines.append("|:---|---:|---:|---:|---:|")
        for cls_name, cls_m in model_data["metrics"].get("per_class", {}).items():
            lines.append(
                f"| {cls_name} | {cls_m['precision']} | {cls_m['recall']} | {cls_m['mAP50']} | {cls_m['mAP50_95']} |"
            )

    if results:
        best_fname = max(results, key=lambda k: results[k]["metrics"]["mAP50"])
        lines += [
            "",
            "## Recommendation",
            "",
            f"**Best validated model**: {results[best_fname]['label']}",
            f"**mAP@50**: {results[best_fname]['metrics']['mAP50']}%",
            "",
            "> Update `ml/configs/model_config.yaml` → `mode: optimized` to use the best model.",
        ]

    md_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"  Saved: {md_path}")


if __name__ == "__main__":
    main()
