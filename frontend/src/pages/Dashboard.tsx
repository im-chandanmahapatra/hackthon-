import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getIncidents } from '../api/client';
import type { Incident, IncidentFilters, IncidentType, Severity } from '../api/types';
import { usePolling } from '../hooks/usePolling';
import { Badge, incidentTypeLabel, incidentTypeIcon } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { PageSpinner } from '../components/ui/Spinner';

const ZONES = ['All Zones', 'Zone A — Assembly Floor', 'Zone B — Storage Bay', 'Zone C — Welding Station'];
const TYPES: { label: string; value: IncidentType | '' }[] = [
  { label: 'All Types', value: '' },
  { label: 'No Helmet',  value: 'no_helmet' },
  { label: 'No Vest',    value: 'no_vest' },
  { label: 'No Boots',   value: 'no_boots' },
  { label: 'No Gloves',  value: 'no_gloves' },
  { label: 'No Goggles', value: 'no_goggles' },
  { label: 'Fire',       value: 'fire' },
  { label: 'Smoke',      value: 'smoke' },
];
const STATUSES = [
  { label: 'All Status', value: '' },
  { label: 'Open', value: 'open' },
  { label: 'Acknowledged', value: 'acknowledged' },
];

function formatRelativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  return `${Math.round(diff / 3600)}h ago`;
}

function IncidentCard({ incident, onClick }: { incident: Incident; onClick: () => void }) {
  const isOpen = incident.status === 'open';
  const isCritical = incident.severity === 'high';

  return (
    <div
      className="card card--clickable fade-in"
      onClick={onClick}
      id={`incident-card-${incident.id}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      aria-label={`Incident: ${incidentTypeLabel(incident.incident_type)} in ${incident.zone}`}
      style={{
        borderColor: isCritical && isOpen
          ? 'rgba(239,68,68,0.25)'
          : 'var(--border-subtle)',
        boxShadow: isCritical && isOpen ? 'var(--shadow-glow-red)' : 'var(--shadow-sm)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
        {/* Left: icon + type + zone */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1, minWidth: 0 }}>
          <div
            style={{
              width: 44, height: 44, borderRadius: 'var(--radius-md)',
              background: isCritical ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.25rem', flexShrink: 0,
            }}
          >
            {incidentTypeIcon(incident.incident_type)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: 4 }}>
              {incidentTypeLabel(incident.incident_type)}
            </div>
            <div style={{
              fontSize: '0.8125rem', color: 'var(--text-muted)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              📍 {incident.zone}
            </div>
          </div>
        </div>

        {/* Right: badges + time */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--space-2)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Badge variant={incident.severity as Severity} dot>{incident.severity.toUpperCase()}</Badge>
            <Badge variant={incident.status} dot>{incident.status === 'acknowledged' ? 'Acked' : 'Open'}</Badge>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {Math.round(incident.confidence * 100)}% · {formatRelativeTime(incident.detected_at)}
          </div>
        </div>
      </div>

      {/* Confidence bar */}
      <div style={{ marginTop: 'var(--space-4)' }}>
        <div className="confidence-bar-wrap">
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', minWidth: 60 }}>Confidence</div>
          <div className="confidence-bar-track">
            <div
              className={`confidence-bar-fill confidence-bar-fill--${incident.severity}`}
              style={{ width: `${incident.confidence * 100}%` }}
            />
          </div>
          <div className={`confidence-label`} style={{ color: isCritical ? 'var(--color-critical)' : 'var(--accent-amber)' }}>
            {Math.round(incident.confidence * 100)}%
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<IncidentFilters>({});

  const fetcher = useCallback(() => getIncidents(filters), [filters]);
  const { data: incidents, error, loading, isActive, refresh } = usePolling<Incident[]>(
    fetcher,
    3000,
  );

  const openCount = incidents?.filter((i) => i.status === 'open').length ?? 0;

  return (
    <div className="fade-in">
      {/* ── Header ── */}
      <div className="page-header">
        <div className="page-header__title">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <h1>Dashboard</h1>
            {openCount > 0 && (
              <span
                style={{
                  background: 'var(--color-critical)',
                  color: '#fff',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.8125rem', fontWeight: 700,
                  padding: '2px 10px',
                  animation: 'pulse-dot 2s ease-in-out infinite',
                }}
              >
                {openCount} open
              </span>
            )}
          </div>
          <span className="page-header__subtitle">
            Incident feed · refreshes every 3s
          </span>
        </div>

        {/* Live indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          <span className={isActive ? 'pulse-dot' : undefined} style={!isActive ? { width: 8, height: 8, borderRadius: '50%', background: 'var(--text-muted)' } : undefined} />
          {isActive ? 'Live' : 'Paused'}
          <button
            className="btn btn--ghost btn--sm"
            onClick={refresh}
            style={{ marginLeft: 'var(--space-2)' }}
            aria-label="Refresh incidents"
            id="refresh-btn"
          >
            ↻
          </button>
        </div>
      </div>

      {/* ── Summary Stats ── */}
      {incidents && incidents.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
          {[
            { label: 'Total', value: incidents.length, color: 'var(--text-primary)' },
            { label: 'Open', value: incidents.filter(i => i.status === 'open').length, color: 'var(--color-critical)' },
            { label: 'High Severity', value: incidents.filter(i => i.severity === 'high').length, color: 'var(--color-high)' },
            { label: 'Acknowledged', value: incidents.filter(i => i.status === 'acknowledged').length, color: 'var(--color-safe)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'var(--space-1)', fontWeight: 500 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Filters ── */}
      <div
        style={{
          display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-6)',
          flexWrap: 'wrap', alignItems: 'center',
        }}
      >
        <select
          className="form-select"
          id="filter-zone"
          value={filters.zone ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, zone: e.target.value || undefined }))}
          aria-label="Filter by zone"
        >
          {ZONES.map((z) => (
            <option key={z} value={z === 'All Zones' ? '' : z}>{z}</option>
          ))}
        </select>

        <select
          className="form-select"
          id="filter-type"
          value={filters.type ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, type: (e.target.value as IncidentType) || undefined }))}
          aria-label="Filter by type"
        >
          {TYPES.map(({ label, value }) => (
            <option key={label} value={value}>{label}</option>
          ))}
        </select>

        <select
          className="form-select"
          id="filter-status"
          value={filters.status ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, status: (e.target.value as 'open' | 'acknowledged') || undefined }))}
          aria-label="Filter by status"
        >
          {STATUSES.map(({ label, value }) => (
            <option key={label} value={value}>{label}</option>
          ))}
        </select>

        {(filters.zone || filters.type || filters.status) && (
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => setFilters({})}
            id="clear-filters-btn"
          >
            ✕ Clear filters
          </button>
        )}
      </div>

      {/* ── Content ── */}
      {loading && !incidents && <PageSpinner label="Loading incidents…" />}
      {error && <ErrorState message={`Could not reach the API: ${error}`} onRetry={refresh} />}

      {!loading && !error && incidents?.length === 0 && (
        <EmptyState
          icon="🛡️"
          title="No incidents detected"
          description="No PPE violations or fire/smoke events match your current filters. Upload a video to start detection."
          action={
            <button className="btn btn--primary" onClick={() => navigate('/upload')} id="upload-cta-btn">
              Upload Video
            </button>
          }
        />
      )}

      {incidents && incidents.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 'var(--space-4)' }}>
          {incidents.map((inc) => (
            <IncidentCard
              key={inc.id}
              incident={inc}
              onClick={() => navigate(`/incidents/${inc.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
