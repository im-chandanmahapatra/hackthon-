import { motion } from 'motion/react';
import { Camera, MapPin, RefreshCw } from 'lucide-react';
import { usePolling } from '../hooks/usePolling';
import { getCameras } from '../api/client';
import type { Camera as CameraType } from '../api/types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { PageSpinner } from '../components/ui/Spinner';
import { ErrorState } from '../components/ui/ErrorState';
import { AnimatedNumber } from '../components/ui/AnimatedNumber';

export default function Cameras() {
  const { data: cameras, error, loading, refresh } = usePolling<CameraType[]>(() => getCameras(), 30000);

  const byZone = cameras?.reduce<Record<string, CameraType[]>>((acc, cam) => {
    const zone = cam.zone_name;
    if (!acc[zone]) acc[zone] = [];
    acc[zone].push(cam);
    return acc;
  }, {});

  const totalActive = cameras?.filter(c => c.status === 'active').length ?? 0;

  if (loading && !cameras) return <PageSpinner label="Loading cameras…" />;
  if (error && !cameras) return <div className="mt-10"><ErrorState message={error.toString()} onRetry={refresh} /></div>;

  return (
    <div className="flex flex-col gap-8">
      
      {/* Header */}
      <header className="flex items-end justify-between pb-6 border-b border-subtle">
        <div>
          <h1 className="font-display text-[32px] sm:text-[34px] font-bold tracking-[-0.035em] leading-tight text-primary">
            Edge Cameras
          </h1>
          <p className="font-body text-[14px] text-secondary mt-1.5 leading-relaxed">
            Manage physical surveillance infrastructure, monitored zones, and live RTSP telemetry feeds.
          </p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-3.5 py-2 font-body text-[13px] font-medium bg-surface border border-default rounded-[var(--radius-sm)] text-secondary hover:bg-surface-hover hover:border-hover transition-all shadow-xs active:scale-[0.97]"
        >
          <RefreshCw size={13} className="text-muted" /> Refresh Feeds
        </button>
      </header>

      {/* Stats */}
      {cameras && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total Cameras', value: cameras.length },
            { label: 'Active Streams', value: totalActive },
            { label: 'Monitored Zones', value: Object.keys(byZone ?? {}).length },
          ].map((stat, i) => (
            <motion.div 
              key={stat.label} 
              initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }} 
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} 
              transition={{ type: 'spring', stiffness: 300, damping: 28, delay: i * 0.04 }}
            >
              <Card className="p-5 sm:p-6 flex flex-col gap-2" hoverable>
                <span className="font-mono text-[11px] font-semibold text-muted uppercase tracking-[0.08em]">
                  {stat.label}
                </span>
                <AnimatedNumber 
                  value={stat.value} 
                  className="font-display text-[32px] font-extrabold tracking-[-0.035em] text-primary tabular-nums" 
                />
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Data Tables by Zone */}
      {byZone && Object.entries(byZone).map(([zoneName, cams], zoneIndex) => (
        <motion.div 
          key={zoneName}
          initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ type: 'spring', stiffness: 300, damping: 28, delay: 0.1 + (zoneIndex * 0.05) }}
        >
          <div className="flex items-center gap-2.5 mb-3 px-1">
            <MapPin size={15} className="text-muted" />
            <h3 className="font-display text-[16px] font-bold tracking-[-0.015em] text-primary">
              {zoneName}
            </h3>
            <span className="font-mono text-[11px] font-semibold bg-surface border border-border-subtle text-muted px-2.5 py-0.5 rounded-full ml-1 tracking-wider uppercase">
              {cams.length} {cams.length === 1 ? 'feed' : 'feeds'}
            </span>
          </div>

          <Card className="overflow-hidden">
            <table className="w-full text-left font-body text-[13px]">
              <thead className="bg-surface/60 border-b border-subtle">
                <tr>
                  <th className="px-5 py-3 font-mono font-semibold text-muted text-[11px] uppercase tracking-[0.08em] w-36">Feed ID</th>
                  <th className="px-5 py-3 font-mono font-semibold text-muted text-[11px] uppercase tracking-[0.08em]">Camera Designation</th>
                  <th className="px-5 py-3 font-mono font-semibold text-muted text-[11px] uppercase tracking-[0.08em] w-40 text-right">Stream Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {cams.map((cam) => (
                  <tr key={cam.id} className="hover:bg-surface-hover/60 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-[12px] text-muted uppercase">{cam.id}</td>
                    <td className="px-5 py-3.5 font-display font-semibold text-primary flex items-center gap-2.5">
                      <Camera size={14} className="text-muted" /> {cam.label}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Badge variant={cam.status === 'inactive' ? 'offline' : cam.status === 'active' ? 'active' : 'offline'} dot>
                        {cam.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
