import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip, CartesianGrid } from 'recharts';
import { useTheme } from '../ThemeProvider';

interface ChartProps {
  data: Array<{ time: string; count: number }>;
}

/**
 * ActivityChart — Premium area chart with accent gradient,
 * solid grid lines, and glassmorphism tooltip.
 */
export function ActivityChart({ data }: ChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="h-64 w-full text-[12px]" style={{ fontFamily: "'Geist Sans', system-ui, sans-serif" }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={isDark ? '#EA580C' : '#C2410C'} stopOpacity={0.12}/>
              <stop offset="95%" stopColor={isDark ? '#EA580C' : '#C2410C'} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid 
            strokeDasharray="none" 
            vertical={false} 
            stroke={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(28,25,23,0.06)'} 
          />
          <XAxis 
            dataKey="time" 
            axisLine={false} 
            tickLine={false} 
            tick={{ 
              fill: isDark ? '#A8A29E' : '#78716C', 
              fontSize: 11, 
              fontWeight: 500,
            }}
            dy={10}
          />
          <Tooltip 
            contentStyle={{ 
              borderRadius: 'var(--radius-sm, 8px)', 
              border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(28,25,23,0.10)',
              boxShadow: isDark 
                ? '0 8px 32px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.25)' 
                : '0 4px 12px rgba(0,0,0,0.06)',
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: 500,
              backgroundColor: isDark ? 'rgba(28, 25, 23, 0.85)' : 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(12px)',
              color: isDark ? '#FAFAF9' : '#1C1917',
            }}
            itemStyle={{ color: isDark ? '#FAFAF9' : '#1C1917', fontWeight: 600 }}
            cursor={{ stroke: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(28,25,23,0.08)', strokeWidth: 1 }}
          />
          <Area 
            type="monotone" 
            dataKey="count" 
            stroke={isDark ? '#FAFAF9' : '#1C1917'} 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#chartGradient)"
            animationDuration={1200}
            animationEasing="ease-out"
            activeDot={{ 
              r: 5, 
              strokeWidth: 2, 
              stroke: isDark ? '#1C1917' : '#FFFFFF',
              fill: isDark ? '#EA580C' : '#C2410C', 
              filter: isDark ? 'drop-shadow(0 0 8px rgba(234,88,12,0.4))' : 'none',
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
