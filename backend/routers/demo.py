import os
import json
import uuid
import numpy as np

try:
    import cv2
except ImportError:
    cv2 = None

from fastapi import APIRouter, Depends, UploadFile, File, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from backend.db import get_db
from backend.models import ProcessingJob
from backend.schemas import UploadResponse, JobStatusResponse
from backend.config import settings
from backend.services.pipeline import process_video_background
from ml.inference_wrapper import infer_frame

router = APIRouter(prefix="/demo", tags=["Demo & Upload"])

ALLOWED_EXTENSIONS = {".mp4", ".mov", ".webm", ".avi", ".mkv"}

@router.post("/upload", response_model=UploadResponse)
async def upload_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Accepts video file upload, generates a tracking job_id,
    and initiates asynchronous frame extraction and AI inference.
    """
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    job_id = str(uuid.uuid4())
    safe_filename = f"{job_id}{ext}"
    target_file_path = settings.UPLOAD_DIR / safe_filename

    # Stream video to disk
    contents = await file.read()
    with open(target_file_path, "wb") as f:
        f.write(contents)

    # Persist job record
    job = ProcessingJob(
        id=job_id,
        video_filename=safe_filename,
        status="processing",
        incident_ids="[]",
    )
    db.add(job)
    db.commit()

    # Enqueue background processing worker
    background_tasks.add_task(process_video_background, job_id, str(target_file_path))

    return UploadResponse(job_id=job_id)

@router.get("/status/{job_id}", response_model=JobStatusResponse)
def get_job_status(job_id: str, db: Session = Depends(get_db)):
    """Polls processing progress for an uploaded video."""
    job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    incident_ids = []
    try:
        incident_ids = json.loads(job.incident_ids) if job.incident_ids else []
    except Exception:
        pass

    return JobStatusResponse(
        job_id=job.id,
        status=job.status,
        incident_ids=incident_ids,
        error_message=job.error_message,
    )

import time

@router.post("/infer-frame")
async def infer_single_frame(file: UploadFile = File(...)):
    """
    Real-time single frame AI inference endpoint for live video viewport.
    Decodes the frame and runs YOLO person, PPE, and fire detection.
    """
    if cv2 is None:
        raise HTTPException(status_code=500, detail="OpenCV not installed on server.")

    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if frame is None:
        raise HTTPException(status_code=400, detail="Invalid image frame data.")

    t0 = time.perf_counter()
    result = infer_frame(frame)
    latency_ms = round((time.perf_counter() - t0) * 1000, 1)

    detections = result.get("detections", [])
    workers = [d for d in detections if d.get("class_name") == "worker"]
    violations = [d for d in detections if d.get("is_violation")]
    compliance_items = [d for d in detections if d.get("class_name") in ["helmet", "vest"]]
    
    compliance_pct = 100
    total_checks = len(compliance_items) + len([v for v in violations if v.get("class_name") in ["no_helmet", "no_vest"]])
    if total_checks > 0:
        compliant_count = len(compliance_items)
        compliance_pct = round((compliant_count / total_checks) * 100)

    confidences = [d.get("confidence", 0) for d in detections if "confidence" in d]
    avg_conf = round(float(np.mean(confidences)) * 100, 1) if confidences else 95.0

    result["latency_ms"] = latency_ms
    result["worker_count"] = len(workers)
    result["violation_count"] = len(violations)
    result["compliance_pct"] = compliance_pct
    result["mean_confidence_pct"] = avg_conf
    result["hazard_detected"] = any(d.get("class_name") in ["fire", "smoke"] for d in detections)

    return result

