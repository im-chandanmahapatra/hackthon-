import os
from pathlib import Path
from typing import List, Dict, Any
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from backend.config import settings

def annotate_and_save_snapshot(frame: np.ndarray, incident_id: str, detections: List[Dict[str, Any]]) -> str:
    """
    Renders high-visibility bounding reticles and HUD labels onto the frame,
    saving the result to evidence/{incident_id}.jpg.
    Returns: relative URL path (/evidence/{incident_id}.jpg)
    """
    # Convert BGR (OpenCV) to RGB (PIL)
    if len(frame.shape) == 3 and frame.shape[2] == 3:
        # Assuming BGR input from OpenCV
        rgb_frame = frame[:, :, ::-1]
    else:
        rgb_frame = frame

    img = Image.fromarray(rgb_frame)
    draw = ImageDraw.Draw(img)

    for det in detections:
        cls_name = det.get("class_name", "violation")
        conf = det.get("confidence", 0.0)
        bbox = det.get("bbox", [0, 0, 100, 100])
        x1, y1, x2, y2 = bbox

        # Color schemes matching Argus design tokens:
        # Fire / Smoke -> Crimson Red (#EF4444)
        # PPE Violations -> Safety Amber (#F59E0B)
        if "fire" in cls_name.lower() or "smoke" in cls_name.lower():
            box_color = (239, 68, 68)      # Crimson Red
            label_text = f"HAZARD: {cls_name.upper()} ({int(conf * 100)}%)"
        else:
            box_color = (245, 158, 11)     # Safety Amber
            label_text = f"PPE ALERT: {cls_name.replace('_', ' ').upper()} ({int(conf * 100)}%)"

        # Draw primary bounding rectangle
        draw.rectangle([x1, y1, x2, y2], outline=box_color, width=3)

        # Draw corner accent reticles for cyberpunk HUD look
        corner_len = min(16, (x2 - x1) // 4, (y2 - y1) // 4)
        if corner_len > 4:
            # Top-left
            draw.line([(x1, y1), (x1 + corner_len, y1)], fill=box_color, width=5)
            draw.line([(x1, y1), (x1, y1 + corner_len)], fill=box_color, width=5)
            # Top-right
            draw.line([(x2, y1), (x2 - corner_len, y1)], fill=box_color, width=5)
            draw.line([(x2, y1), (x2, y1 + corner_len)], fill=box_color, width=5)
            # Bottom-left
            draw.line([(x1, y2), (x1 + corner_len, y2)], fill=box_color, width=5)
            draw.line([(x1, y2), (x1, y2 - corner_len)], fill=box_color, width=5)
            # Bottom-right
            draw.line([(x2, y2), (x2 - corner_len, y2)], fill=box_color, width=5)
            draw.line([(x2, y2), (x2, y2 - corner_len)], fill=box_color, width=5)

        # Draw tag pill
        tag_h = 22
        tag_w = len(label_text) * 8 + 14
        pill_y1 = max(0, y1 - tag_h - 4)
        pill_y2 = pill_y1 + tag_h
        draw.rectangle([x1, pill_y1, x1 + tag_w, pill_y2], fill=(15, 15, 18))
        draw.rectangle([x1, pill_y1, x1 + tag_w, pill_y2], outline=box_color, width=1)
        draw.text((x1 + 6, pill_y1 + 4), label_text, fill=(255, 255, 255))

    filename = f"{incident_id}.jpg"
    target_path = settings.EVIDENCE_DIR / filename
    img.save(str(target_path), "JPEG", quality=90)

    return f"/evidence/{filename}"
