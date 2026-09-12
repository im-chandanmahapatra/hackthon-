/**
 * ============================================================
 * Argus — API Client
 * ============================================================
 *
 * HOW TO SWITCH FROM MOCK → REAL BACKEND:
 *   1. Set USE_MOCK = false  (line below)
 *   2. Ensure VITE_API_BASE_URL is set in your .env:
 *        VITE_API_BASE_URL=http://localhost:8000
 *   3. No changes needed anywhere else in the app.
 *
 * All functions return typed Promises.
 * Error responses are thrown as Error with a descriptive message.
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
import {
  MOCK_INCIDENTS,
  MOCK_CAMERAS,
  getMockJobStatus,
} from './mockData';

// ─── CONFIGURATION ────────────────────────────────────────────────────────────

/**
 * Flip this to false when the real backend (P2) endpoints are live.
 */
export const USE_MOCK = true;

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

// ─── INTERNAL HELPERS ─────────────────────────────────────────────────────────

/** Simulate a network delay in mock mode so UX states are visible during dev */
const mockDelay = (ms = 400) => new Promise((res) => setTimeout(res, ms));

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

// ─── PUBLIC API FUNCTIONS ─────────────────────────────────────────────────────

/**
 * POST /demo/upload
 * Uploads a video file and returns a job_id for polling.
 */
export async function uploadVideo(file: File): Promise<UploadResponse> {
  if (USE_MOCK) {
    await mockDelay(600);
    return { job_id: `mock-job-${Date.now()}` };
  }
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/demo/upload`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Upload failed [${res.status}]`);
  return res.json();
}

/**
 * GET /demo/status/:job_id
 * Poll this every ~2s until status === 'done' | 'failed'.
 */
export async function getJobStatus(job_id: string): Promise<JobStatusResponse> {
  if (USE_MOCK) {
    await mockDelay(300);
    return getMockJobStatus(job_id);
  }
  return apiFetch<JobStatusResponse>(`/demo/status/${job_id}`);
}

/**
 * GET /incidents
 * Optional filters: zone, type, status
 */
export async function getIncidents(filters?: IncidentFilters): Promise<Incident[]> {
  if (USE_MOCK) {
    await mockDelay(200);
    let results = [...MOCK_INCIDENTS];
    if (filters?.zone)   results = results.filter((i) => i.zone === filters.zone);
    if (filters?.type)   results = results.filter((i) => i.incident_type === filters.type);
    if (filters?.status) results = results.filter((i) => i.status === filters.status);
    return results.sort((a, b) => b.detected_at.localeCompare(a.detected_at));
  }
  const params = new URLSearchParams();
  if (filters?.zone)   params.set('zone', filters.zone);
  if (filters?.type)   params.set('type', filters.type!);
  if (filters?.status) params.set('status', filters.status);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiFetch<Incident[]>(`/incidents${qs}`);
}

/**
 * GET /incidents/:id
 */
export async function getIncident(id: string): Promise<Incident> {
  if (USE_MOCK) {
    await mockDelay(200);
    const found = MOCK_INCIDENTS.find((i) => i.id === id);
    if (!found) throw new Error(`Incident ${id} not found`);
    return found;
  }
  return apiFetch<Incident>(`/incidents/${id}`);
}

/**
 * POST /incidents/:id/ack
 * Acknowledge an incident. Returns the updated incident.
 */
export async function ackIncident(id: string): Promise<AckResponse> {
  if (USE_MOCK) {
    await mockDelay(400);
    const found = MOCK_INCIDENTS.find((i) => i.id === id);
    if (!found) throw new Error(`Incident ${id} not found`);
    if (found.status === 'acknowledged') throw new Error('Already acknowledged');
    // Mutate mock in-place so subsequent polls reflect the change
    found.status = 'acknowledged';
    found.acked_by = 'Safety Officer';
    found.acked_at = new Date().toISOString();
    return { ...found };
  }
  return apiFetch<AckResponse>(`/incidents/${id}/ack`, { method: 'POST' });
}

/**
 * GET /cameras
 */
export async function getCameras(): Promise<CamerasResponse> {
  if (USE_MOCK) {
    await mockDelay(200);
    return MOCK_CAMERAS;
  }
  return apiFetch<CamerasResponse>('/cameras');
}
