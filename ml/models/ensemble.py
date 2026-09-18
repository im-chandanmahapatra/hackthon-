"""
ml/models/ensemble.py
=====================
Weighted Box Fusion (WBF) ensemble of multiple YOLO PPE models.
Only activated when mode=ensemble in model_config.yaml.

If ensemble performs worse than single-model on the test set,
it remains optional and inactive by default.
"""

from __future__ import annotations
from typing import List, Dict, Any, Optional, Tuple
import numpy as np

try:
    from ultralytics import YOLO
    ULTRALYTICS_AVAILABLE = True
except ImportError:
    ULTRALYTICS_AVAILABLE = False
    YOLO = None


def _run_single_model(model, frame: np.ndarray, conf: float = 0.25,
                      imgsz: int = 640) -> List[Dict[str, Any]]:
    """Run a single YOLO model and return normalised detections."""
    detections = []
    try:
        results = model(frame, conf=conf, imgsz=imgsz, verbose=False)
        h, w = frame.shape[:2]
        for r in results:
            for box in r.boxes:
                cls_id   = int(box.cls[0].item())
                cls_name = r.names.get(cls_id, str(cls_id))
                conf_val = float(box.conf[0].item())
                xyxy     = [int(v) for v in box.xyxy[0].tolist()]
                # Normalise bbox to [0,1] for WBF
                x1n = xyxy[0] / w
                y1n = xyxy[1] / h
                x2n = xyxy[2] / w
                y2n = xyxy[3] / h
                detections.append({
                    "cls_id":   cls_id,
                    "cls_name": cls_name,
                    "conf":     conf_val,
                    "bbox_abs": xyxy,
                    "bbox_norm": [x1n, y1n, x2n, y2n],
                })
    except Exception as e:
        print(f"[Ensemble] Model inference error: {e}")
    return detections


def _bb_iou(b1: List[float], b2: List[float]) -> float:
    """IoU between two normalised [x1,y1,x2,y2] boxes."""
    xi1 = max(b1[0], b2[0])
    yi1 = max(b1[1], b2[1])
    xi2 = min(b1[2], b2[2])
    yi2 = min(b1[3], b2[3])
    inter = max(0.0, xi2 - xi1) * max(0.0, yi2 - yi1)
    a1 = (b1[2] - b1[0]) * (b1[3] - b1[1])
    a2 = (b2[2] - b2[0]) * (b2[3] - b2[1])
    union = a1 + a2 - inter
    return inter / union if union > 0 else 0.0


def weighted_box_fusion(
    model_detections: List[List[Dict[str, Any]]],
    model_weights: List[float],
    iou_thr: float = 0.55,
    skip_box_thr: float = 0.30,
    frame_hw: Tuple[int, int] = (640, 640),
) -> List[Dict[str, Any]]:
    """
    Simplified Weighted Box Fusion across N model outputs.
    Groups overlapping boxes by class, fuses with weighted average.
    Returns list of fused detections with absolute bbox coordinates.
    """
    h, w = frame_hw
    # Collect all boxes: (cls_id, cls_name, conf*weight, bbox_norm)
    all_boxes: List[Tuple[int, str, float, List[float]]] = []
    for dets, wt in zip(model_detections, model_weights):
        for d in dets:
            scored = d["conf"] * wt
            if scored >= skip_box_thr * min(model_weights):
                all_boxes.append((d["cls_id"], d["cls_name"], scored, d["bbox_norm"]))

    if not all_boxes:
        return []

    # Sort by confidence descending
    all_boxes.sort(key=lambda x: -x[2])

    fused: List[Dict[str, Any]] = []
    used = [False] * len(all_boxes)

    for i, (cid_i, cn_i, sc_i, box_i) in enumerate(all_boxes):
        if used[i]:
            continue
        cluster_boxes = [box_i]
        cluster_scores = [sc_i]
        used[i] = True
        for j, (cid_j, cn_j, sc_j, box_j) in enumerate(all_boxes):
            if used[j] or cid_j != cid_i:
                continue
            if _bb_iou(box_i, box_j) > iou_thr:
                cluster_boxes.append(box_j)
                cluster_scores.append(sc_j)
                used[j] = True

        total_score = sum(cluster_scores)
        weights_norm = [s / total_score for s in cluster_scores]
        fused_norm = [
            sum(b[k] * weights_norm[bi] for bi, b in enumerate(cluster_boxes))
            for k in range(4)
        ]
        fused_conf = total_score / len(model_weights)

        # Convert back to absolute coords
        x1 = int(fused_norm[0] * w)
        y1 = int(fused_norm[1] * h)
        x2 = int(fused_norm[2] * w)
        y2 = int(fused_norm[3] * h)

        if fused_conf >= skip_box_thr:
            fused.append({
                "cls_id":   cid_i,
                "cls_name": cn_i,
                "conf":     round(fused_conf, 4),
                "bbox":     [x1, y1, x2, y2],
            })

    return fused


class EnsembleModel:
    """
    Two-model PPE ensemble using Weighted Box Fusion.
    Falls back to the primary model if secondary is unavailable.
    """

    def __init__(
        self,
        primary_model,
        secondary_model=None,
        primary_weight: float = 0.65,
        secondary_weight: float = 0.35,
        iou_thr: float = 0.55,
        skip_box_thr: float = 0.30,
    ):
        self.primary   = primary_model
        self.secondary = secondary_model
        self.weights   = [primary_weight, secondary_weight]
        self.iou_thr   = iou_thr
        self.skip_thr  = skip_box_thr

    @property
    def names(self):
        """Return class names dict from primary model."""
        if self.primary is not None and hasattr(self.primary, "names"):
            return self.primary.names
        return {0: "Gloves", 1: "Vest", 2: "goggles", 3: "helmet", 4: "mask", 5: "safety_shoe"}

    def predict(
        self, frame: np.ndarray, conf: float = 0.25, imgsz: int = 640
    ) -> List[Dict[str, Any]]:
        """
        Run ensemble inference and return fused detections.
        Each detection: {cls_id, cls_name, conf, bbox: [x1,y1,x2,y2]}
        """
        h, w = frame.shape[:2]

        primary_dets = _run_single_model(self.primary, frame, conf, imgsz) if self.primary else []

        if self.secondary is not None:
            secondary_dets = _run_single_model(self.secondary, frame, conf, imgsz)
            model_outputs  = [primary_dets, secondary_dets]
            model_weights  = self.weights
        else:
            # Single-model passthrough (no ensemble benefit)
            model_outputs = [primary_dets]
            model_weights = [1.0]

        return weighted_box_fusion(
            model_outputs, model_weights,
            iou_thr=self.iou_thr,
            skip_box_thr=self.skip_thr,
            frame_hw=(h, w),
        )
