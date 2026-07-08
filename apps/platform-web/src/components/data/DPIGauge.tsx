'use client';

interface DPIGaugeProps {
  value: number;
  size?: number;
  showLabel?: boolean;
}

function getDPIColor(value: number): string {
  if (value > 80) return '#EF4444'; // signal-critical
  if (value > 60) return '#F97316'; // signal-high
  if (value > 30) return '#EAB308'; // signal-medium
  return '#22C55E';                  // signal-low
}

export function DPIGauge({ value, size = 120, showLabel = true }: DPIGaugeProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.37;
  const strokeWidth = Math.max(5, size * 0.083);

  const clampedValue = Math.min(100, Math.max(0, value));
  const color = getDPIColor(value);

  // Arc spans 270° starting at 135° (bottom-left) going clockwise to 45° (bottom-right)
  const startAngleDeg = 135;
  const totalSweep = 270;

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const startAngle = toRad(startAngleDeg);
  const bgEndAngle = toRad(startAngleDeg + totalSweep); // = 45°
  const progressEndAngle = toRad(startAngleDeg + (clampedValue / 100) * totalSweep);

  const pt = (angle: number) => ({
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  });

  const start = pt(startAngle);
  const bgEnd = pt(bgEndAngle);
  const progressEnd = pt(progressEndAngle);

  const progressSweep = (clampedValue / 100) * totalSweep;
  const largeArc = progressSweep > 180 ? 1 : 0;

  // Font sizes relative to gauge size
  const valueFontSize = size * 0.24;
  const labelFontSize = size * 0.11;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`DPI score: ${value}`}>
      {/* Background track: 270° arc */}
      <path
        d={`M ${start.x},${start.y} A ${r},${r} 0 1,1 ${bgEnd.x},${bgEnd.y}`}
        fill="none"
        stroke="#374151"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />

      {/* Progress arc */}
      {clampedValue > 0 && (
        <path
          d={`M ${start.x},${start.y} A ${r},${r} 0 ${largeArc},1 ${progressEnd.x},${progressEnd.y}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 ${size * 0.04}px ${color}80)` }}
        />
      )}

      {/* Value text */}
      <text
        x={cx}
        y={cy - size * 0.04}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#F9FAFB"
        fontSize={valueFontSize}
        fontWeight="700"
        fontFamily="var(--font-jetbrains-mono), monospace"
      >
        {value}
      </text>

      {showLabel && (
        <text
          x={cx}
          y={cy + size * 0.18}
          textAnchor="middle"
          fill="#6B7280"
          fontSize={labelFontSize}
          fontFamily="var(--font-inter), sans-serif"
          letterSpacing="1.5"
        >
          DPI
        </text>
      )}
    </svg>
  );
}
