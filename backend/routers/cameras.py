from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.db import get_db
from backend.models import Camera, Zone
from backend.schemas import CameraResponse

router = APIRouter(prefix="/cameras", tags=["Cameras"])

@router.get("", response_model=List[CameraResponse])
def list_cameras(db: Session = Depends(get_db)):
    """Returns all registered CCTV / spatial cameras along with their zone details."""
    cameras = db.query(Camera).join(Zone).all()
    results = []
    for cam in cameras:
        # Link real CCTV surveillance recording for active conveyor stream
        stream_url = "/uploads/3fcef4ee-a632-429a-85e3-f8a14e289a35.mp4" if cam.id in ["cam-01", "cam-02"] else None
        results.append(CameraResponse(
            id=cam.id,
            zone_id=cam.zone_id,
            zone_name=cam.zone.name if cam.zone else "Default Zone",
            label=cam.label,
            status=cam.status,
            stream_url=stream_url,
        ))
    return results
