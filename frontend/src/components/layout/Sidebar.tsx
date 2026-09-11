import { NavLink, useLocation } from 'react-router-dom';

interface SidebarProps {
  incidentCount?: number;
  isPollingActive?: boolean;
}

const NAV_LINKS = [
  { to: '/',        label: 'Dashboard',    icon: '⚡', end: true },
  { to: '/upload',  label: 'Upload Video', icon: '📹', end: false },
  { to: '/cameras', label: 'Cameras',      icon: '📷', end: false },
];

export function Sidebar({ incidentCount = 0, isPollingActive = false }: SidebarProps) {
  const location = useLocation();

  return (
    <nav
      aria-label="Main navigation"
      style={{
        width: 'var(--sidebar-width)',
        minWidth: 'var(--sidebar-width)',
        height: '100vh',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        overflowY: 'auto',
      }}
    >
      {/* ── Logo ─────────────────────────────────────── */}
      <div
        style={{
          padding: 'var(--space-6)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
        }}
      >
        <div
          style={{
            width: 36, height: 36, borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.1rem', flexShrink: 0,
            boxShadow: '0 0 12px rgba(245,158,11,0.3)',
          }}
        >
          👁️
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '0.9375rem', letterSpacing: '-0.01em', lineHeight: 1.1 }}>
            SentinelView
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 500, marginTop: 2 }}>
            Safety Compliance AI
          </div>
        </div>
      </div>

      {/* ── Polling indicator ─────────────────────────── */}
      <div
        style={{
          margin: 'var(--space-4) var(--space-4) 0',
          padding: 'var(--space-2) var(--space-3)',
          borderRadius: 'var(--radius-md)',
          background: isPollingActive
            ? 'rgba(16,185,129,0.08)'
            : 'rgba(107,114,128,0.08)',
          border: `1px solid ${isPollingActive ? 'rgba(16,185,129,0.2)' : 'rgba(107,114,128,0.15)'}`,
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          fontSize: '0.75rem',
          color: isPollingActive ? '#6ee7b7' : 'var(--text-muted)',
          fontWeight: 500,
          transition: 'all var(--transition-base)',
        }}
      >
        <span
          className={isPollingActive ? 'pulse-dot' : undefined}
          style={!isPollingActive ? { width: 8, height: 8, borderRadius: '50%', background: 'var(--text-muted)' } : undefined}
        />
        {isPollingActive ? 'Live monitoring' : 'Standby'}
      </div>

      {/* ── Nav links ──────────────────────────────────── */}
      <div style={{ flex: 1, padding: 'var(--space-4)' }}>
        <div
          style={{
            fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            padding: 'var(--space-2) var(--space-2)', marginBottom: 'var(--space-1)',
          }}
        >
          Navigation
        </div>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_LINKS.map(({ to, label, icon, end }) => {
            const isActive = end
              ? location.pathname === to
              : location.pathname.startsWith(to);

            return (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  aria-current={isActive ? 'page' : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem', fontWeight: isActive ? 600 : 500,
                    color: isActive ? 'var(--accent-amber)' : 'var(--text-secondary)',
                    background: isActive ? 'rgba(245,158,11,0.08)' : 'transparent',
                    border: `1px solid ${isActive ? 'rgba(245,158,11,0.2)' : 'transparent'}`,
                    transition: 'all var(--transition-fast)',
                    textDecoration: 'none',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span>{icon}</span>
                    <span>{label}</span>
                  </span>
                  {label === 'Dashboard' && incidentCount > 0 && (
                    <span
                      style={{
                        background: 'var(--color-critical)',
                        color: '#fff',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-full)',
                        minWidth: 20,
                        textAlign: 'center',
                        lineHeight: 1.4,
                      }}
                    >
                      {incidentCount}
                    </span>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ── Footer ────────────────────────────────────── */}
      <div
        style={{
          padding: 'var(--space-4) var(--space-6)',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '0.6875rem',
          color: 'var(--text-muted)',
          lineHeight: 1.6,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 2 }}>MVP — PS06 Hackathon</div>
        <div>Single-stream, polling mode</div>
      </div>
    </nav>
  );
}
