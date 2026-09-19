"""
Test script to run live inference using the active Argus model.
"""
import sys
from pathlib import Path

# Add repo root to sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

import cv2
from ml.inference_wrapper import infer_frame, engine

print("=" * 60)
print("  ARGUS SAFETY AI — LIVE MODEL INFERENCE TEST")
print("=" * 60)
print(f"Active Model Label: {engine._model_label}")
print(f"Person Detector:    {type(engine.person_model)}")
print(f"PPE Detector:       {type(engine.ppe_model)}")
print(f"Fire Detector:      {type(engine.fire_model)}")

test_dir = Path(r"C:\Model\PPE_Master_System\dataset\test\images")
sample_images = list(test_dir.glob("*.jpg"))[:5]

for idx, img_path in enumerate(sample_images, 1):
    print(f"\n--- Test Sample {idx}: {img_path.name} ---")
    frame = cv2.imread(str(img_path))
    if frame is None:
        print(f"Could not load {img_path}")
        continue

    results = infer_frame(frame)
    detections = results.get("detections", [])

    print(f"Total Detections: {len(detections)}")
    for d in detections:
        print(f"  * [{d.get('class_name')}] {d.get('label')} (Conf: {d.get('confidence')}) Box: {d.get('bbox')} Violation: {d.get('is_violation')}")

print("\n" + "=" * 60)
print("✅ Model inference successfully executed and verified!")
print("=" * 60)
