'use client';

interface AlertItemProps {
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  body: string;
  coordinates?: string;
  timestamp: string;
  unread?: boolean;
}

const severityConfig = {
  critical: { color: '#EF4444', dot: 'bg-signal-critical', bg: 'bg-geo-graphite' },
  high: { color: '#F97316', dot: 'bg-signal-high', bg: 'bg-geo-graphite' },
  medium: { color: '#EAB308', dot: 'bg-signal-medium', bg: 'bg-geo-graphite/60' },
  low: { color: '#22C55E', dot: 'bg-signal-low', bg: 'bg-geo-graphite/40' },
};

export function AlertItem({ severity, title, body, coordinates, timestamp, unread = false }: AlertItemProps) {
  const { color, dot, bg } = severityConfig[severity];

  return (
    <div
      className={`relative flex items-start gap-3 px-4 py-3 rounded-lg transition-colors hover:bg-geo-graphite/80 cursor-pointer ${unread ? bg : 'bg-transparent'}`}
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${dot} ${unread ? '' : 'opacity-40'}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-xs leading-snug mb-0.5 ${unread ? 'font-semibold text-geo-white' : 'font-medium text-geo-cloud'}`}>
          {title}
        </p>
        <p className="text-[11px] text-geo-mist leading-snug truncate">{body}</p>
        <div className="flex items-center gap-3 mt-1">
          {coordinates && (
            <span className="font-mono text-[10px] text-geo-mist">{coordinates}</span>
          )}
          <span className="text-[10px] text-geo-steel">{timestamp}</span>
        </div>
      </div>
      <svg className="w-4 h-4 text-geo-steel flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );
}
