import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getIncident, ackIncident } from '../api/client';
import type { Incident } from '../api/types';
import { usePolling } from '../hooks/usePolling';
import { useToast } from '../hooks/useToast';
import { Badge, incidentTypeLabel, incidentTypeIcon } from '../components/ui/Badge';
import { PageSpinner } from '../components/ui/Spinner';
import { ErrorState } from '../components/ui/ErrorState';
import { ToastList } from '../components/ui/Toast';

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(iso));
}

export default function IncidentDetail() {
  const { id } = useParams<{ id: string }>();
  const { toasts, showToast, dismissToast } = useToast();

  // Optimistic ack state
  const [optimisticAcked, setOptimisticAcked] = useState(false);
  const [ackLoading, setAckLoading] = useState(false);

  const fetcher = useCallback(() => getIncident(id!), [id]);
  const { data: incident, error, loading, refresh } = usePolling<Incident>(fetcher, 5000, !optimisticAcked);

  const effectiveAcked = optimisticAcked || incident?.status === 'acknowledged';

  async function handleAck() {
    if (!incident || effectiveAcked || ackLoading) return;
    setAckLoading(true);
    // Optimistic update
    setOptimisticAcked(true);

    try {
      await ackIncident(incident.id);
      showToast('Incident acknowledged successfully', 'success');
      refresh();
    } catch (err) {
      // Rollback on failure
      setOptimisticAcked(false);
      showToast(
        err instanceof Error ? err.message : 'Failed to acknowledge. Please try again.',
        'error',
      );
    } finally {
      setAckLoading(false);
    }
  }

  if (loading) return <PageSpinner label="Loading incident…" />;
  if (error && !incident) {
    return (
      <ErrorState
        title="Incident not found"
        message={`Could not load this incident: ${error}`}
        onRetry={refresh}
      />
    );
  }
  if (!incident) return null;

  const isCritical = incident.severity === 'high';
  const confidencePct = Math.round(incident.confidence * 100);

  return (
    <div className="fade-in" style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* ── Breadcrumb ── */}
      <div style={{ marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        <Link to="/" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
          ← Dashboard
        </Link>
        <span>/</span>
        <span style={{ color: 'var(--text-primary)' }}>Incident #{incident.id.slice(-6).toUpperCase()}</span>
      </div>

      {/* ── Header ── */}
      <div className="page-header" style={{ alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <div
            style={{
              width: 56, height: 56, borderRadius: 'var(--radius-lg)',
              background: isCritical ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.10)',
              border: `1px solid ${isCritical ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.2)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.75rem', flexShrink: 0,
            }}
          >
            {incidentTypeIcon(incident.incident_type)}
          </div>
          <div>
            <h1 style={{ fontSize: '1.375rem' }}>{incidentTypeLabel(incident.incident_type)}</h1>
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
              <Badge variant={incident.severity} dot>{incident.severity.toUpperCase()}</Badge>
              <Badge variant={incident.status} dot>
                {incident.status === 'acknowledged' ? 'Acknowledged' : 'Open'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Ack button */}
        <button
          id="ack-btn"
          className={`btn btn--lg ${effectiveAcked ? 'btn--ghost' : 'btn--success'}`}
          onClick={handleAck}
          disabled={effectiveAcked || ackLoading}
          aria-label={effectiveAcked ? 'Incident already acknowledged' : 'Acknowledge this incident'}
          style={effectiveAcked ? { color: 'var(--color-safe)', borderColor: 'rgba(16,185,129,0.3)' } : {}}
        >
          {effectiveAcked ? '✓ Acknowledged' : ackLoading ? 'Acknowledging…' : '✓ Acknowledge'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        {/* ── Details card ── */}
        <div className="card" style={{ gridColumn: incident.evidence_url ? '1' : '1 / -1' }}>
          <h3 style={{ marginBottom: 'var(--space-5)', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Incident Details
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {[
              { label: 'Zone', value: incident.zone },
              { label: 'Camera', value: `Camera ${incident.camera_id}` },
              { label: 'Detected At', value: formatDateTime(incident.detected_at) },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{label}</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{value}</span>
              </div>
            ))}

            {/* Confidence bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Confidence</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, fontFamily: 'var(--font-mono)', color: isCritical ? 'var(--color-critical)' : 'var(--accent-amber)' }}>
                  {confidencePct}%
                </span>
              </div>
              <div className="confidence-bar-track">
                <div
                  className={`confidence-bar-fill confidence-bar-fill--${incident.severity}`}
                  style={{ width: `${confidencePct}%` }}
                />
              </div>
            </div>

            {/* Ack info */}
            {incident.status === 'acknowledged' && incident.acked_at && (
              <div
                style={{
                  padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
                  background: 'rgba(16,185,129,0.06)',
                  border: '1px solid rgba(16,185,129,0.15)',
                  fontSize: '0.8125rem',
                }}
              >
                <div style={{ color: 'var(--color-safe)', fontWeight: 600, marginBottom: 4 }}>
                  ✓ Acknowledged
                </div>
                <div style={{ color: 'var(--text-muted)' }}>
                  By {incident.acked_by ?? 'Unknown'} · {formatDateTime(incident.acked_at)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Evidence snapshot ── */}
        {incident.evidence_url && (
          <div className="card">
            <h3 style={{ marginBottom: 'var(--space-4)', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Evidence Snapshot
            </h3>
            <div
              style={{
                borderRadius: 'var(--radius-md)', overflow: 'hidden',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-base)',
                aspectRatio: '16/9',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <img
                src={incident.evidence_url}
                alt={`Evidence snapshot for ${incidentTypeLabel(incident.incident_type)}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).nextElementSibling?.removeAttribute('style');
                }}
              />
              <div style={{ display: 'none', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem', padding: 'var(--space-6)' }}>
                <div style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>🖼️</div>
                Snapshot not available
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Evidence placeholder (when no URL) ── */}
      {!incident.evidence_url && (
        <div
          className="card"
          style={{
            marginBottom: 'var(--space-6)',
            background: 'var(--bg-overlay)',
            display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
            padding: 'var(--space-5)',
          }}
        >
          <span style={{ fontSize: '2rem', flexShrink: 0 }}>🖼️</span>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Evidence Snapshot</div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
              Snapshot image is being processed or is unavailable for this incident.
            </p>
          </div>
        </div>
      )}

      <ToastList toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
