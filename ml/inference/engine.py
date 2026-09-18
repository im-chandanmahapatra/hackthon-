"""
ml/inference/engine.py — PATCHED
Uses batch tensor access (r.boxes.xyxy.cpu().numpy()) instead of
per-box iteration to avoid PyTorch 2.9 tensor indexing deprecation.
"""

from __future__ import annotations
import os
import time
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
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

_THIS_FILE   = Path(__file__).resolve()
REPO_ROOT    = _THIS_FILE.parent.parent.parent
WEIGHTS_DIR  = REPO_ROOT / "ml" / "weights"
CONFIG_PATH  = REPO_ROOT / "ml" / "configs" / "model_config.yaml"


def _load_yaml_config() -> dict:
    try:
        import yaml
        if CONFIG_PATH.exists():
            with open(CONFIG_PATH, "r") as f:
                return yaml.safe_load(f) or {}
    except Exception:
        pass
    return {}


def bbox_iou_or_intersection(boxA: List[int], boxB: List[int]) -> float:
    xA = max(boxA[0], boxB[0]); yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2]); yB = min(boxA[3], boxB[3])
    inter = max(0, xB - xA) * max(0, yB - yA)
    areaA = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
    return inter / float(areaA) if areaA > 0 else 0.0


def _try_load(weight_name: str) -> Optional[object]:
    if not ULTRALYTICS_AVAILABLE:
        return None
    path = WEIGHTS_DIR / weight_name
    if not path.exists():
        return None
    try:
        m = YOLO(str(path))
        print(f"[InferenceEngine] Loaded: {weight_name}")
        return m
    except Exception as e:
        print(f"[InferenceEngine] Failed to load {weight_name}: {e}")
        return None


def _extract_boxes(results) -> List[Dict[str, Any]]:
    """
    Extract boxes from YOLO results using batch tensor access.
    Avoids PyTorch 2.9 per-box tensor indexing deprecation.
    Returns list of {cls_id, cls_name, conf, bbox: [x1,y1,x2,y2]}
    """
    detections = []
    for r in results:
        if r.boxes is None or len(r.boxes) == 0:
            continue
        try:
            all_xyxy = r.boxes.xyxy.cpu().numpy()   # [N, 4]
            all_cls  = r.boxes.cls.cpu().numpy()    # [N]
            all_conf = r.boxes.conf.cpu().numpy()   # [N]
            for i in range(len(r.boxes)):
                cls_id   = int(all_cls[i])
                cls_name = r.names.get(cls_id, str(cls_id))
                conf_v   = float(all_conf[i])
                xyxy     = [int(v) for v in all_xyxy[i]]
                detections.append({
                    "cls_id":   cls_id,
                    "cls_name": cls_name,
                    "conf":     conf_v,
                    "bbox":     xyxy,
                })
        except Exception as e:
            print(f"[InferenceEngine] Box extraction warning: {e}")
    return detections


class InferenceEngine:
    def __init__(self):
        self._cfg         = _load_yaml_config()
        self._mode        = self._cfg.get("mode", "optimized")
        self.person_model = None
        self.ppe_model    = None
        self.fire_model   = None
        self._model_label = "unloaded"
        self._load_models()

    def _load_models(self) -> None:
        WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
        self.person_model = _try_load("yolov8n.pt")
        self.ppe_model, self._model_label = self._select_ppe_model()
        self.fire_model = _try_load("fire_best.pt")
        if self.fire_model is None:
            print("[InferenceEngine] Fire model not found — using heuristic fallback.")
        print(f"[InferenceEngine] Active PPE model: {self._model_label}  (mode={self._mode})")

    def _select_ppe_model(self) -> Tuple[Optional[object], str]:
        mode = self._mode
        if mode == "legacy":
            m = _try_load("ppe_best.pt")
            if m:
                return m, "legacy (ppe_best.pt)"
            raise RuntimeError("[InferenceEngine] CRITICAL: ppe_best.pt missing and mode=legacy.")
        if mode == "ensemble":
            primary   = (_try_load("ppe_merged_best.pt") or _try_load("ppe_master.pt"))
            secondary = _try_load("ppe_master.pt") if primary and primary != _try_load("ppe_master.pt") else None
            if primary is None:
                raise RuntimeError("[InferenceEngine] No PPE model available for ensemble.")
            if secondary is None:
                return primary, "optimized (single model)"
            try:
                from ml.models.ensemble import EnsembleModel
                cfg_e = self._cfg.get("ensemble", {})
                ens = EnsembleModel(
                    primary_model=primary, secondary_model=secondary,
                    primary_weight=cfg_e.get("master_weight", 0.65),
                    secondary_weight=cfg_e.get("legacy_weight", 0.35),
                    iou_thr=cfg_e.get("iou_threshold", 0.55),
                    skip_box_thr=cfg_e.get("skip_box_threshold", 0.30),
                )
                return ens, "ensemble (master+merged WBF)"
            except Exception as e:
                print(f"[InferenceEngine] Ensemble init error: {e}; using primary.")
                return primary, "ensemble-fallback"
        # optimized (default)
        for wname, label in [
            ("ppe_merged_best.pt", "merged (ppe_merged_best.pt)"),
            ("ppe_master.pt",      "master (ppe_master.pt)"),
        ]:
            m = _try_load(wname)
            if m:
                return m, label
        print("[InferenceEngine] No PPE weights found; heuristic mode.")
        return None, "heuristic"

    def _run_ppe_inference(self, frame: np.ndarray, conf: float = 0.30,
                            imgsz: int = 640) -> List[Dict[str, Any]]:
        """Run PPE model; return raw detections using batch tensor access."""
        if self.ppe_model is None:
            return []
        try:
            # EnsembleModel has a custom .predict() returning List[Dict]
            # YOLO also has .predict() but it returns Results objects
            # Distinguish by checking for the EnsembleModel class specifically
            try:
                from ml.models.ensemble import EnsembleModel
                if isinstance(self.ppe_model, EnsembleModel):
                    return self.ppe_model.predict(frame, conf=conf, imgsz=imgsz)
            except ImportError:
                pass
            # Standard YOLO model - use batch tensor access
            results = self.ppe_model(frame, conf=conf, imgsz=imgsz, verbose=False)
            return _extract_boxes(results)
        except Exception as e:
            print(f"[InferenceEngine] PPE inference error: {e}")
            return []

    def _run_person_inference(self, frame: np.ndarray, conf: float = 0.35,
                               imgsz: int = 416) -> List[List[int]]:
        """Run person detector; return list of [x1,y1,x2,y2] boxes."""
        if self.person_model is None:
            return []
        try:
            results = self.person_model(frame, classes=[0], conf=conf, imgsz=imgsz, verbose=False)
            persons = []
            for det in _extract_boxes(results):
                xyxy = det["bbox"]
                if (xyxy[2] - xyxy[0]) > 20 and (xyxy[3] - xyxy[1]) > 40:
                    persons.append(xyxy)
            return persons
        except Exception as e:
            print(f"[InferenceEngine] Person inference error: {e}")
            return []

    def run_ppe(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """PPE compliance check. Returns violation dicts."""
        h, w = frame.shape[:2]
        violations: List[Dict[str, Any]] = []

        if self.person_model is None or self.ppe_model is None:
            return []

        try:
            persons  = self._run_person_inference(frame, conf=0.35, imgsz=416)
            ppe_dets = self._run_ppe_inference(frame, conf=0.30, imgsz=640)

            detected_helmets: List[List[int]] = []
            detected_vests:   List[List[int]] = []
            for d in ppe_dets:
                cname = d["cls_name"].lower()
                if "helmet" in cname:
                    detected_helmets.append(d["bbox"])
                elif "vest" in cname:
                    detected_vests.append(d["bbox"])

            spatial_cfg = self._cfg.get("spatial", {})
            head_ratio  = spatial_cfg.get("head_zone_ratio", 0.28)
            torso_upper = spatial_cfg.get("torso_upper_ratio", 0.20)
            torso_lower = spatial_cfg.get("torso_lower_ratio", 0.72)
            iou_thr     = spatial_cfg.get("iou_threshold", 0.12)
            comp_cfg    = self._cfg.get("compliance", {})
            unc_thr     = comp_cfg.get("uncertain_threshold", 0.20)

            for p_box in persons:
                px1, py1, px2, py2 = p_box
                p_height = py2 - py1
                head_zone  = [px1, py1, px2, py1 + int(p_height * head_ratio)]
                torso_zone = [px1, py1 + int(p_height * torso_upper),
                               px2, py1 + int(p_height * torso_lower)]

                helm_ious = [bbox_iou_or_intersection(head_zone, hb) for hb in detected_helmets]
                vest_ious = [bbox_iou_or_intersection(torso_zone, vb) for vb in detected_vests]
                best_h = max(helm_ious, default=0.0)
                best_v = max(vest_ious, default=0.0)

                if best_h >= iou_thr:
                    pass  # COMPLIANT
                elif best_h >= unc_thr:
                    violations.append({"class_name": "no_helmet", "confidence": 0.60,
                                        "bbox": head_zone, "compliance_state": "UNCERTAIN"})
                else:
                    violations.append({"class_name": "no_helmet", "confidence": 0.88,
                                        "bbox": head_zone, "compliance_state": "VIOLATION"})

                if best_v >= iou_thr:
                    pass  # COMPLIANT
                elif best_v >= unc_thr:
                    violations.append({"class_name": "no_vest", "confidence": 0.60,
                                        "bbox": torso_zone, "compliance_state": "UNCERTAIN"})
                else:
                    violations.append({"class_name": "no_vest", "confidence": 0.84,
                                        "bbox": torso_zone, "compliance_state": "VIOLATION"})

        except Exception as e:
            print(f"[InferenceEngine] run_ppe error: {e}")

        return violations

    def run_fire(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        h, w = frame.shape[:2]
        if self.fire_model is not None:
            try:
                results = self.fire_model(frame, conf=0.50, imgsz=416, verbose=False)
                detections = []
                for det in _extract_boxes(results):
                    cname = det["cls_name"].lower()
                    if cname in ("fire", "smoke"):
                        detections.append({"class_name": cname,
                                            "confidence": round(det["conf"], 3),
                                            "bbox": det["bbox"]})
                if detections:
                    return detections
            except Exception as e:
                print(f"[InferenceEngine] Fire model error: {e}")
        return self._heuristic_fire_detection(frame, h, w)

    def _heuristic_fire_detection(self, frame: np.ndarray, h: int, w: int) -> List[Dict[str, Any]]:
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
                persons  = self._run_person_inference(frame, conf=0.32, imgsz=416)
                ppe_dets = self._run_ppe_inference(frame, conf=0.25, imgsz=640)

                detected_helmets: List[List[int]] = []
                detected_vests:   List[List[int]] = []
                for d in ppe_dets:
                    cname = d["cls_name"].lower()
                    if "helmet" in cname:
                        detected_helmets.append(d["bbox"])
                    elif "vest" in cname:
                        detected_vests.append(d["bbox"])

                spatial_cfg = self._cfg.get("spatial", {})
                head_ratio  = spatial_cfg.get("head_zone_ratio", 0.28)
                torso_upper = spatial_cfg.get("torso_upper_ratio", 0.20)
                torso_lower = spatial_cfg.get("torso_lower_ratio", 0.72)
                iou_thr     = spatial_cfg.get("iou_threshold", 0.12)

                for idx, p_box in enumerate(persons):
                    px1, py1, px2, py2 = p_box
                    p_height = py2 - py1
                    head_zone  = [px1, py1, px2, py1 + int(p_height * head_ratio)]
                    torso_zone = [px1, py1 + int(p_height * torso_upper),
                                   px2, py1 + int(p_height * torso_lower)]

                    helm_ious = [bbox_iou_or_intersection(head_zone, hb) for hb in detected_helmets]
                    vest_ious = [bbox_iou_or_intersection(torso_zone, vb) for vb in detected_vests]
                    has_helmet = max(helm_ious, default=0.0) >= iou_thr
                    has_vest   = max(vest_ious, default=0.0) >= iou_thr

                    if has_helmet:
                        boxes_out.append({"class_name": "helmet", "label": "HARD HAT OK",
                                           "confidence": 0.95, "bbox": head_zone, "is_violation": False})
                    else:
                        boxes_out.append({"class_name": "no_helmet", "label": "NO HARD HAT",
                                           "confidence": 0.92, "bbox": head_zone, "is_violation": True})
                    if has_vest:
                        boxes_out.append({"class_name": "vest", "label": "HI-VIS VEST OK",
                                           "confidence": 0.96, "bbox": torso_zone, "is_violation": False})
                    else:
                        boxes_out.append({"class_name": "no_vest", "label": "NO HI-VIS VEST",
                                           "confidence": 0.89, "bbox": torso_zone, "is_violation": True})
                    boxes_out.append({"class_name": "worker", "label": f"WORKER #{idx+1}",
                                       "confidence": 0.96, "bbox": p_box,
                                       "is_violation": not (has_helmet and has_vest)})

                if self.fire_model is not None:
                    fire_results = self.fire_model(frame, conf=0.50, imgsz=416, verbose=False)
                    for det in _extract_boxes(fire_results):
                        cname = det["cls_name"].lower()
                        if cname in ("fire", "smoke"):
                            boxes_out.append({"class_name": cname, "label": f"{cname.upper()} HAZARD",
                                               "confidence": round(det["conf"], 2), "bbox": det["bbox"],
                                               "is_violation": True})
            except Exception as e:
                print(f"[InferenceEngine] infer_frame_full error: {e}")

        return {"detections": boxes_out, "frame_width": w, "frame_height": h}

