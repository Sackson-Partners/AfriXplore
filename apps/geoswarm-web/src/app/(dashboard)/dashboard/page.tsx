'use client';

import { useState } from 'react';
import {
  AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, XAxis, YAxis, Tooltip,
} from 'recharts';

const FLEET = [
  { model: 'Falcon-G1', type: 'Fixed-Wing', status: 'In Field', battery: 74, mission: 'Luanshya Survey Block 4', statusColor: 'text-scan-green', dot: 'bg-scan-green', battColor: 'bg-scan-green' },
  { model: 'Raptor-M', type: 'Multi-Rotor', status: 'Charging', battery: 23, mission: 'Standby — Base Camp Alpha', statusColor: 'text-signal-medium', dot: 'bg-signal-medium', battColor: 'bg-signal-medium' },
  { model: 'Viper-H', type: 'Hybrid VTOL', status: 'Maintenance', battery: 91, mission: 'Scheduled: Tomorrow 06:00', statusColor: 'text-signal-high', dot: 'bg-signal-high', battColor: 'bg-drone-primary' },
];

const COVERAGE_DATA = [
  { week: 'W1', km2: 820 }, { week: 'W2', km2: 1140 }, { week: 'W3', km2: 980 },
  { week: 'W4', km2: 1620 }, { week: 'W5', km2: 2100 }, { week: 'W6', km2: 1890 },
  { week: 'W7', km2: 2340 }, { week: 'W8', km2: 2890 },
];

const RADAR_DATA = [
  { subject: 'Accuracy', v: 92 }, { subject: 'Resolution', v: 87 },
  { subject: 'Depth', v: 74 }, { subject: 'Signal', v: 89 }, { subject: 'Speed', v: 95 },
];

const ANOMALIES = [
  { id: 'ANM-0471', coords: '-12.4521°S, 27.8834°E', mineral: 'Copper', confidence: 94, severity: 'critical' },
  { id: 'ANM-0468', coords: '-13.1203°S, 28.2156°E', mineral: 'Cobalt', confidence: 87, severity: 'high' },
  { id: 'ANM-0465', coords: '-11.8834°S, 26.9912°E', mineral: 'Gold', confidence: 79, severity: 'medium' },
  { id: 'ANM-0462', coords: '-14.2341°S, 29.1023°E', mineral: 'Nickel', confidence: 71, severity: 'medium' },
  { id: 'ANM-0459', coords: '-12.9012°S, 27.4521°E', mineral: 'Copper', confidence: 65, severity: 'low' },
];

const severityDot: Record<string, string> = {
  critical: 'bg-signal-critical', high: 'bg-signal-high', medium: 'bg-signal-medium', low: 'bg-signal-low',
};
const mineralBadge: Record<string, string> = {
  Copper: 'bg-amber-900/40 text-amber-400 border-amber-700/40',
  Cobalt: 'bg-blue-900/40 text-blue-400 border-blue-700/40',
  Gold: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/40',
  Nickel: 'bg-slate-700/40 text-slate-300 border-slate-600/40',
};

function CTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-geo-graphite border border-geo-steel rounded-lg px-3 py-2 shadow-lg">
      <p className="text-[10px] text-geo-mist mb-0.5">{label}</p>
      <p className="font-mono text-sm text-drone-primary font-bold">{payload[0].value.toLocaleString()} km²</p>
    </div>
  );
}

export default function DashboardPage() {
  const [, setHovered] = useState<string | null>(null);

  return (
    <div className="p-6 space-y-5">

      {/* Fleet Status */}
      <section>
        <h2 className="font-display font-semibold text-geo-white text-sm mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-scan-green animate-pulse" />
          Fleet Status — Live Telemetry
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {FLEET.map((drone) => (
            <div key={drone.model} className="bg-geo-slate border border-geo-steel rounded-xl p-4 hover:border-drone-primary/40 transition-all duration-150 hover:-translate-y-0.5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-display font-bold text-geo-white text-base">{drone.model}</p>
                  <p className="text-[11px] text-geo-mist mt-0.5">{drone.type}</p>
                </div>
                <span className={`flex items-center gap-1.5 text-xs font-medium ${drone.statusColor}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${drone.dot} animate-pulse`} />
                  {drone.status}
                </span>
              </div>
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-geo-mist uppercase tracking-wide">Battery</span>
                  <span className="font-mono text-[11px] text-geo-cloud">{drone.battery}%</span>
                </div>
                <div className="h-1.5 bg-geo-graphite rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${drone.battColor}`} style={{ width: `${drone.battery}%` }} />
                </div>
              </div>
              <p className="text-[11px] text-geo-mist truncate">{drone.mission}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Active Missions', value: '3', sub: '+1 deployed today', color: 'text-drone-primary' },
          { label: 'Anomalies Detected', value: '147', sub: '+12 this week', color: 'text-signal-high' },
          { label: 'Area Covered', value: '12,450', unit: 'km²', sub: '+340 km² today', color: 'text-scan-green' },
          { label: 'Avg Confidence', value: '87', unit: '%', sub: 'Stable — 7 day avg', color: 'text-geo-cloud' },
        ].map((s) => (
          <div key={s.label} className="bg-geo-slate border border-geo-steel rounded-xl p-4">
            <p className="text-[10px] text-geo-mist uppercase tracking-wider font-medium mb-2">{s.label}</p>
            <p className={`font-mono font-bold text-2xl ${s.color}`}>
              {s.value}<span className="text-sm text-geo-mist ml-0.5">{s.unit ?? ''}</span>
            </p>
            <p className="text-[10px] text-geo-mist mt-1.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-geo-slate border border-geo-steel rounded-xl p-5">
          <h3 className="font-display font-semibold text-geo-white text-sm mb-1">Survey Coverage</h3>
          <p className="text-[10px] text-geo-mist uppercase tracking-wide mb-4">km² per week — last 8 weeks</p>
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={COVERAGE_DATA} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="week" tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} width={42} />
              <Tooltip content={<CTooltip />} />
              <Area type="monotone" dataKey="km2" stroke="#0EA5E9" strokeWidth={2} fill="url(#cg)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-geo-slate border border-geo-steel rounded-xl p-5">
          <h3 className="font-display font-semibold text-geo-white text-sm mb-1">Sensor Performance</h3>
          <p className="text-[10px] text-geo-mist uppercase tracking-wide mb-4">Composite fleet score</p>
          <ResponsiveContainer width="100%" height={170}>
            <RadarChart data={RADAR_DATA} cx="50%" cy="50%" outerRadius={65}>
              <PolarGrid stroke="#374151" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#6B7280', fontSize: 10 }} />
              <Radar dataKey="v" stroke="#0EA5E9" fill="#0EA5E9" fillOpacity={0.2} strokeWidth={1.5} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Live anomaly feed */}
      <div className="bg-geo-slate border border-geo-steel rounded-xl">
        <div className="px-5 py-3.5 border-b border-geo-steel flex items-center justify-between">
          <h3 className="font-display font-semibold text-geo-white text-sm flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-signal-critical animate-pulse" />
            Live Anomaly Feed
          </h3>
          <a href="/anomalies" className="text-xs text-drone-primary hover:underline">View all →</a>
        </div>
        <div className="divide-y divide-geo-steel/40">
          {ANOMALIES.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-4 px-5 py-3 hover:bg-geo-graphite/50 cursor-pointer transition-all duration-150"
              onMouseEnter={() => setHovered(a.id)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${severityDot[a.severity]}`} />
              <span className="font-mono text-xs text-geo-cloud w-20 flex-shrink-0">{a.id}</span>
              <span className="font-mono text-[11px] text-geo-mist flex-1">{a.coords}</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${mineralBadge[a.mineral] ?? 'bg-geo-graphite text-geo-cloud border-geo-steel'}`}>
                {a.mineral}
              </span>
              <span className="font-mono text-xs text-geo-cloud w-12 text-right flex-shrink-0">{a.confidence}%</span>
              <a href="/anomalies" className="text-xs text-drone-primary hover:underline flex-shrink-0">View →</a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
