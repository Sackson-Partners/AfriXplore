'use client';

interface LayerToggleProps {
  label: string;
  color: string;
  enabled: boolean;
  onToggle: () => void;
}

export function LayerToggle({ label, color, enabled, onToggle }: LayerToggleProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="w-3 h-3 rounded-sm flex-shrink-0"
          style={{ backgroundColor: enabled ? color : '#374151' }}
        />
        <span className={`text-xs truncate transition-colors ${enabled ? 'text-geo-cloud' : 'text-geo-mist'}`}>
          {label}
        </span>
      </div>
      {/* Toggle switch */}
      <button
        onClick={onToggle}
        className="relative flex-shrink-0 w-8 h-4.5 rounded-full transition-colors duration-200 focus:outline-none"
        style={{
          backgroundColor: enabled ? '#1D4ED8' : '#374151',
          height: '18px',
          width: '32px',
        }}
        aria-checked={enabled}
        role="switch"
      >
        <span
          className="absolute top-0.5 rounded-full transition-transform duration-200"
          style={{
            width: '14px',
            height: '14px',
            backgroundColor: enabled ? 'white' : '#6B7280',
            transform: enabled ? 'translateX(16px)' : 'translateX(2px)',
          }}
        />
      </button>
    </div>
  );
}
