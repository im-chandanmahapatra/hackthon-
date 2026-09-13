import os
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import List
import numpy as np

try:
    import cv2
except ImportError:
    cv2 = None

from backend.db import SessionLocal
from backend.models import ProcessingJob, Incident, Detection, Evidence, Camera
from backend.services.debounce import DebounceTracker
from backend.services.annotator import annotate_and_save_snapshot
from ml.inference_wrapper import run_ppe, run_fire

def process_video_background(job_id: str, video_path: str, camera_id: str = "cam-01"):
    """
    Background worker that extracts frames from an uploaded video at ~2 FPS,
    executes AI inference, applies 2-of-3 temporal debounce, creates incidents,
    and updates the job status.
    """
    db = SessionLocal()
    job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
    if not job:
        db.close()
        return

    generated_incident_ids: List[str] = []
    debounce = DebounceTracker(window_size=3, threshold=2)

    try:
        # Check if OpenCV is available
        if cv2 is None:
            raise RuntimeError("OpenCV (cv2) is not installed or available.")

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise RuntimeError(f"Unable to open video file at {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 100)
        # Sample at ~2 FPS (every fps/2 frames)
        step = max(1, int(fps / 2))

        frame_idx = 0
        sampled_count = 0

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret or frame is None:
                break

            if frame_idx % step == 0:
                sampled_count += 1

                # 1. Run AI Inference (PPE + Fire)
                ppe_detections = run_ppe(frame)
                fire_detections = run_fire(frame)
                all_detections = ppe_detections + fire_detections

                # 2. Group detections by class type
                detected_types = {d["class_name"] for d in all_detections}

                for hazard_type in ["no_helmet", "no_vest", "fire", "smoke", "no_boots", "no_gloves"]:
                    is_present = hazard_type in detected_types
                    
                    # 3. Evaluate 2-of-3 debounce rule
                    is_confirmed = debounce.update(camera_id, hazard_type, is_present)

                    if is_confirmed and is_present:
                        # Find matching detections for this hazard
                        matching = [d for d in all_detections if d["class_name"] == hazard_type]
                        avg_conf = float(np.mean([d["confidence"] for d in matching])) if matching else 0.85

                        # Calculate severity rule per System Design §E
                        if hazard_type in ["fire", "smoke"] or avg_conf >= 0.75:
                            severity = "high"
                        elif avg_conf >= 0.50:
                            severity = "medium"
                        else:
                            severity = "low"

                        incident_id = str(uuid.uuid4())

                        # 4. Generate visual evidence snapshot
                        evidence_url = annotate_and_save_snapshot(frame, incident_id, matching)

                        # 5. Save Incident in DB
                        incident = Incident(
                            id=incident_id,
                            camera_id=camera_id,
                            incident_type=hazard_type,
                            confidence=round(avg_conf, 2),
                            severity=severity,
                            evidence_url=evidence_url,
                            status="open",
                            detected_at=datetime.utcnow(),
                        )
                        db.add(incident)

                        # 6. Save supporting Detections & Evidence
                        for det in matching:
                            detection_row = Detection(
                                incident_id=incident_id,
                                frame_index=frame_idx,
                                class_name=hazard_type,
                                confidence=det["confidence"],
                                bbox=json.dumps(det["bbox"]),
                            )
                            db.add(detection_row)

                        evidence_row = Evidence(
                            incident_id=incident_id,
                            image_path=evidence_url,
                        )
                        db.add(evidence_row)
                        db.commit()

                        generated_incident_ids.append(incident_id)

            frame_idx += 1
            # Cap processing at 300 sampled frames (2.5 mins of video) to prevent long blocks
            if sampled_count >= 300:
                break

        cap.release()

        # Update job record to DONE
        job.status = "done"
        job.incident_ids = json.dumps(generated_incident_ids)
        db.commit()
        print(f"[Pipeline] Job {job_id} completed successfully. Generated {len(generated_incident_ids)} incidents.")

    except Exception as e:
        db.rollback()
        job.status = "failed"
        job.error_message = str(e)
        db.commit()
        print(f"[Pipeline] Job {job_id} failed: {e}")
    finally:
        db.close()
