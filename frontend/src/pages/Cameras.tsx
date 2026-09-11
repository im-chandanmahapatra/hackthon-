import { useCallback } from 'react';
import { getCameras } from '../api/client';
import type { Camera } from '../api/types';
import { usePolling } from '../hooks/usePolling';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { PageSpinner } from '../components/ui/Spinner';

export default function Cameras() {
  const fetcher = useCallback(() => getCameras(), []);
  const { data: cameras, error, loading, refresh } = usePolling<Camera[]>(fetcher, 30000);

  // Group by zone
  const byZone = cameras?.reduce<Record<string, Camera[]>>((acc, cam) => {
    const zone = cam.zone_name;
    if (!acc[zone]) acc[zone] = [];
    acc[zone].push(cam);
    return acc;
  }, {});

  const totalActive = cameras?.filter((c) => c.status === 'active').length ?? 0;

  return (
    <div className="fade-in">
      {/* ── Header ── */}
      <div className="page-header">
        <div className="page-header__title">
          <h1>Cameras &amp; Zones</h1>
          <span className="page-header__subtitle">
            Read-only · seeded configuration · {cameras ? `${cameras.length} cameras, ${totalActive} active` : '—'}
          </span>
        </div>
        <button
          className="btn btn--ghost btn--sm"
          onClick={refresh}
          aria-label="Refresh camera list"
          id="refresh-cameras-btn"
        >
          ↻ Refresh
        </button>
      </div>

      {/* ── Summary cards ── */}
      {cameras && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
          {[
            { label: 'Total Cameras', value: cameras.length, emoji: '📷', color: 'var(--text-primary)' },
            { label: 'Active', value: cameras.filter(c => c.status === 'active').length, emoji: '🟢', color: 'var(--color-safe)' },
            { label: 'Zones', value: Object.keys(byZone ?? {}).length, emoji: '📍', color: 'var(--accent-amber)' },
          ].map(({ label, value, emoji, color }) => (
            <div key={label} className="card" style={{ padding: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
              <span style={{ fontSize: '1.75rem' }}>{emoji}</span>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── States ── */}
      {loading && !cameras && <PageSpinner label="Loading cameras…" />}
      {error && <ErrorState message={`Could not load cameras: ${error}`} onRetry={refresh} />}
      {!loading && !error && cameras?.length === 0 && (
        <EmptyState
          icon="📷"
          title="No cameras configured"
          description="Camera and zone data is seeded manually. Check with your backend team (P2) to seed the database."
        />
      )}

      {/* ── Zone groups ── */}
      {byZone && Object.entries(byZone).map(([zoneName, cams]) => (
        <div key={zoneName} style={{ marginBottom: 'var(--space-6)' }}>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
              marginBottom: 'var(--space-4)',
            }}
          >
            <span style={{ fontSize: '1rem' }}>📍</span>
            <h3 style={{ color: 'var(--text-primary)' }}>{zoneName}</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              {cams.length} camera{cams.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="table-wrap">
            <table aria-label={`Cameras in ${zoneName}`}>
              <thead>
                <tr>
                  <th>Camera ID</th>
                  <th>Label</th>
                  <th>Zone</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {cams.map((cam) => (
                  <tr key={cam.id}>
                    <td>
                      <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                        {cam.id}
                      </code>
                    </td>
                    <td style={{ fontWeight: 500 }}>{cam.label}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{cam.zone_name}</td>
                    <td>
                      <Badge variant={cam.status} dot>{cam.status.charAt(0).toUpperCase() + cam.status.slice(1)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* ── MVP note ── */}
      {cameras && cameras.length > 0 && (
        <div
          style={{
            marginTop: 'var(--space-6)', padding: 'var(--space-4)',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(59,130,246,0.06)',
            border: '1px solid rgba(59,130,246,0.15)',
            fontSize: '0.8125rem', color: 'var(--text-muted)',
            display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)',
          }}
        >
          <span>ℹ️</span>
          <span>
            <strong style={{ color: 'var(--text-secondary)' }}>MVP — read-only view.</strong>{' '}
            Camera and zone data is seeded via{' '}
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>scripts/seed_db.py</code>.
            CRUD management is deferred to post-MVP.
          </span>
        </div>
      )}
    </div>
  );
}
