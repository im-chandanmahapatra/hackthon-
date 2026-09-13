/**
 * ============================================================
 * Argus — Real API Client
 * ============================================================
 * Pure live data communication layer connecting frontend to 
 * the local FastAPI backend (http://localhost:8000).
 * All endpoints return strongly typed, validated records.
 * ============================================================
 */

import type {
  Incident,
  IncidentFilters,
  UploadResponse,
  JobStatusResponse,
  AckResponse,
  CamerasResponse,
} from './types';

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

// ─── INTERNAL HELPERS ─────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`[${res.status}] ${text}`);
  }
  return res.json() as Promise<T>;
}

function formatIncident(inc: Incident): Incident {
  return {
    ...inc,
    evidence_url: inc.evidence_url && inc.evidence_url.startsWith('/')
      ? `${API_BASE}${inc.evidence_url}`
      : inc.evidence_url,
  };
}

// ─── PUBLIC API FUNCTIONS ─────────────────────────────────────────────────────

/**
 * POST /demo/upload
 * Uploads real video footage to the spatial processing pipeline.
 */
export async function uploadVideo(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/demo/upload`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Upload failed [${res.status}]`);
  return res.json();
}

/**
 * GET /demo/status/:job_id
 * Polls real-time video inference and frame processing status.
 */
export async function getJobStatus(job_id: string): Promise<JobStatusResponse> {
  return apiFetch<JobStatusResponse>(`/demo/status/${job_id}`);
}

/**
 * GET /incidents
 * Retrieves actual incidents from SQLite / PostgreSQL database.
 * Optional filters: zone, type, status.
 */
export async function getIncidents(filters?: IncidentFilters): Promise<Incident[]> {
  const params = new URLSearchParams();
  if (filters?.zone)   params.set('zone', filters.zone);
  if (filters?.type)   params.set('type', filters.type!);
  if (filters?.status) params.set('status', filters.status);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const incidents = await apiFetch<Incident[]>(`/incidents${qs}`);
  return incidents.map(formatIncident);
}

/**
 * GET /incidents/:id
 * Fetches single incident record with associated evidence visual path.
 */
export async function getIncident(id: string): Promise<Incident> {
  const inc = await apiFetch<Incident>(`/incidents/${id}`);
  return formatIncident(inc);
}

/**
 * POST /incidents/:id/ack
 * Commits real safety acknowledgment to database with timestamp and officer attribution.
 */
export async function ackIncident(id: string): Promise<AckResponse> {
  const inc = await apiFetch<Incident>(`/incidents/${id}/ack`, { method: 'POST' });
  return formatIncident(inc);
}

/**
 * GET /cameras
 * Returns all active edge surveillance cameras and their physical zones.
 */
export async function getCameras(): Promise<CamerasResponse> {
  return apiFetch<CamerasResponse>('/cameras');
}
