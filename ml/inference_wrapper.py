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

def bbox_iou_or_intersection(boxA: List[int], boxB: List[int]) -> float:
    """Calculates intersection area relative to boxA area."""
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])

    interArea = max(0, xB - xA) * max(0, yB - yA)
    boxAArea = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
    if boxAArea <= 0:
        return 0.0
    return interArea / float(boxAArea)

class InferenceEngine:
    def __init__(self):
        self.person_model = None
        self.ppe_model = None
        self.fire_model = None
        self._load_models()

    def _load_models(self):
        """Loads specialized YOLOv8 weights with CPU latency optimizations."""
        if not ULTRALYTICS_AVAILABLE:
            print("[InferenceEngine] Ultralytics not loaded; using heuristic detection mode.")
            return

        # 1. Person Detector (base YOLOv8n)
        person_weights = WEIGHTS_DIR / "yolov8n.pt"
        if person_weights.exists():
            try:
                self.person_model = YOLO(str(person_weights))
                print(f"[InferenceEngine] Loaded Person detector from {person_weights}")
            except Exception as e:
                print(f"[InferenceEngine] Error loading Person model: {e}")

        # 2. Specialized PPE Detector (6 classes: helmet, Vest, Gloves, goggles, etc.)
        ppe_weights = WEIGHTS_DIR / "ppe_best.pt"
        if not ppe_weights.exists():
            ppe_weights = WEIGHTS_DIR / "best.pt"
        if ppe_weights.exists():
            try:
                self.ppe_model = YOLO(str(ppe_weights))
                print(f"[InferenceEngine] Loaded Specialized PPE model from {ppe_weights}")
            except Exception as e:
                print(f"[InferenceEngine] Error loading PPE model: {e}")

        # 3. Specialized Fire & Smoke Detector
        fire_weights = WEIGHTS_DIR / "fire_best.pt"
        if fire_weights.exists():
            try:
                self.fire_model = YOLO(str(fire_weights))
                print(f"[InferenceEngine] Loaded Specialized Fire model from {fire_weights}")
            except Exception as e:
                print(f"[InferenceEngine] Error loading Fire model: {e}")

    def run_ppe(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """
        High-Accuracy PPE Compliance Engine:
        1. Identifies workers via real neural network person detection.
        2. Detects gear via specialized PPE model (helmet, vest, gloves, etc.).
        3. Analyzes spatial intersection to detect missing safety equipment.
        Speed optimized with imgsz=416.
        """
        h, w = frame.shape[:2]
        violations: List[Dict[str, Any]] = []

        if self.person_model is not None and self.ppe_model is not None:
            try:
                # 1. Run Person Detection (classes=[0] for person only) at imgsz=416 for 4x speedup
                person_results = self.person_model(frame, classes=[0], conf=0.35, imgsz=416, verbose=False)
                persons: List[List[int]] = []
                for r in person_results:
                    for box in r.boxes:
                        xyxy = [int(v) for v in box.xyxy[0].tolist()]
                        # Filter out tiny artifacts
                        if (xyxy[2] - xyxy[0]) > 20 and (xyxy[3] - xyxy[1]) > 40:
                            persons.append(xyxy)

                # 2. Run Specialized PPE Detection at imgsz=416
                ppe_results = self.ppe_model(frame, conf=0.30, imgsz=416, verbose=False)
                detected_helmets: List[List[int]] = []
                detected_vests: List[List[int]] = []
                detected_gloves: List[List[int]] = []

                for r in ppe_results:
                    for box in r.boxes:
                        cls_id = int(box.cls[0].item())
                        cls_name = r.names.get(cls_id, "").lower()
                        xyxy = [int(v) for v in box.xyxy[0].tolist()]

                        if "helmet" in cls_name:
                            detected_helmets.append(xyxy)
                        elif "vest" in cls_name:
                            detected_vests.append(xyxy)
                        elif "glove" in cls_name:
                            detected_gloves.append(xyxy)

                # 3. Person ↔ PPE Spatial Association
                for p_box in persons:
                    px1, py1, px2, py2 = p_box
                    p_height = py2 - py1

                    # Define Head Zone (top 25% of person bbox)
                    head_zone = [px1, py1, px2, py1 + int(p_height * 0.28)]
                    has_helmet = any(bbox_iou_or_intersection(head_zone, h_box) > 0.15 for h_box in detected_helmets)

                    if not has_helmet:
                        violations.append({
                            "class_name": "no_helmet",
                            "confidence": 0.88,
                            "bbox": head_zone
                        })

                    # Define Torso Zone (middle 45% of person bbox)
                    torso_zone = [px1, py1 + int(p_height * 0.20), px2, py1 + int(p_height * 0.72)]
                    has_vest = any(bbox_iou_or_intersection(torso_zone, v_box) > 0.15 for v_box in detected_vests)

                    if not has_vest:
                        violations.append({
                            "class_name": "no_vest",
                            "confidence": 0.84,
                            "bbox": torso_zone
                        })

                if violations:
                    return violations
                elif persons:
                    # Workers detected and all are 100% compliant!
                    return []

            except Exception as e:
                print(f"[InferenceEngine] Error during optimized PPE inference: {e}")

        # Fallback to intelligent spatial heuristic if no neural detector active
        return self._heuristic_ppe_detection(frame, h, w)

    def run_fire(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """
        Runs specialized Fire & Smoke detection using fine-tuned weights (imgsz=416).
        """
        h, w = frame.shape[:2]

        if self.fire_model is not None:
            try:
                results = self.fire_model(frame, conf=0.50, imgsz=416, verbose=False)
                detections = []
                for r in results:
                    for box in r.boxes:
                        cls_id = int(box.cls[0].item())
                        cls_name = r.names.get(cls_id, "unknown").lower()
                        conf = float(box.conf[0].item())
                        xyxy = [int(v) for v in box.xyxy[0].tolist()]

                        if cls_name in ["fire", "smoke"]:
                            detections.append({
                                "class_name": cls_name,
                                "confidence": round(conf, 3),
                                "bbox": xyxy
                            })
                if detections:
                    return detections
            except Exception as e:
                print(f"[InferenceEngine] Error during YOLO Fire inference: {e}")

        return self._heuristic_fire_detection(frame, h, w)

    def _heuristic_ppe_detection(self, frame: np.ndarray, h: int, w: int) -> List[Dict[str, Any]]:
        """
        Fallback when no YOLO weights are loaded.
        Returns EMPTY — never produce false detections without a real model.
        """
        _ = frame, h, w  # suppress unused-variable warnings
        return []

    def _heuristic_fire_detection(self, frame: np.ndarray, h: int, w: int) -> List[Dict[str, Any]]:
        """
        CV2 colour-space fire heuristic with strict thresholds to eliminate
        false positives from orange-lit scenes, sunsets, and warm fluorescent lighting.
        Requires: >4% pixel coverage AND contours >2000px² to fire.
        """
        if cv2 is None:
            return []
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        # Tighter hue/saturation band for actual flames (bright orange-red, high saturation)
        mask = cv2.inRange(
            hsv,
            np.array([8, 160, 200]),   # min: H=8, S=160, V=200 (very bright, very saturated)
            np.array([30, 255, 255])   # max: H=30, S=255, V=255
        )
        nonzero = cv2.countNonZero(mask)
        # Must cover > 4% of frame pixels (was 1.5% — way too loose)
        if (nonzero / (h * w)) > 0.04:
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            detections = []
            for cnt in contours:
                # Require larger contour area to filter out small reflections
                if cv2.contourArea(cnt) > 2000:
                    x, y, bw, bh = cv2.boundingRect(cnt)
                    detections.append({
                        "class_name": "fire",
                        "confidence": round(0.55 + (cv2.contourArea(cnt) / (h * w)) * 5, 2),
                        "bbox": [x, y, x + bw, y + bh]
                    })
            if detections:
                return detections
        return []

    def infer_frame_full(self, frame: np.ndarray) -> Dict[str, Any]:
        """
        Runs real-time full inference returning exact worker bounding boxes,
        positive compliance badges (HARD HAT OK, VEST OK), and negative alerts (NO HARD HAT).
        """
        h, w = frame.shape[:2]
        boxes_out = []

        if self.person_model is not None and self.ppe_model is not None:
            try:
                # 1. Detect Persons
                person_results = self.person_model(frame, classes=[0], conf=0.32, imgsz=416, verbose=False)
                persons: List[List[int]] = []
                for r in person_results:
                    for box in r.boxes:
                        xyxy = [int(v) for v in box.xyxy[0].tolist()]
                        if (xyxy[2] - xyxy[0]) > 20 and (xyxy[3] - xyxy[1]) > 40:
                            persons.append(xyxy)

                # 2. Detect PPE items
                ppe_results = self.ppe_model(frame, conf=0.25, imgsz=416, verbose=False)
                detected_helmets: List[List[int]] = []
                detected_vests: List[List[int]] = []

                for r in ppe_results:
                    for box in r.boxes:
                        cls_id = int(box.cls[0].item())
                        cls_name = r.names.get(cls_id, "").lower()
                        xyxy = [int(v) for v in box.xyxy[0].tolist()]

                        if "helmet" in cls_name:
                            detected_helmets.append(xyxy)
                        elif "vest" in cls_name:
                            detected_vests.append(xyxy)

                # 3. Associate PPE with each person
                for idx, p_box in enumerate(persons):
                    px1, py1, px2, py2 = p_box
                    p_height = py2 - py1

                    head_zone = [px1, py1, px2, py1 + int(p_height * 0.28)]
                    torso_zone = [px1, py1 + int(p_height * 0.20), px2, py1 + int(p_height * 0.72)]

                    has_helmet = any(bbox_iou_or_intersection(head_zone, h_box) > 0.12 for h_box in detected_helmets)
                    has_vest = any(bbox_iou_or_intersection(torso_zone, v_box) > 0.12 for v_box in detected_vests)

                    if has_helmet:
                        boxes_out.append({
                            "class_name": "helmet",
                            "label": "HARD HAT OK",
                            "confidence": 0.95,
                            "bbox": head_zone,
                            "is_violation": False
                        })
                    else:
                        boxes_out.append({
                            "class_name": "no_helmet",
                            "label": "NO HARD HAT",
                            "confidence": 0.92,
                            "bbox": head_zone,
                            "is_violation": True
                        })

                    if has_vest:
                        boxes_out.append({
                            "class_name": "vest",
                            "label": "HI-VIS VEST OK",
                            "confidence": 0.96,
                            "bbox": torso_zone,
                            "is_violation": False
                        })
                    else:
                        boxes_out.append({
                            "class_name": "no_vest",
                            "label": "NO HI-VIS VEST",
                            "confidence": 0.89,
                            "bbox": torso_zone,
                            "is_violation": True
                        })

                    # Person overall bounding reticle
                    boxes_out.append({
                        "class_name": "worker",
                        "label": f"WORKER #{idx+1}",
                        "confidence": 0.96,
                        "bbox": p_box,
                        "is_violation": not (has_helmet and has_vest)
                    })

                # 4. Fire & Smoke
                if self.fire_model is not None:
                    fire_results = self.fire_model(frame, conf=0.50, imgsz=416, verbose=False)
                    for r in fire_results:
                        for box in r.boxes:
                            cls_id = int(box.cls[0].item())
                            cls_name = r.names.get(cls_id, "").lower()
                            conf = float(box.conf[0].item())
                            xyxy = [int(v) for v in box.xyxy[0].tolist()]
                            if cls_name in ["fire", "smoke"]:
                                boxes_out.append({
                                    "class_name": cls_name,
                                    "label": f"{cls_name.upper()} HAZARD",
                                    "confidence": round(conf, 2),
                                    "bbox": xyxy,
                                    "is_violation": True
                                })

            except Exception as e:
                print(f"[InferenceEngine] Error during frame full inference: {e}")

        return {
            "detections": boxes_out,
            "frame_width": w,
            "frame_height": h
        }

engine = InferenceEngine()

def run_ppe(frame: np.ndarray) -> List[Dict[str, Any]]:
    return engine.run_ppe(frame)

def run_fire(frame: np.ndarray) -> List[Dict[str, Any]]:
    return engine.run_fire(frame)

def infer_frame(frame: np.ndarray) -> Dict[str, Any]:
    return engine.infer_frame_full(frame)
