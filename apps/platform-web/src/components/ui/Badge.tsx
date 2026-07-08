'use client';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'copper' | 'gold' | 'tin' | 'nickel' | 'brand' | 'low' | 'medium' | 'high' | 'critical' | 'surface' | 'custom';
  className?: string;
  style?: React.CSSProperties;
}

const variantStyles: Record<string, string> = {
  copper: 'bg-copper-primary text-white',
  gold: 'bg-gold-primary text-gold-light',
  tin: 'bg-tin-primary text-tin-light',
  nickel: 'bg-nickel-primary text-nickel-light',
  brand: 'bg-brand-primary text-white',
  low: 'bg-signal-low/20 text-signal-low',
  medium: 'bg-signal-medium/20 text-signal-medium',
  high: 'bg-signal-high/20 text-signal-high',
  critical: 'bg-signal-critical/20 text-signal-critical',
  surface: 'bg-geo-graphite text-geo-cloud',
  custom: '',
};

export function Badge({ children, variant = 'surface', className = '', style }: BadgeProps) {
  return (
    <span
      style={style}
      className={`
        inline-flex items-center px-2 py-0.5 rounded
        text-[11px] font-semibold tracking-wide uppercase
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}

export function CommodityBadge({ code }: { code: string }) {
  const colorMap: Record<string, string> = {
    Cu: 'bg-copper-primary text-white',
    Au: 'bg-gold-primary text-gold-light',
    Sn: 'bg-tin-primary text-tin-light',
    Ni: 'bg-nickel-primary text-nickel-light',
    Co: 'bg-purple-900 text-purple-300',
    Pb: 'bg-gray-700 text-gray-300',
    Zn: 'bg-gray-700 text-gray-300',
  };

  const normalized = code.split('-')[0];
  const cls = colorMap[normalized] ?? 'bg-geo-graphite text-geo-cloud';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold tracking-wide ${cls}`}>
      {code}
    </span>
  );
}
