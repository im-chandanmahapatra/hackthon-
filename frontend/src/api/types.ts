/**
 * ============================================================
 * Argus — Shared API Types
 * ============================================================
 * SINGLE SOURCE OF TRUTH for data shapes between frontend & backend.
 *
 * Backend team (P2): Match these interfaces exactly in your
 *   FastAPI Pydantic schemas and API response shapes.
 *
 * Frontend team (P3): Import from here — never define inline types
 *   for API data.
 *
 * Reference: 02_SYSTEM_DESIGN.md §D (API Contracts)
 * ============================================================
 */

// ------------------------------------
// Enums / Union Types
// ------------------------------------

export type IncidentType =
  | 'no_helmet'
  | 'no_vest'
  | 'no_boots'
  | 'no_gloves'
  | 'no_goggles'
  | 'fire'
  | 'smoke';

export type Severity = 'high' | 'medium' | 'low';

/** confidence >= 0.75 → "high" | 0.5–0.75 → "medium" (per System Design §E) */
export type IncidentStatus = 'open' | 'acknowledged';

export type CameraStatus = 'active' | 'inactive' | 'offline';

export type JobStatus = 'processing' | 'done' | 'failed';

// ------------------------------------
// Core Domain Types
// ------------------------------------

export interface Zone {
  id: string;
  name: string;
  floor_area?: string;
}

export interface Camera {
  id: string;
  zone_id: string;
  zone_name: string; // Derived via join — backend includes this in GET /cameras
  label: string;
  status: CameraStatus;
  stream_url?: string;
}

/**
 * Incident shape returned by GET /incidents and GET /incidents/:id
 * Backend derives `zone` via camera→zone join; frontend never sees raw camera→zone mapping.
 */
export interface Incident {
  id: string;
  incident_type: IncidentType;
  zone: string;                   // Human-readable zone name (e.g. "Zone A - Assembly Floor")
  camera_id: string;
  severity: Severity;
  confidence: number;             // 0.0 – 1.0
  evidence_url: string | null;    // Relative path: /evidence/{uuid}.jpg  (null if not yet stored)
  status: IncidentStatus;
  detected_at: string;            // ISO 8601
  acked_by?: string | null;       // User name who acknowledged (null if not acked)
  acked_at?: string | null;       // ISO 8601 (null if not acked)
}

// ------------------------------------
// API Request / Response Shapes
// ------------------------------------

/**
 * POST /demo/upload → returns job_id to poll
 */
export interface UploadResponse {
  job_id: string;
}

/**
 * GET /demo/status/:job_id
 * incident_ids populated only when status === 'done'
 */
export interface JobStatusResponse {
  job_id: string;
  status: JobStatus;
  incident_ids: string[];
  error_message?: string | null;  // Populated when status === 'failed'
}

/**
 * GET /incidents — optional query params
 */
export interface IncidentFilters {
  zone?: string;
  type?: IncidentType;
  status?: IncidentStatus;
}

/**
 * POST /incidents/:id/ack → returns updated incident
 */
export type AckResponse = Incident;

/**
 * GET /cameras
 */
export type CamerasResponse = Camera[];
