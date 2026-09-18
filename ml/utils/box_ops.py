"""
ml/utils/box_ops.py
====================
Bounding box utility functions for PPE detection pipeline.
"""

from __future__ import annotations
from typing import List, Tuple
import numpy as np


def xyxy_to_xywh(box: List[int]) -> List[int]:
    """Convert [x1,y1,x2,y2] to [x,y,w,h]."""
    return [box[0], box[1], box[2] - box[0], box[3] - box[1]]


def xywh_to_xyxy(box: List[int]) -> List[int]:
    """Convert [x,y,w,h] to [x1,y1,x2,y2]."""
    return [box[0], box[1], box[0] + box[2], box[1] + box[3]]


def iou(boxA: List[float], boxB: List[float]) -> float:
    """Standard Intersection-over-Union for two [x1,y1,x2,y2] boxes."""
    xA = max(boxA[0], boxB[0]); yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2]); yB = min(boxA[3], boxB[3])
    inter = max(0.0, xB - xA) * max(0.0, yB - yA)
    aA = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
    aB = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1])
    union = aA + aB - inter
    return inter / union if union > 0 else 0.0


def intersection_over_first(boxA: List[float], boxB: List[float]) -> float:
    """Intersection area relative to boxA area (for spatial matching)."""
    xA = max(boxA[0], boxB[0]); yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2]); yB = min(boxA[3], boxB[3])
    inter = max(0.0, xB - xA) * max(0.0, yB - yA)
    aA = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
    return inter / float(aA) if aA > 0 else 0.0


def nms(boxes: List[List[float]], scores: List[float], iou_thr: float = 0.5) -> List[int]:
    """
    Non-Maximum Suppression.
    Returns indices of kept boxes, sorted by score descending.
    """
    if not boxes:
        return []
    order = sorted(range(len(scores)), key=lambda i: -scores[i])
    keep = []
    while order:
        idx = order.pop(0)
        keep.append(idx)
        order = [j for j in order if iou(boxes[idx], boxes[j]) < iou_thr]
    return keep


def clip_box(box: List[int], frame_w: int, frame_h: int) -> List[int]:
    """Clip bounding box coordinates to frame boundaries."""
    return [
        max(0, min(box[0], frame_w)),
        max(0, min(box[1], frame_h)),
        max(0, min(box[2], frame_w)),
        max(0, min(box[3], frame_h)),
    ]


def is_valid_bbox(box: List[float], frame_w: int = 0, frame_h: int = 0) -> bool:
    """
    Check if a bounding box is valid:
      - Has 4 elements
      - x2 > x1, y2 > y1
      - Positive area
      - If frame size given, within frame bounds
    """
    if len(box) != 4:
        return False
    x1, y1, x2, y2 = box
    if x2 <= x1 or y2 <= y1:
        return False
    if (x2 - x1) * (y2 - y1) <= 0:
        return False
    if frame_w > 0 and frame_h > 0:
        if x1 < 0 or y1 < 0 or x2 > frame_w or y2 > frame_h:
            return False
    return True


def normalise_yolo_bbox(cx: float, cy: float, bw: float, bh: float) -> bool:
    """Validate YOLO format normalised bbox (cx, cy, w, h all in [0,1])."""
    return (0.0 < cx < 1.0 and 0.0 < cy < 1.0
            and 0.0 < bw <= 1.0 and 0.0 < bh <= 1.0)
