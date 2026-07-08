'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { StatCard } from '@/components/cards/StatCard';
import { AlertItem } from '@/components/cards/AlertItem';
import { DPIGauge } from '@/components/data/DPIGauge';
import { LayerToggle } from '@/components/data/LayerToggle';
import { CommodityBadge } from '@/components/ui/Badge';
import { MINES, ALERTS, MAP_LAYERS, MINERAL_SYSTEM_PARAMS, type Mine } from '@/lib/mock-data';
import { useQuery } from '@tanstack/react-query';
import { getAnalyticsKPIs } from '@/lib/api-client';
import type { LayerState } from '@/components/map/AINMap';

// Dynamic import to avoid SSR issues with Mapbox/Deck.gl
const AINMap = dynamic(() => import('@/components/map/AINMap'), { ssr: false });

const DEFAULT_selectedMine = MINES[0];

const DPI_TREND = [52, 58, 61, 67, 71, 74, 78, 75, 80, 84, 88, 91];

function MiniAreaChart({ data, color = '#1D4ED8' }: { data: number[]; color?: string }) {
  const w = 280, h = 80;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);

  const pts = data.map((v, i) => [i * step, h - ((v - min) / range) * (h - 16) - 8] as [number, number]);
  const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x},${y}`).join(' ');
  const areaPath = `${linePath} L ${w},${h} L 0,${h} Z`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="w-full">
      <defs>
        <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#area-grad)" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {[3, 7, 11].map((i) => {
        const [x, y] = pts[i];
        const isLast = i === 11;
        return (
          <g key={i}>
            {isLast && <circle cx={x} cy={y} r={5} fill="none" stroke={color} strokeWidth="1" opacity="0.3" />}
            <circle cx={x} cy={y} r={isLast ? 4 : 3}
              fill={isLast ? color : '#1F2937'} stroke={color} strokeWidth={isLast ? 0 : 1.5} />
          </g>
        );
      })}
    </svg>
  );
}

export default function DashboardPage() {
  const isAuthenticated = useAuth();
  const router = useRouter();
  const [layers, setLayers] = useState(MAP_LAYERS);
  const [timeYear, setTimeYear] = useState(2024);
  const [activeTab, setActiveTab] = useState<'30d' | '90d' | '365d'>('30d');
  const [selectedMine, setSelectedMine] = useState<Mine>(DEFAULT_selectedMine);

  useEffect(() => {
    if (!isAuthenticated) router.replace('/');
  }, [isAuthenticated, router]);

  const { data: kpis } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: getAnalyticsKPIs,
    enabled: isAuthenticated,
  });

  const deckLayerState: LayerState = {
    heatmap: layers.find(l => l.id === 'aeromagnetics')?.enabled ?? true,
    clusters: layers.find(l => l.id === 'mines')?.enabled ?? true,
    mines: layers.find(l => l.id === 'mines')?.enabled ?? true,
    alteration: layers.find(l => l.id === 'alteration')?.enabled ?? true,
    fronts: layers.find(l => l.id === 'asm')?.enabled ?? true,
    aeromagnetics: layers.find(l => l.id === 'aeromagnetics')?.enabled ?? true,
    licences: layers.find(l => l.id === 'licensed')?.enabled ?? false,
  };

  const toggleLayer = (id: string) => {
    setLayers((prev) => prev.map((l) => l.id === id ? { ...l, enabled: !l.enabled } : l));
  };

  if (!isAuthenticated) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Stats Bar */}
      <div className="flex h-[72px] bg-geo-slate border-b border-geo-steel flex-shrink-0">
        <StatCard label="Mines Digitised" value={kpis ? Number(kpis.mines_digitised) : 0} trend="live" accent="copper"
          sparkData={[8200, 9400, 10100, 11200, 11800, 12500, 13100, 13600, kpis ? Number(kpis.mines_digitised) : 0]} />
        <StatCard label="Active Anomalies" value={kpis ? Number(kpis.anomalies_active) : 0} trend="live" accent="high"
          sparkData={[1800, 2100, 2300, 2400, 2500, 2600, 2700, 2800, kpis ? Number(kpis.anomalies_active) : 0]} />
        <StatCard label="Drill Targets" value={kpis ? Number(kpis.drill_targets) : 0} trend="live" accent="brand"
          sparkData={[280, 290, 305, 310, 318, 325, 335, 340, kpis ? Number(kpis.drill_targets) : 0]} />
        <StatCard label="Avg DPI Score" value={kpis && kpis.avg_dpi != null ? String(kpis.avg_dpi) : '—'} unit="/ 100" trend="live" accent="medium"
          sparkData={[65, 68, 71, 73, 74, 76, 77, 78, kpis && kpis.avg_dpi != null ? Number(kpis.avg_dpi) : 78]} />
        <StatCard label="Countries Covered" value={kpis ? Number(kpis.countries) : 0} trend="live" accent="low" />
      </div>

      {/* Map + Right Panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map Panel */}
        <div className="relative flex-1 overflow-hidden">
          <AINMap
            layerState={deckLayerState}
            onMineSelect={(mine) => setSelectedMine(mine)}
            className="absolute inset-0"
          />

          {/* Layer Control */}
          <div className="absolute top-4 left-4 w-52 bg-geo-slate/95 backdrop-blur-sm border border-geo-steel rounded-xl shadow-lg overflow-hidden z-10">
            <div className="px-4 py-3 border-b border-geo-steel">
              <p className="text-[10px] font-semibold text-geo-mist uppercase tracking-[0.15em]">Map Layers</p>
            </div>
            <div className="px-4 py-2 flex flex-col gap-1">
              {layers.map((layer) => (
                <LayerToggle
                  key={layer.id}
                  label={layer.label}
                  color={layer.color}
                  enabled={layer.enabled}
                  onToggle={() => toggleLayer(layer.id)}
                />
              ))}
            </div>
          </div>

          {/* Compass */}
          <div className="absolute top-4 right-4 w-8 h-8 bg-geo-slate/90 border border-geo-steel rounded-lg flex items-center justify-center z-10">
            <span className="text-[10px] font-bold text-geo-cloud font-mono">N</span>
          </div>

          {/* Time Lapse Bar */}
          <div className="absolute bottom-0 left-0 right-0 bg-geo-slate/90 backdrop-blur-sm border-t border-geo-steel px-5 py-3 z-10">
            <div className="flex items-center gap-4">
              <button className="text-geo-mist hover:text-geo-cloud transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
              <span className="font-mono text-xs text-geo-mist w-8">1880</span>
              <div className="flex-1">
                <input
                  type="range" min={1880} max={2024} value={timeYear}
                  onChange={(e) => setTimeYear(Number(e.target.value))}
                  className="w-full"
                  style={{ accentColor: '#1D4ED8' }}
                />
              </div>
              <span className="font-mono text-xs text-geo-white font-semibold w-8">{timeYear}</span>
              <button className="text-[10px] text-geo-mist border border-geo-steel rounded px-2 py-0.5 hover:border-geo-mist transition-colors">
                1×
              </button>
            </div>
          </div>
        </div>

        {/* Anomaly Detail Panel */}
        <div className="w-[380px] flex-shrink-0 bg-geo-slate border-l border-geo-steel flex flex-col overflow-y-auto scrollbar-hide">

          {/* Panel Header */}
          <div className="px-5 py-4 border-b border-geo-steel flex-shrink-0">
            <h2 className="font-display font-semibold text-geo-white text-sm">Anomaly Detail</h2>
            <p className="text-[11px] text-geo-mist mt-0.5">Copper Belt Cluster A · {MINES.filter(m => m.commodityCode.includes('Cu')).length} targets</p>
          </div>

          {/* Selected Mine Card */}
          <div className="p-4 flex-shrink-0">
            <div className="bg-geo-graphite rounded-xl p-4 border border-geo-steel/60">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-semibold text-sm text-geo-white leading-snug">{selectedMine.name}</h3>
                  <p className="text-[11px] text-geo-mist mt-0.5">{selectedMine.region}, {selectedMine.country}</p>
                  <p className="font-mono text-[10px] text-geo-steel mt-0.5">{selectedMine.coordinates[1].toFixed(4)}°, {selectedMine.coordinates[0].toFixed(4)}°</p>
                </div>
                <DPIGauge value={selectedMine.dpi} size={72} />
              </div>

              <div className="flex flex-wrap gap-1.5 mt-3">
                <CommodityBadge code={selectedMine.commodityCode} />
                <span className="text-[10px] bg-geo-slate text-geo-cloud px-2 py-0.5 rounded font-medium">{selectedMine.systemType}</span>
                <span className="text-[10px] bg-geo-slate text-geo-cloud px-2 py-0.5 rounded">{selectedMine.operatingYears}</span>
                <span className="text-[10px] bg-signal-low/15 text-signal-low px-2 py-0.5 rounded font-medium">{selectedMine.peakGrade}</span>
              </div>

              {/* Mineral System Grid */}
              <div className="mt-4">
                <p className="text-[10px] font-semibold text-geo-mist uppercase tracking-widest mb-2">Mineral System</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {MINERAL_SYSTEM_PARAMS.slice(0, 4).map((p) => (
                    <div key={p.label} className="bg-geo-slate rounded-lg p-2.5">
                      <p className="text-[10px] text-geo-steel">{p.label}</p>
                      <p className="text-[11px] text-geo-cloud font-medium leading-snug mt-0.5">{p.value.split(' ')[0]}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* DPI Trend */}
          <div className="px-4 pb-4 flex-shrink-0 border-b border-geo-steel">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-geo-mist uppercase tracking-widest">DPI Trend</p>
              <div className="flex gap-1">
                {(['30d', '90d', '365d'] as const).map((t) => (
                  <button key={t}
                    onClick={() => setActiveTab(t)}
                    className={`text-[10px] px-2 py-0.5 rounded transition-colors ${activeTab === t ? 'bg-brand-primary text-white' : 'text-geo-mist hover:text-geo-cloud'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-geo-graphite rounded-xl p-3">
              <MiniAreaChart data={DPI_TREND} color="#1D4ED8" />
            </div>
            <div className="flex gap-4 mt-2">
              {[{ label: '30d', val: '▲ 12.4' }, { label: '90d', val: '▲ 28.1' }, { label: '365d', val: '▲ 45.6' }].map((s) => (
                <div key={s.label}>
                  <span className="text-[10px] text-geo-mist">{s.label}: </span>
                  <span className="text-[10px] text-signal-low font-mono font-semibold">{s.val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-2 p-4 border-b border-geo-steel flex-shrink-0">
            {[
              { val: '47', label: 'Reports' },
              { val: selectedMine.commodityCode, label: 'Commodity' },
              { val: selectedMine.status === 'drill-target' ? 'Drill Target' : selectedMine.status === 'active-msim' ? 'Active' : 'Historical', label: 'Status' },
            ].map((s) => (
              <div key={s.label} className="bg-geo-graphite rounded-lg p-2.5">
                <p className="font-mono font-semibold text-sm text-geo-white">{s.val}</p>
                <p className="text-[10px] text-geo-mist uppercase tracking-wide mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Alerts */}
          <div className="flex-shrink-0 border-b border-geo-steel">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <p className="text-[10px] font-semibold text-geo-mist uppercase tracking-widest">Recent Alerts</p>
              <span className="text-[10px] bg-signal-critical/20 text-signal-critical px-2 py-0.5 rounded font-semibold">
                {ALERTS.filter(a => a.unread).length} NEW
              </span>
            </div>
            <div className="pb-2">
              {ALERTS.map((alert) => (
                <AlertItem key={alert.id} {...alert} />
              ))}
            </div>
            <div className="px-4 pb-4">
              <button className="text-xs text-brand-primary hover:underline font-medium">View All Alerts →</button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="p-4">
            <p className="text-[10px] font-semibold text-geo-mist uppercase tracking-widest mb-3">Quick Actions</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: '📄', label: 'Export GeoJSON' },
                { icon: '📦', label: 'Export Shapefile' },
                { icon: '📋', label: 'Generate PDF Report' },
                { icon: '🎯', label: 'Add to Target Book' },
                { icon: '📊', label: 'Compare Territory' },
                { icon: '🗺️', label: 'View Full System' },
              ].map((action) => (
                <button
                  key={action.label}
                  className="flex items-center gap-2 h-9 px-3 bg-transparent border border-geo-steel rounded-lg text-[11px] text-geo-cloud
                    hover:bg-geo-graphite hover:border-geo-mist transition-all text-left"
                >
                  <span>{action.icon}</span>
                  <span className="truncate">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
