import type { Severity, IncidentStatus, IncidentType, CameraStatus } from '../../api/types';

interface BadgeProps {
  children: React.ReactNode;
  variant: Severity | IncidentStatus | CameraStatus | 'fire' | 'smoke';
  dot?: boolean;
}

const ICONS: Record<string, string> = {
  high: '⬆',
  medium: '●',
  low: '⬇',
  open: '◉',
  acknowledged: '✓',
  fire: '🔥',
  smoke: '💨',
  active: '●',
  inactive: '○',
  offline: '✕',
};

export function Badge({ children, variant, dot = false }: BadgeProps) {
  const cls =
    variant === 'fire' || variant === 'smoke'
      ? 'badge badge--fire'
      : `badge badge--${variant}`;

  return (
    <span className={cls}>
      {dot && <span>{ICONS[variant] ?? '●'}</span>}
      {children}
    </span>
  );
}

/** Convenience: maps IncidentType to a display label */
export function incidentTypeLabel(type: IncidentType): string {
  const map: Record<IncidentType, string> = {
    no_helmet: 'No Helmet',
    no_vest: 'No Vest',
    no_boots: 'No Boots',
    no_gloves: 'No Gloves',
    no_goggles: 'No Goggles',
    fire: 'Fire',
    smoke: 'Smoke',
  };
  return map[type] ?? type;
}

/** Maps incident type to an emoji icon */
export function incidentTypeIcon(type: IncidentType): string {
  const map: Record<IncidentType, string> = {
    no_helmet: '⛑️',
    no_vest: '🦺',
    no_boots: '👟',
    no_gloves: '🧤',
    no_goggles: '🥽',
    fire: '🔥',
    smoke: '💨',
  };
  return map[type] ?? '⚠️';
}
