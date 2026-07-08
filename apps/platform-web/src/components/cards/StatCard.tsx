'use client';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  accent?: 'copper' | 'gold' | 'brand' | 'low' | 'medium' | 'high' | 'critical';
  icon?: React.ReactNode;
  sparkData?: number[];
}

const accentMap = {
  copper: { bar: '#F59E0B', text: 'text-copper-light' },
  gold: { bar: '#FCD34D', text: 'text-gold-light' },
  brand: { bar: '#1D4ED8', text: 'text-brand-hover' },
  low: { bar: '#22C55E', text: 'text-signal-low' },
  medium: { bar: '#EAB308', text: 'text-signal-medium' },
  high: { bar: '#F97316', text: 'text-signal-high' },
  critical: { bar: '#EF4444', text: 'text-signal-critical' },
};

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 28;
  const stepX = w / (data.length - 1);

  const points = data
    .map((v, i) => `${i * stepX},${h - ((v - min) / range) * (h - 4) - 2}`)
    .join(' ');

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="opacity-70">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StatCard({
  label,
  value,
  unit,
  trend,
  trendDirection = 'up',
  accent = 'brand',
  icon,
  sparkData,
}: StatCardProps) {
  const { bar: accentColor, text: accentText } = accentMap[accent];

  return (
    <div className="flex-1 px-6 py-4 border-r border-geo-steel last:border-r-0 flex flex-col justify-center min-w-0">
      {/* Top accent bar */}
      <div className="w-6 h-0.5 mb-3 rounded-full" style={{ backgroundColor: accentColor }} />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold text-geo-mist uppercase tracking-widest mb-1 truncate">
            {label}
          </p>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-bold text-geo-white leading-none">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </span>
            {unit && <span className="text-xs text-geo-mist font-mono">{unit}</span>}
          </div>
          {trend && (
            <div className="flex items-center gap-1 mt-1.5">
              {trendDirection === 'up' && (
                <svg className="w-3 h-3 text-signal-low" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              )}
              {trendDirection === 'down' && (
                <svg className="w-3 h-3 text-signal-critical" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              )}
              <span className={`text-[10px] font-medium ${trendDirection === 'up' ? 'text-signal-low' : trendDirection === 'down' ? 'text-signal-critical' : 'text-geo-mist'}`}>
                {trend}
              </span>
            </div>
          )}
        </div>
        {sparkData && (
          <Sparkline data={sparkData} color={accentColor} />
        )}
        {icon && !sparkData && (
          <div className="text-geo-steel flex-shrink-0">{icon}</div>
        )}
      </div>
    </div>
  );
}
