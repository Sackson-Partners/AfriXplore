'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getAnalyticsKPIs,
  getDiscoveryRate,
  getDPIDistribution,
  getCountryLeague,
} from '@/lib/api-client';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const PRODUCTION_DATA = [
  { month: 'Jan', copper: 42, gold: 28, cobalt: 18 },
  { month: 'Feb', copper: 47, gold: 31, cobalt: 22 },
  { month: 'Mar', copper: 51, gold: 26, cobalt: 19 },
  { month: 'Apr', copper: 58, gold: 35, cobalt: 27 },
  { month: 'May', copper: 63, gold: 40, cobalt: 31 },
  { month: 'Jun', copper: 59, gold: 38, cobalt: 29 },
  { month: 'Jul', copper: 67, gold: 44, cobalt: 35 },
  { month: 'Aug', copper: 72, gold: 48, cobalt: 38 },
  { month: 'Sep', copper: 78, gold: 52, cobalt: 41 },
  { month: 'Oct', copper: 81, gold: 55, cobalt: 44 },
  { month: 'Nov', copper: 76, gold: 50, cobalt: 40 },
  { month: 'Dec', copper: 84, gold: 58, cobalt: 46 },
];

const DPI_BANDS = [
  { range: '0–20', count: 124, color: '#22C55E' },
  { range: '21–40', count: 387, color: '#22C55E' },
  { range: '41–60', count: 892, color: '#EAB308' },
  { range: '61–80', count: 1247, color: '#F97316' },
  { range: '81–100', count: 634, color: '#EF4444' },
];

const COMMODITY_SPLIT = [
  { label: 'Copper (Cu)', value: 38, color: '#F59E0B' },
  { label: 'Gold (Au)', value: 24, color: '#FCD34D' },
  { label: 'Copper-Cobalt', value: 18, color: '#F97316' },
  { label: 'Nickel-Copper', value: 11, color: '#34D399' },
  { label: 'Tin (Sn)', value: 5, color: '#60A5FA' },
  { label: 'Other', value: 4, color: '#6B7280' },
];

const TOP_COUNTRIES = [
  { name: 'DRC', mines: 3241, dpi: 82, flag: '🇨🇩' },
  { name: 'Zambia', mines: 1847, dpi: 79, flag: '🇿🇲' },
  { name: 'Ghana', mines: 1203, dpi: 74, flag: '🇬🇭' },
  { name: 'South Africa', mines: 982, dpi: 71, flag: '🇿🇦' },
  { name: 'Tanzania', mines: 874, dpi: 68, flag: '🇹🇿' },
  { name: 'Namibia', mines: 631, dpi: 65, flag: '🇳🇦' },
  { name: 'Zimbabwe', mines: 548, dpi: 63, flag: '🇿🇼' },
];

const DISCOVERY_RATE = [18, 22, 19, 31, 28, 35, 41, 38, 47, 52, 48, 56];

function AreaChart({ data, color, height = 80 }: { data: number[]; color: string; height?: number }) {
  const w = 400;
  const h = height;
  const max = Math.max(...data);
  const min = Math.min(...data) * 0.9;
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => [i * step, h - ((v - min) / range) * (h - 12) - 6] as [number, number]);
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L ${w},${h} L 0,${h} Z`;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#grad-${color.replace('#', '')})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BarChart({ data }: { data: typeof PRODUCTION_DATA }) {
  const maxVal = Math.max(...data.flatMap(d => [d.copper, d.gold, d.cobalt]));
  return (
    <div className="flex items-end gap-1 h-40">
      {data.map((d) => (
        <div key={d.month} className="flex-1 flex flex-col items-center gap-0.5">
          <div className="flex items-end gap-px w-full" style={{ height: '120px' }}>
            {[
              { val: d.copper, color: '#F59E0B' },
              { val: d.gold, color: '#FCD34D' },
              { val: d.cobalt, color: '#34D399' },
            ].map(({ val, color }, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm transition-all"
                style={{ height: `${(val / maxVal) * 100}%`, backgroundColor: color, opacity: 0.85 }}
              />
            ))}
          </div>
          <span className="text-[9px] text-geo-mist font-mono">{d.month}</span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ data }: { data: typeof COMMODITY_SPLIT }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  let cumulative = 0;
  const r = 60;
  const cx = 80;
  const cy = 80;
  const circumference = 2 * Math.PI * r;

  const segments = data.map(d => {
    const offset = cumulative;
    cumulative += d.value / total;
    return { ...d, offset };
  });

  return (
    <svg width={160} height={160} viewBox="0 0 160 160">
      {segments.map((seg, i) => {
        const startAngle = seg.offset * 360 - 90;
        const endAngle = (seg.offset + seg.value / total) * 360 - 90;
        const start = {
          x: cx + r * Math.cos((startAngle * Math.PI) / 180),
          y: cy + r * Math.sin((startAngle * Math.PI) / 180),
        };
        const end = {
          x: cx + r * Math.cos((endAngle * Math.PI) / 180),
          y: cy + r * Math.sin((endAngle * Math.PI) / 180),
        };
        const largeArc = seg.value / total > 0.5 ? 1 : 0;
        return (
          <path
            key={i}
            d={`M ${cx},${cy} L ${start.x.toFixed(2)},${start.y.toFixed(2)} A ${r},${r} 0 ${largeArc},1 ${end.x.toFixed(2)},${end.y.toFixed(2)} Z`}
            fill={seg.color}
            opacity={0.85}
            stroke="#111827"
            strokeWidth={2}
          />
        );
      })}
      <circle cx={cx} cy={cy} r={36} fill="#111827" />
      <text x={cx} y={cy - 6} textAnchor="middle" className="font-mono" fontSize={18} fontWeight="bold" fill="#F9FAFB">34</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize={9} fill="#6B7280">Countries</text>
    </svg>
  );
}

export default function AnalyticsPage() {
  const isAuthenticated = useAuth();
  const router = useRouter();
  const [period, setPeriod] = useState<'12m' | '3m' | '1m'>('12m');

  useEffect(() => {
    if (!isAuthenticated) router.replace('/');
  }, [isAuthenticated, router]);

  const { data: kpis } = useQuery({
    queryKey: ['analytics-kpis'],
    queryFn: getAnalyticsKPIs,
    enabled: isAuthenticated,
  });

  const { data: discoveryRate } = useQuery({
    queryKey: ['discovery-rate'],
    queryFn: getDiscoveryRate,
    enabled: isAuthenticated,
  });

  const { data: dpiDist } = useQuery({
    queryKey: ['dpi-distribution'],
    queryFn: getDPIDistribution,
    enabled: isAuthenticated,
  });

  const { data: countryLeague } = useQuery({
    queryKey: ['country-league'],
    queryFn: getCountryLeague,
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) return null;

  const dpiBands = dpiDist && dpiDist.length > 0
    ? dpiDist.map((b, i) => ({
        range: b.range,
        count: Number(b.count),
        color: ['#22C55E', '#22C55E', '#EAB308', '#F97316', '#EF4444', '#EF4444', '#EF4444', '#EF4444', '#EF4444', '#EF4444'][i] ?? '#6B7280',
      }))
    : DPI_BANDS;

  const discoveryData = discoveryRate && discoveryRate.length > 0
    ? discoveryRate.map((r) => Number(r.count))
    : DISCOVERY_RATE;

  const totalDpi = dpiBands.reduce((s, b) => s + b.count, 0);

  return (
    <div className="p-6 bg-geo-obsidian min-h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-xl text-geo-white">Analytics</h1>
          <p className="text-xs text-geo-mist mt-0.5">Platform intelligence overview · Updated daily</p>
        </div>
        <div className="flex gap-1 bg-geo-slate border border-geo-steel rounded-lg p-1">
          {(['1m', '3m', '12m'] as const).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-xs rounded font-medium transition-colors ${period === p ? 'bg-brand-primary text-white' : 'text-geo-mist hover:text-geo-cloud'}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Mines Digitised', value: kpis ? Number(kpis.mines_digitised).toLocaleString() : '—', color: '#F59E0B' },
          { label: 'Active Anomalies', value: kpis ? Number(kpis.anomalies_active).toLocaleString() : '—', color: '#EF4444' },
          { label: 'Drill Targets', value: kpis ? Number(kpis.drill_targets).toLocaleString() : '—', color: '#1D4ED8' },
          { label: 'Avg DPI Score', value: kpis ? (kpis.avg_dpi != null ? String(kpis.avg_dpi) : '—') : '—', color: '#EAB308' },
          { label: 'Countries', value: kpis ? Number(kpis.countries).toLocaleString() : '—', color: '#22C55E' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-geo-slate border border-geo-steel rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-geo-mist uppercase tracking-widest">{kpi.label}</span>
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: kpi.color }} />
            </div>
            <p className="font-display font-bold text-2xl text-geo-white font-mono">{kpi.value}</p>
            <p className="text-[11px] text-geo-mist mt-1">Live data</p>
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Discovery Rate */}
        <div className="col-span-2 bg-geo-slate border border-geo-steel rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-display font-semibold text-geo-white">New Discovery Rate</p>
              <p className="text-[11px] text-geo-mist">Confirmed targets added per month</p>
            </div>
            <div className="font-mono font-bold text-2xl text-geo-white">56 <span className="text-xs text-signal-low font-normal">this month</span></div>
          </div>
          <AreaChart data={discoveryData} color="#1D4ED8" height={100} />
          <div className="flex justify-between mt-2">
            {MONTHS.map((m) => (
              <span key={m} className="text-[9px] text-geo-mist font-mono">{m}</span>
            ))}
          </div>
        </div>

        {/* DPI Distribution */}
        <div className="bg-geo-slate border border-geo-steel rounded-xl p-4">
          <p className="text-sm font-display font-semibold text-geo-white mb-1">DPI Distribution</p>
          <p className="text-[11px] text-geo-mist mb-4">{totalDpi.toLocaleString()} mines scored</p>
          <div className="space-y-2">
            {dpiBands.map((band) => (
              <div key={band.range} className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-geo-mist w-12">{band.range}</span>
                <div className="flex-1 bg-geo-graphite rounded-full h-4 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(band.count / totalDpi) * 100}%`, backgroundColor: band.color, opacity: 0.85 }}
                  />
                </div>
                <span className="font-mono text-[10px] text-geo-cloud w-12 text-right">{band.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Production Trends */}
        <div className="col-span-2 bg-geo-slate border border-geo-steel rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-display font-semibold text-geo-white">Production Index by Commodity</p>
              <p className="text-[11px] text-geo-mist">Relative extraction activity (indexed)</p>
            </div>
            <div className="flex gap-3">
              {[{ label: 'Cu', color: '#F59E0B' }, { label: 'Au', color: '#FCD34D' }, { label: 'Co', color: '#34D399' }].map(({ label, color }) => (
                <div key={label} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
                  <span className="text-[10px] text-geo-mist">{label}</span>
                </div>
              ))}
            </div>
          </div>
          <BarChart data={PRODUCTION_DATA} />
        </div>

        {/* Commodity Split */}
        <div className="bg-geo-slate border border-geo-steel rounded-xl p-4">
          <p className="text-sm font-display font-semibold text-geo-white mb-1">Commodity Split</p>
          <p className="text-[11px] text-geo-mist mb-3">By target count (%)</p>
          <div className="flex items-center gap-4">
            <DonutChart data={COMMODITY_SPLIT} />
            <div className="flex-1 space-y-1.5">
              {COMMODITY_SPLIT.map((c) => (
                <div key={c.label} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                    <span className="text-[10px] text-geo-cloud truncate">{c.label}</span>
                  </div>
                  <span className="font-mono text-[10px] text-geo-mist flex-shrink-0">{c.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Country Table */}
      <div className="bg-geo-slate border border-geo-steel rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-geo-steel flex items-center justify-between">
          <p className="text-sm font-display font-semibold text-geo-white">Top Countries by Mine Count</p>
          <button className="text-[11px] text-brand-primary hover:underline">View all 34 →</button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-geo-graphite">
            <tr>
              {['Country', 'Mines', 'Avg DPI', 'Coverage', 'Trend'].map((h) => (
                <th key={h} className="text-left px-5 py-3 text-[10px] font-semibold text-geo-mist uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-geo-steel/30">
            {(countryLeague ?? TOP_COUNTRIES.map((c) => ({
              country: c.name,
              mine_count: c.mines,
              avg_dpi: c.dpi,
              high_potential: 0,
              surveyed: 0,
            }))).map((c, i) => {
              const mineCount = Number(c.mine_count);
              const avgDpi = c.avg_dpi != null ? Number(c.avg_dpi) : null;
              const maxMines = countryLeague ? Math.max(...countryLeague.map((r) => Number(r.mine_count))) : 3241;
              return (
                <tr key={c.country} className="hover:bg-geo-graphite/50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-geo-white">{c.country}</span>
                      {i === 0 && <span className="text-[9px] bg-copper-light/20 text-copper-light px-1.5 py-0.5 rounded font-semibold">TOP</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3 font-mono text-geo-cloud">{mineCount.toLocaleString()}</td>
                  <td className="px-5 py-3">
                    <span className={`font-mono text-sm font-semibold ${avgDpi != null && avgDpi >= 80 ? 'text-signal-critical' : avgDpi != null && avgDpi >= 70 ? 'text-signal-high' : 'text-signal-medium'}`}>
                      {avgDpi != null ? avgDpi.toFixed(1) : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-geo-graphite rounded-full overflow-hidden">
                        <div className="h-full bg-brand-primary rounded-full" style={{ width: `${Math.min(100, (mineCount / maxMines) * 100)}%` }} />
                      </div>
                      <span className="text-[10px] text-geo-mist font-mono">{maxMines > 0 ? ((mineCount / maxMines) * 100).toFixed(1) : '0'}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-geo-mist text-xs font-mono">{Number(c.high_potential)} high DPI</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
