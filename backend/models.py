import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.db import Base

class Zone(Base):
    __tablename__ = "zones"

    id = Column(String(50), primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    floor_area = Column(String(50), nullable=True)

    cameras = relationship("Camera", back_populates="zone", cascade="all, delete-orphan")


class Camera(Base):
    __tablename__ = "cameras"

    id = Column(String(50), primary_key=True, index=True)
    zone_id = Column(String(50), ForeignKey("zones.id"), nullable=False)
    label = Column(String(100), nullable=False)
    status = Column(String(20), default="active")  # 'active' | 'inactive' | 'offline'

    zone = relationship("Zone", back_populates="cameras")
    incidents = relationship("Incident", back_populates="camera")


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    camera_id = Column(String(50), ForeignKey("cameras.id"), nullable=False, index=True)
    incident_type = Column(String(50), nullable=False, index=True)  # 'no_helmet', 'no_vest', 'fire', 'smoke', etc.
    confidence = Column(Float, nullable=False)  # 0.0 - 1.0
    severity = Column(String(20), nullable=False)  # 'high', 'medium', 'low'
    evidence_url = Column(String(255), nullable=True)  # e.g. /evidence/{id}.jpg
    status = Column(String(20), default="open", index=True)  # 'open' | 'acknowledged'
    detected_at = Column(DateTime, default=datetime.utcnow, index=True)
    acked_by = Column(String(100), nullable=True)
    acked_at = Column(DateTime, nullable=True)

    camera = relationship("Camera", back_populates="incidents")
    detections = relationship("Detection", back_populates="incident", cascade="all, delete-orphan")
    evidence_items = relationship("Evidence", back_populates="incident", cascade="all, delete-orphan")


class Detection(Base):
    __tablename__ = "detections"

    id = Column(Integer, primary_key=True, autoincrement=True)
    incident_id = Column(String(36), ForeignKey("incidents.id"), nullable=False, index=True)
    frame_index = Column(Integer, nullable=False)
    class_name = Column(String(50), nullable=False)
    confidence = Column(Float, nullable=False)
    bbox = Column(Text, nullable=False)  # JSON array: [x1, y1, x2, y2]

    incident = relationship("Incident", back_populates="detections")


class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(Integer, primary_key=True, autoincrement=True)
    incident_id = Column(String(36), ForeignKey("incidents.id"), nullable=False, index=True)
    image_path = Column(String(255), nullable=False)

    incident = relationship("Incident", back_populates="evidence_items")


class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    video_filename = Column(String(255), nullable=False)
    status = Column(String(20), default="processing")  # 'processing' | 'done' | 'failed'
    incident_ids = Column(Text, default="[]")  # JSON string array
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
