from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from backend.db import get_db
from backend.models import Incident, Camera, Zone
from backend.schemas import IncidentResponse, AckRequest, AckResponse

router = APIRouter(prefix="/incidents", tags=["Incidents"])

def build_incident_response(inc: Incident) -> IncidentResponse:
    zone_name = "Unknown Zone"
    if inc.camera and inc.camera.zone:
        zone_name = inc.camera.zone.name

    return IncidentResponse(
        id=inc.id,
        incident_type=inc.incident_type,
        zone=zone_name,
        camera_id=inc.camera_id,
        severity=inc.severity,
        confidence=inc.confidence,
        evidence_url=inc.evidence_url,
        status=inc.status,
        detected_at=inc.detected_at.isoformat() if inc.detected_at else datetime.utcnow().isoformat(),
        acked_by=inc.acked_by,
        acked_at=inc.acked_at.isoformat() if inc.acked_at else None,
    )

@router.get("", response_model=List[IncidentResponse])
def list_incidents(
    zone: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Returns list of all incidents ordered by detected_at DESC.
    Accepts optional filters for zone, type, and status.
    """
    query = db.query(Incident).join(Camera).join(Zone)

    if zone:
        query = query.filter(Zone.id == zone)
    if type:
        query = query.filter(Incident.incident_type == type)
    if status:
        query = query.filter(Incident.status == status)

    incidents = query.order_by(Incident.detected_at.desc()).all()
    return [build_incident_response(inc) for inc in incidents]

@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident(incident_id: str, db: Session = Depends(get_db)):
    """Returns single incident detail."""
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    return build_incident_response(inc)

@router.post("/{incident_id}/ack", response_model=IncidentResponse)
def acknowledge_incident(
    incident_id: str,
    payload: Optional[AckRequest] = None,
    db: Session = Depends(get_db)
):
    """Marks an incident as acknowledged and returns the updated incident."""
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    inc.status = "acknowledged"
    inc.acked_by = payload.acked_by if payload and payload.acked_by else "Safety Officer"
    inc.acked_at = datetime.utcnow()
    db.commit()
    db.refresh(inc)

    return build_incident_response(inc)
