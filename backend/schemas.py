from typing import Optional, List, Literal
from datetime import datetime
from pydantic import BaseModel, Field

IncidentType = Literal[
    'no_helmet',
    'no_vest',
    'no_boots',
    'no_gloves',
    'no_goggles',
    'fire',
    'smoke'
]

Severity = Literal['high', 'medium', 'low']
IncidentStatus = Literal['open', 'acknowledged']
CameraStatus = Literal['active', 'inactive', 'offline']
JobStatus = Literal['processing', 'done', 'failed']

class ZoneResponse(BaseModel):
    id: str
    name: str
    floor_area: Optional[str] = None

    class Config:
        from_attributes = True

class CameraResponse(BaseModel):
    id: str
    zone_id: str
    zone_name: str
    label: str
    status: CameraStatus
    stream_url: Optional[str] = None

    class Config:
        from_attributes = True

class IncidentResponse(BaseModel):
    id: str
    incident_type: IncidentType
    zone: str
    camera_id: str
    severity: Severity
    confidence: float
    evidence_url: Optional[str] = None
    status: IncidentStatus
    detected_at: str
    acked_by: Optional[str] = None
    acked_at: Optional[str] = None

    class Config:
        from_attributes = True

class UploadResponse(BaseModel):
    job_id: str

class JobStatusResponse(BaseModel):
    job_id: str
    status: JobStatus
    incident_ids: List[str] = Field(default_factory=list)
    error_message: Optional[str] = None

class AckRequest(BaseModel):
    acked_by: Optional[str] = "Safety Officer"

class AckResponse(BaseModel):
    success: bool
    incident: IncidentResponse
