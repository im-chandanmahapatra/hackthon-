/**
 * ============================================================
 * SentinelView — Mock Data Fixtures
 * ============================================================
 * Realistic mock data for frontend development (P3) before
 * the real backend (P2) is ready.
 *
 * Mirror the exact JSON shapes from 02_SYSTEM_DESIGN.md §D.
 * ============================================================
 */

import type {
  Incident,
  Camera,
  JobStatusResponse,
  IncidentType,
  Severity,
} from './types';

// ------------------------------------
// Helper: deterministic timestamp offsets from "now"
// ------------------------------------
const ago = (minutes: number): string =>
  new Date(Date.now() - minutes * 60 * 1000).toISOString();

// ------------------------------------
// Mock Incidents
// ------------------------------------
export const MOCK_INCIDENTS: Incident[] = [
  {
    id: 'inc-001',
    incident_type: 'no_helmet' as IncidentType,
    zone: 'Zone A — Assembly Floor',
    camera_id: 'cam-01',
    severity: 'high' as Severity,
    confidence: 0.87,
    evidence_url: null,           // Snapshot not yet available in mock
    status: 'open',
    detected_at: ago(3),
    acked_by: null,
    acked_at: null,
  },
  {
    id: 'inc-002',
    incident_type: 'fire' as IncidentType,
    zone: 'Zone B — Storage Bay',
    camera_id: 'cam-03',
    severity: 'high' as Severity,
    confidence: 0.92,
    evidence_url: null,
    status: 'open',
    detected_at: ago(8),
    acked_by: null,
    acked_at: null,
  },
  {
    id: 'inc-003',
    incident_type: 'no_vest' as IncidentType,
    zone: 'Zone A — Assembly Floor',
    camera_id: 'cam-02',
    severity: 'medium' as Severity,
    confidence: 0.63,
    evidence_url: null,
    status: 'acknowledged',
    detected_at: ago(22),
    acked_by: 'Safety Officer',
    acked_at: ago(15),
  },
  {
    id: 'inc-004',
    incident_type: 'smoke' as IncidentType,
    zone: 'Zone C — Welding Station',
    camera_id: 'cam-05',
    severity: 'high' as Severity,
    confidence: 0.78,
    evidence_url: null,
    status: 'open',
    detected_at: ago(1),
    acked_by: null,
    acked_at: null,
  },
  {
    id: 'inc-005',
    incident_type: 'no_gloves' as IncidentType,
    zone: 'Zone C — Welding Station',
    camera_id: 'cam-04',
    severity: 'medium' as Severity,
    confidence: 0.58,
    evidence_url: null,
    status: 'acknowledged',
    detected_at: ago(45),
    acked_by: 'Safety Officer',
    acked_at: ago(30),
  },
];

// ------------------------------------
// Mock Cameras
// ------------------------------------
export const MOCK_CAMERAS: Camera[] = [
  { id: 'cam-01', zone_id: 'zone-a', zone_name: 'Zone A — Assembly Floor', label: 'CAM-01 (North)', status: 'active' },
  { id: 'cam-02', zone_id: 'zone-a', zone_name: 'Zone A — Assembly Floor', label: 'CAM-02 (South)', status: 'active' },
  { id: 'cam-03', zone_id: 'zone-b', zone_name: 'Zone B — Storage Bay',    label: 'CAM-03 (Main)',  status: 'active' },
  { id: 'cam-04', zone_id: 'zone-c', zone_name: 'Zone C — Welding Station', label: 'CAM-04 (East)', status: 'inactive' },
  { id: 'cam-05', zone_id: 'zone-c', zone_name: 'Zone C — Welding Station', label: 'CAM-05 (West)', status: 'active' },
];

// ------------------------------------
// Mock Job Status — simulates progression
// ------------------------------------
const JOB_START_TIME: Record<string, number> = {};

export function getMockJobStatus(job_id: string): JobStatusResponse {
  if (!JOB_START_TIME[job_id]) {
    JOB_START_TIME[job_id] = Date.now();
  }
  const elapsed = (Date.now() - JOB_START_TIME[job_id]) / 1000; // seconds

  if (elapsed < 4) {
    return { job_id, status: 'processing', incident_ids: [] };
  }
  return {
    job_id,
    status: 'done',
    incident_ids: ['inc-001', 'inc-002'],
  };
}
