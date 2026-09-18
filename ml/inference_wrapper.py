"""
ml/inference_wrapper.py
========================
Public API wrapper — BACKWARD COMPATIBLE.

This module preserves the exact function signatures used throughout the
Argus backend:

    run_ppe(frame)    -> List[Dict[str, Any]]
    run_fire(frame)   -> List[Dict[str, Any]]
    infer_frame(frame) -> Dict[str, Any]

Internal implementation is now delegated to ml.inference.engine.InferenceEngine
which supports hot-swappable model modes (optimized / legacy / ensemble).
"""

from __future__ import annotations
import os
from pathlib import Path
from typing import List, Dict, Any, Tuple
import numpy as np

try:
    import cv2
except ImportError:
    cv2 = None

try:
    from ultralytics import YOLO
    ULTRALYTICS_AVAILABLE = True
except ImportError:
    ULTRALYTICS_AVAILABLE = False
    YOLO = None

WEIGHTS_DIR = Path(__file__).resolve().parent / "weights"
WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)

# ── Helper kept for any external callers that import it directly ──────────────

def bbox_iou_or_intersection(boxA: List[int], boxB: List[int]) -> float:
    """Calculates intersection area relative to boxA area."""
    xA = max(boxA[0], boxB[0]); yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2]); yB = min(boxA[3], boxB[3])
    interArea = max(0, xB - xA) * max(0, yB - yA)
    boxAArea  = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
    if boxAArea <= 0:
        return 0.0
    return interArea / float(boxAArea)

# ── Delegate to new engine ─────────────────────────────────────────────────────

try:
    from ml.inference.engine import InferenceEngine
    engine = InferenceEngine()
    print("[inference_wrapper] ✅ Delegating to ml.inference.engine.InferenceEngine")
except Exception as _engine_err:
    print(f"[inference_wrapper] ⚠️  New engine failed to load ({_engine_err}); using legacy inline engine.")
    engine = None

# ── Legacy InferenceEngine (fallback if new engine fails to import) ───────────

class _LegacyInferenceEngine:
    """
    Exact copy of the original InferenceEngine from the hackathon project.
    Used ONLY if the new engine import fails (belt-and-suspenders safety net).
    """

    def __init__(self):
        self.person_model = None
        self.ppe_model    = None
        self.fire_model   = None
        self._load_models()

    def _load_models(self):
        if not ULTRALYTICS_AVAILABLE:
            print("[LegacyEngine] Ultralytics not loaded; using heuristic mode.")
            return

        person_weights = WEIGHTS_DIR / "yolov8n.pt"
        if person_weights.exists():
            try:
                self.person_model = YOLO(str(person_weights))
                print(f"[LegacyEngine] Loaded Person detector: {person_weights}")
            except Exception as e:
                print(f"[LegacyEngine] Error loading person model: {e}")

        ppe_weights = WEIGHTS_DIR / "ppe_merged_best.pt"
        if not ppe_weights.exists():
            ppe_weights = WEIGHTS_DIR / "ppe_master.pt"
        if not ppe_weights.exists():
            ppe_weights = WEIGHTS_DIR / "best.pt"
        if ppe_weights.exists():
            try:
                self.ppe_model = YOLO(str(ppe_weights))
                print(f"[LegacyEngine] Loaded PPE model: {ppe_weights}")
            except Exception as e:
                print(f"[LegacyEngine] Error loading PPE model: {e}")

        fire_weights = WEIGHTS_DIR / "fire_best.pt"
        if fire_weights.exists():
            try:
                self.fire_model = YOLO(str(fire_weights))
                print(f"[LegacyEngine] Loaded Fire model: {fire_weights}")
            except Exception as e:
                print(f"[LegacyEngine] Error loading Fire model: {e}")

    def run_ppe(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        h, w = frame.shape[:2]
        violations: List[Dict[str, Any]] = []

        if self.person_model is not None and self.ppe_model is not None:
            try:
                person_results = self.person_model(frame, classes=[0], conf=0.35, imgsz=416, verbose=False)
                persons: List[List[int]] = []
                for r in person_results:
                    for box in r.boxes:
                        xyxy = [int(v) for v in box.xyxy[0].tolist()]
                        if (xyxy[2] - xyxy[0]) > 20 and (xyxy[3] - xyxy[1]) > 40:
                            persons.append(xyxy)

                ppe_results = self.ppe_model(frame, conf=0.30, imgsz=416, verbose=False)
                detected_helmets: List[List[int]] = []
                detected_vests:   List[List[int]] = []
                detected_gloves:  List[List[int]] = []

                for r in ppe_results:
                    for box in r.boxes:
                        cls_id   = int(box.cls[0].item())
                        cls_name = r.names.get(cls_id, "").lower()
                        xyxy     = [int(v) for v in box.xyxy[0].tolist()]
                        if "helmet" in cls_name:
                            detected_helmets.append(xyxy)
                        elif "vest" in cls_name:
                            detected_vests.append(xyxy)
                        elif "glove" in cls_name:
                            detected_gloves.append(xyxy)

                for p_box in persons:
                    px1, py1, px2, py2 = p_box
                    p_height = py2 - py1
                    head_zone  = [px1, py1, px2, py1 + int(p_height * 0.28)]
                    has_helmet = any(bbox_iou_or_intersection(head_zone, h_box) > 0.15 for h_box in detected_helmets)
                    if not has_helmet:
                        violations.append({"class_name": "no_helmet", "confidence": 0.88, "bbox": head_zone})
                    torso_zone = [px1, py1 + int(p_height * 0.20), px2, py1 + int(p_height * 0.72)]
                    has_vest   = any(bbox_iou_or_intersection(torso_zone, v_box) > 0.15 for v_box in detected_vests)
                    if not has_vest:
                        violations.append({"class_name": "no_vest", "confidence": 0.84, "bbox": torso_zone})
                if violations:
                    return violations
                elif persons:
                    return []
            except Exception as e:
                print(f"[LegacyEngine] PPE error: {e}")

        return []

    def run_fire(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        h, w = frame.shape[:2]
        if self.fire_model is not None:
            try:
                results = self.fire_model(frame, conf=0.50, imgsz=416, verbose=False)
                detections = []
                for r in results:
                    for box in r.boxes:
                        cls_id   = int(box.cls[0].item())
                        cls_name = r.names.get(cls_id, "").lower()
                        conf_v   = float(box.conf[0].item())
                        xyxy     = [int(v) for v in box.xyxy[0].tolist()]
                        if cls_name in ("fire", "smoke"):
                            detections.append({"class_name": cls_name, "confidence": round(conf_v, 3), "bbox": xyxy})
                if detections:
                    return detections
            except Exception as e:
                print(f"[LegacyEngine] Fire error: {e}")
        if cv2 is None:
            return []
        hsv  = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        mask = cv2.inRange(hsv, np.array([8, 160, 200]), np.array([30, 255, 255]))
        nonzero = cv2.countNonZero(mask)
        if (nonzero / (h * w)) > 0.04:
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            detections = []
            for cnt in contours:
                if cv2.contourArea(cnt) > 2000:
                    x, y, bw, bh = cv2.boundingRect(cnt)
                    detections.append({"class_name": "fire",
                                        "confidence": round(0.55 + (cv2.contourArea(cnt) / (h * w)) * 5, 2),
                                        "bbox": [x, y, x + bw, y + bh]})
            if detections:
                return detections
        return []

    def infer_frame_full(self, frame: np.ndarray) -> Dict[str, Any]:
        h, w = frame.shape[:2]
        boxes_out: List[Dict[str, Any]] = []
        if self.person_model is not None and self.ppe_model is not None:
            try:
                person_results = self.person_model(frame, classes=[0], conf=0.32, imgsz=416, verbose=False)
                persons: List[List[int]] = []
                for r in person_results:
                    for box in r.boxes:
                        xyxy = [int(v) for v in box.xyxy[0].tolist()]
                        if (xyxy[2] - xyxy[0]) > 20 and (xyxy[3] - xyxy[1]) > 40:
                            persons.append(xyxy)
                ppe_results = self.ppe_model(frame, conf=0.25, imgsz=416, verbose=False)
                detected_helmets: List[List[int]] = []
                detected_vests:   List[List[int]] = []
                for r in ppe_results:
                    for box in r.boxes:
                        cls_id   = int(box.cls[0].item())
                        cls_name = r.names.get(cls_id, "").lower()
                        xyxy     = [int(v) for v in box.xyxy[0].tolist()]
                        if "helmet" in cls_name:
                            detected_helmets.append(xyxy)
                        elif "vest" in cls_name:
                            detected_vests.append(xyxy)
                for idx, p_box in enumerate(persons):
                    px1, py1, px2, py2 = p_box
                    p_height = py2 - py1
                    head_zone  = [px1, py1, px2, py1 + int(p_height * 0.28)]
                    torso_zone = [px1, py1 + int(p_height * 0.20), px2, py1 + int(p_height * 0.72)]
                    has_helmet = any(bbox_iou_or_intersection(head_zone, hb) > 0.12 for hb in detected_helmets)
                    has_vest   = any(bbox_iou_or_intersection(torso_zone, vb) > 0.12 for vb in detected_vests)
                    if has_helmet:
                        boxes_out.append({"class_name": "helmet", "label": "HARD HAT OK", "confidence": 0.95, "bbox": head_zone, "is_violation": False})
                    else:
                        boxes_out.append({"class_name": "no_helmet", "label": "NO HARD HAT", "confidence": 0.92, "bbox": head_zone, "is_violation": True})
                    if has_vest:
                        boxes_out.append({"class_name": "vest", "label": "HI-VIS VEST OK", "confidence": 0.96, "bbox": torso_zone, "is_violation": False})
                    else:
                        boxes_out.append({"class_name": "no_vest", "label": "NO HI-VIS VEST", "confidence": 0.89, "bbox": torso_zone, "is_violation": True})
                    boxes_out.append({"class_name": "worker", "label": f"WORKER #{idx+1}", "confidence": 0.96, "bbox": p_box, "is_violation": not (has_helmet and has_vest)})
                if self.fire_model is not None:
                    fire_results = self.fire_model(frame, conf=0.50, imgsz=416, verbose=False)
                    for r in fire_results:
                        for box in r.boxes:
                            cls_id   = int(box.cls[0].item())
                            cls_name = r.names.get(cls_id, "").lower()
                            conf_v   = float(box.conf[0].item())
                            xyxy     = [int(v) for v in box.xyxy[0].tolist()]
                            if cls_name in ("fire", "smoke"):
                                boxes_out.append({"class_name": cls_name, "label": f"{cls_name.upper()} HAZARD", "confidence": round(conf_v, 2), "bbox": xyxy, "is_violation": True})
            except Exception as e:
                print(f"[LegacyEngine] infer_frame_full error: {e}")
        return {"detections": boxes_out, "frame_width": w, "frame_height": h}


# ── Resolve active engine ──────────────────────────────────────────────────────
if engine is None:
    engine = _LegacyInferenceEngine()
    print("[inference_wrapper] 🔄 Using legacy inline engine as final fallback.")


# ── Public API ─────────────────────────────────────────────────────────────────

def run_ppe(frame: np.ndarray) -> List[Dict[str, Any]]:
    """PPE violation detection. Returns list of violation dicts."""
    return engine.run_ppe(frame)


def run_fire(frame: np.ndarray) -> List[Dict[str, Any]]:
    """Fire & smoke detection. Returns list of detection dicts."""
    return engine.run_fire(frame)


def infer_frame(frame: np.ndarray) -> Dict[str, Any]:
    """
    Full real-time inference: workers, PPE compliance badges, fire/smoke.
    Returns dict compatible with /demo/infer-frame endpoint.
    """
    return engine.infer_frame_full(frame)
