"""
ml/run_inference.py
===================
Interactive command-line tool to run the active Argus PPE & Safety Model
on single images, image folders, video files, or a live webcam feed.

Usage Examples:
    # 1. Test on a single image and display / save annotated result:
    python ml/run_inference.py --source path/to/image.jpg

    # 2. Test on a random sample from the test dataset:
    python ml/run_inference.py --sample

    # 3. Run on a video file:
    python ml/run_inference.py --source path/to/video.mp4

    # 4. Run on a live webcam:
    python ml/run_inference.py --webcam
"""

from __future__ import annotations
import argparse
import sys
import time
from pathlib import Path
import random

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

import cv2
import numpy as np
from ml.inference_wrapper import infer_frame, engine

OUTPUT_DIR = REPO_ROOT / "ml" / "inference_output"


def draw_detections(frame: np.ndarray, detections: list) -> np.ndarray:
    """Draw bounding boxes and safety compliance labels on the image frame."""
    canvas = frame.copy()
    h, w = canvas.shape[:2]

    # Color palette (BGR)
    COLOR_COMPLIANT = (0, 200, 0)      # Green
    COLOR_VIOLATION = (0, 0, 220)      # Red
    COLOR_WORKER    = (255, 180, 0)    # Cyan / Yellow-Orange
    COLOR_HAZARD    = (0, 140, 255)    # Orange / Fire

    for det in detections:
        box = det.get("bbox", [])
        if len(box) != 4:
            continue
        x1, y1, x2, y2 = box
        cname = det.get("class_name", "")
        label = det.get("label", cname.upper())
        conf  = det.get("confidence", 0.0)
        is_violation = det.get("is_violation", False)

        if cname in ("fire", "smoke"):
            color = COLOR_HAZARD
        elif cname == "worker":
            color = COLOR_WORKER
        elif is_violation:
            color = COLOR_VIOLATION
        else:
            color = COLOR_COMPLIANT

        # Draw box
        cv2.rectangle(canvas, (x1, y1), (x2, y2), color, 2)

        # Label background
        text = f"{label} ({conf:.2f})"
        font_scale = 0.5
        thickness = 1
        (tw, th), baseline = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness)
        
        cv2.rectangle(canvas, (x1, max(0, y1 - th - 6)), (x1 + tw + 4, max(th + 6, y1)), color, -1)
        cv2.putText(canvas, text, (x1 + 2, max(th + 2, y1 - 4)),
                    cv2.FONT_HERSHEY_SIMPLEX, font_scale, (255, 255, 255), thickness, cv2.LINE_AA)

    return canvas


def run_on_image(img_path: Path, show: bool = False, save: bool = True):
    frame = cv2.imread(str(img_path))
    if frame is None:
        print(f"[ERROR] Could not load image: {img_path}")
        return

    t0 = time.perf_counter()
    result = infer_frame(frame)
    latency_ms = (time.perf_counter() - t0) * 1000

    detections = result.get("detections", [])
    workers = [d for d in detections if d.get("class_name") == "worker"]
    violations = [d for d in detections if d.get("is_violation")]

    print(f"\nImage: {img_path.name}")
    print(f"  Latency:    {latency_ms:.1f} ms")
    print(f"  Workers:    {len(workers)}")
    print(f"  Violations: {len(violations)}")
    print(f"  Total Dets: {len(detections)}")

    for d in detections:
        status = "⚠️ VIOLATION" if d.get("is_violation") else "✅ OK"
        print(f"    - {d.get('label'):<20} (Conf: {d.get('confidence'):.2f}) {status}")

    annotated = draw_detections(frame, detections)

    if save:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        out_file = OUTPUT_DIR / f"annotated_{img_path.name}"
        cv2.imwrite(str(out_file), annotated)
        print(f"  Saved visual result: {out_file}")

    if show:
        cv2.imshow("Argus AI Model Inference", annotated)
        print("Press any key to close window...")
        cv2.waitKey(0)
        cv2.destroyAllWindows()


def run_on_sample():
    test_dir = Path(r"C:\Model\PPE_Master_System\dataset\test\images")
    if not test_dir.exists():
        print(f"[ERROR] Test dataset folder not found: {test_dir}")
        return
    images = list(test_dir.glob("*.jpg"))
    if not images:
        print("[ERROR] No jpg images found in test folder.")
        return
    sample = random.choice(images)
    print(f"Selected random sample from test dataset: {sample.name}")
    run_on_image(sample, show=False, save=True)


def main():
    parser = argparse.ArgumentParser(description="Argus Safety AI Model Inference CLI")
    parser.add_argument("--source", type=str, default=None, help="Path to image or video file")
    parser.add_argument("--sample", action="store_true", help="Run on random image from test dataset")
    parser.add_argument("--webcam", action="store_true", help="Run on live webcam stream")
    parser.add_argument("--show",   action="store_true", help="Display window with visual detections")
    args = parser.parse_args()

    print("=" * 65)
    print("  ARGUS SAFETY AI — REAL-TIME MODEL INFERENCE")
    print(f"  Active Model: {engine._model_label}")
    print("=" * 65)

    if args.sample:
        run_on_sample()
    elif args.source:
        path = Path(args.source)
        if not path.exists():
            print(f"[ERROR] File not found: {path}")
            sys.exit(1)
        if path.suffix.lower() in [".jpg", ".jpeg", ".png", ".webp", ".bmp"]:
            run_on_image(path, show=args.show)
        else:
            print("[INFO] Video inference: processing frames...")
            # Video stream processing
            cap = cv2.VideoCapture(str(path))
            count = 0
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break
                count += 1
                if count % 15 == 0:  # Sample every 15 frames
                    res = infer_frame(frame)
                    print(f"Frame #{count}: {len(res.get('detections', []))} detections")
            cap.release()
            print("Video processing complete.")
    elif args.webcam:
        print("Starting webcam feed (press 'q' to quit)...")
        cap = cv2.VideoCapture(0)
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            res = infer_frame(frame)
            vis = draw_detections(frame, res.get("detections", []))
            cv2.imshow("Argus Live Webcam Stream", vis)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
        cap.release()
        cv2.destroyAllWindows()
    else:
        print("No source specified. Running on random test sample...")
        run_on_sample()


if __name__ == "__main__":
    main()
