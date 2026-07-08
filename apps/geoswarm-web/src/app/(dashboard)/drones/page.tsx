'use client';

import { useState } from 'react';

const SENSOR_COLORS: Record<string, string> = {
  'Aeromagnetics': 'bg-amber-900/40 text-amber-400 border-amber-700/40',
  'Gravity': 'bg-blue-900/40 text-blue-400 border-blue-700/40',
  'Hyperspectral': 'bg-emerald-900/40 text-emerald-400 border-emerald-700/40',
  'RGB': 'bg-violet-900/40 text-violet-400 border-violet-700/40',
  'Ground Penetrating Radar': 'bg-orange-900/40 text-orange-400 border-orange-700/40',
  'Seismic Array': 'bg-red-900/40 text-red-400 border-red-700/40',
};

const DRONES = [
  {
    model: 'Falcon-G1',
    type: 'Fixed-Wing',
    status: 'OPERATIONAL',
    liveStatus: 'In Field',
    liveColor: 'text-scan-green bg-scan-green/10 border-scan-green/30',
    dotColor: 'bg-scan-green',
    specs: { altitude: '2,400 m', range: '180 km', battery: '8 h', payload: '12 kg' },
    sensors: ['Aeromagnetics', 'Gravity'],
    missions: 47,
    successRate: 94,
    history: [
      { date: '2024-11-28', location: 'Luanshya Block 4, Zambia', duration: '6h 42m', anomalies: 12 },
      { date: '2024-11-22', location: 'Nkana Copper Belt, Zambia', duration: '7h 15m', anomalies: 8 },
      { date: '2024-11-15', location: 'Roan Antelope, Zambia', duration: '5h 58m', anomalies: 5 },
    ],
    techSpecs: { wingspan: '2.8 m', weight: '18 kg', maxWind: '45 km/h', opTemp: '-10°C to +45°C', ip: 'IP54' },
    maintenance: [
      { date: '2024-11-20', type: 'Battery Swap', tech: 'T. Banda', status: 'Complete' },
      { date: '2024-11-10', type: 'Sensor Calibration', tech: 'M. Chirwa', status: 'Complete' },
      { date: '2024-10-30', type: '100hr Service', tech: 'J. Mwanza', status: 'Complete' },
    ],
  },
  {
    model: 'Raptor-M',
    type: 'Multi-Rotor',
    status: 'OPERATIONAL',
    liveStatus: 'Charging',
    liveColor: 'text-signal-medium bg-signal-medium/10 border-signal-medium/30',
    dotColor: 'bg-signal-medium',
    specs: { altitude: '800 m', range: '45 km', battery: '90 min', payload: '4 kg' },
    sensors: ['Hyperspectral', 'RGB'],
    missions: 23,
    successRate: 87,
    history: [
      { date: '2024-11-27', location: 'Geita Gold Mine, Tanzania', duration: '1h 28m', anomalies: 4 },
      { date: '2024-11-25', location: 'Geita Gold Mine, Tanzania', duration: '1h 35m', anomalies: 6 },
      { date: '2024-11-20', location: 'Bulyanhulu, Tanzania', duration: '1h 12m', anomalies: 2 },
    ],
    techSpecs: { wingspan: '0.9 m (diagonal)', weight: '6.5 kg', maxWind: '30 km/h', opTemp: '-5°C to +40°C', ip: 'IP43' },
    maintenance: [
      { date: '2024-11-26', type: 'Rotor Inspection', tech: 'A. Osei', status: 'Complete' },
      { date: '2024-11-18', type: 'Camera Calibration', tech: 'T. Banda', status: 'Complete' },
      { date: '2024-11-05', type: '50hr Service', tech: 'M. Chirwa', status: 'Complete' },
    ],
  },
  {
    model: 'Viper-H',
    type: 'Hybrid VTOL',
    status: 'OPERATIONAL',
    liveStatus: 'Maintenance',
    liveColor: 'text-signal-high bg-signal-high/10 border-signal-high/30',
    dotColor: 'bg-signal-high',
    specs: { altitude: '1,800 m', range: '120 km', battery: '5 h', payload: '8 kg' },
    sensors: ['Aeromagnetics', 'Hyperspectral'],
    missions: 12,
    successRate: 92,
    history: [
      { date: '2024-11-24', location: 'Kolwezi, DRC', duration: '4h 20m', anomalies: 9 },
      { date: '2024-11-18', location: 'Kamoa-Kakula, DRC', duration: '4h 55m', anomalies: 14 },
      { date: '2024-11-10', location: 'Tenke Fungurume, DRC', duration: '3h 45m', anomalies: 7 },
    ],
    techSpecs: { wingspan: '1.9 m', weight: '12 kg', maxWind: '40 km/h', opTemp: '-15°C to +50°C', ip: 'IP55' },
    maintenance: [
      { date: '2024-11-29', type: 'Transition System Check', tech: 'J. Mwanza', status: 'In Progress' },
      { date: '2024-11-20', type: 'Sensor Alignment', tech: 'T. Banda', status: 'Complete' },
      { date: '2024-11-01', type: '25hr Service', tech: 'A. Osei', status: 'Complete' },
    ],
  },
  {
    model: 'Phoenix-3D',
    type: 'Heavy-Lift',
    status: 'IN DEVELOPMENT',
    liveStatus: 'Lab Testing',
    liveColor: 'text-brand-primary bg-brand-primary/10 border-brand-primary/30',
    dotColor: 'bg-brand-primary',
    specs: { altitude: '600 m', range: '30 km', battery: '60 min', payload: '15 kg' },
    sensors: ['Ground Penetrating Radar', 'Seismic Array'],
    missions: 3,
    successRate: 100,
    history: [
      { date: '2024-11-15', location: 'Test Range Alpha, Lusaka', duration: '0h 45m', anomalies: 0 },
      { date: '2024-11-08', location: 'Test Range Alpha, Lusaka', duration: '0h 38m', anomalies: 0 },
      { date: '2024-10-30', location: 'Test Range Beta, Lusaka', duration: '0h 22m', anomalies: 0 },
    ],
    techSpecs: { wingspan: '1.4 m (diagonal)', weight: '22 kg', maxWind: '25 km/h', opTemp: '-5°C to +40°C', ip: 'IP43' },
    maintenance: [
      { date: '2024-11-28', type: 'Radar Module Install', tech: 'Engineering Team', status: 'In Progress' },
      { date: '2024-11-20', type: 'Structural Stress Test', tech: 'Engineering Team', status: 'Complete' },
      { date: '2024-11-10', type: 'Initial Power-on', tech: 'Engineering Team', status: 'Complete' },
    ],
  },
];

function DroneIllustration({ type }: { type: string }) {
  if (type === 'Fixed-Wing') {
    return (
      <svg viewBox="0 0 220 120" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="glow-fw" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="110" cy="60" rx="70" ry="40" fill="url(#glow-fw)" />
        {/* Fuselage */}
        <rect x="60" y="55" width="100" height="10" rx="5" fill="#0EA5E9" opacity="0.9" />
        {/* Wings */}
        <polygon points="80,60 40,45 40,55 80,65" fill="#0369A1" opacity="0.8" />
        <polygon points="140,60 180,45 180,55 140,65" fill="#0369A1" opacity="0.8" />
        {/* Tail */}
        <polygon points="155,60 170,50 170,55" fill="#0EA5E9" opacity="0.7" />
        <polygon points="155,60 170,70 170,65" fill="#0EA5E9" opacity="0.7" />
        {/* Nose */}
        <polygon points="160,60 175,57 175,63" fill="#7DD3FC" opacity="0.9" />
        {/* Engine pods */}
        <ellipse cx="85" cy="52" rx="8" ry="4" fill="#075985" opacity="0.8" />
        <ellipse cx="135" cy="52" rx="8" ry="4" fill="#075985" opacity="0.8" />
      </svg>
    );
  }
  if (type === 'Multi-Rotor') {
    return (
      <svg viewBox="0 0 220 120" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="glow-mr" cx="50%" cy="50%" r="40%">
            <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="110" cy="60" rx="55" ry="35" fill="url(#glow-mr)" />
        {/* Arms */}
        <line x1="110" y1="60" x2="70" y2="35" stroke="#0369A1" strokeWidth="4" strokeLinecap="round" />
        <line x1="110" y1="60" x2="150" y2="35" stroke="#0369A1" strokeWidth="4" strokeLinecap="round" />
        <line x1="110" y1="60" x2="70" y2="85" stroke="#0369A1" strokeWidth="4" strokeLinecap="round" />
        <line x1="110" y1="60" x2="150" y2="85" stroke="#0369A1" strokeWidth="4" strokeLinecap="round" />
        {/* Center body */}
        <rect x="96" y="46" width="28" height="28" rx="6" fill="#0EA5E9" opacity="0.9" />
        <rect x="102" y="52" width="16" height="16" rx="3" fill="#075985" opacity="0.8" />
        {/* Rotors */}
        {[[70,35],[150,35],[70,85],[150,85]].map(([cx,cy],i) => (
          <g key={i}>
            <circle cx={cx} cy={cy} r="14" fill="none" stroke="#0EA5E9" strokeWidth="1" opacity="0.4" strokeDasharray="3 3" />
            <circle cx={cx} cy={cy} r="4" fill="#0EA5E9" opacity="0.9" />
            <line x1={cx-12} y1={cy} x2={cx+12} y2={cy} stroke="#7DD3FC" strokeWidth="2" opacity="0.6" strokeLinecap="round" />
          </g>
        ))}
      </svg>
    );
  }
  if (type === 'Hybrid VTOL') {
    return (
      <svg viewBox="0 0 220 120" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="glow-vtol" cx="50%" cy="50%" r="45%">
            <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="110" cy="60" rx="65" ry="38" fill="url(#glow-vtol)" />
        {/* Fuselage */}
        <rect x="75" y="56" width="70" height="8" rx="4" fill="#0EA5E9" opacity="0.9" />
        {/* Mid-wings */}
        <polygon points="95,60 55,52 55,60 95,68" fill="#0369A1" opacity="0.8" />
        <polygon points="125,60 165,52 165,60 125,68" fill="#0369A1" opacity="0.8" />
        {/* VTOL rotors at wingtips */}
        <circle cx="52" cy="44" r="10" fill="none" stroke="#0EA5E9" strokeWidth="1" opacity="0.5" strokeDasharray="2 2" />
        <line x1="42" y1="44" x2="62" y2="44" stroke="#7DD3FC" strokeWidth="2" opacity="0.7" strokeLinecap="round" />
        <circle cx="52" cy="44" r="3" fill="#0EA5E9" />
        <circle cx="168" cy="44" r="10" fill="none" stroke="#0EA5E9" strokeWidth="1" opacity="0.5" strokeDasharray="2 2" />
        <line x1="158" y1="44" x2="178" y2="44" stroke="#7DD3FC" strokeWidth="2" opacity="0.7" strokeLinecap="round" />
        <circle cx="168" cy="44" r="3" fill="#0EA5E9" />
        {/* Tail fin */}
        <polygon points="75,60 62,52 62,60" fill="#0EA5E9" opacity="0.7" />
      </svg>
    );
  }
  // Heavy-Lift (Phoenix-3D) — 6 rotors
  return (
    <svg viewBox="0 0 220 120" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="glow-hl" cx="50%" cy="50%" r="40%">
          <stop offset="0%" stopColor="#6366F1" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="110" cy="60" rx="70" ry="40" fill="url(#glow-hl)" />
      {/* 6 arms */}
      {[[-50,-25],[-50,25],[0,-30],[0,30],[50,-25],[50,25]].map(([dx,dy],i) => (
        <g key={i}>
          <line x1="110" y1="60" x2={110+dx} y2={60+dy} stroke="#4F46E5" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx={110+dx} cy={60+dy} r="12" fill="none" stroke="#6366F1" strokeWidth="1" opacity="0.5" strokeDasharray="2 2" />
          <line x1={110+dx-10} y1={60+dy} x2={110+dx+10} y2={60+dy} stroke="#A5B4FC" strokeWidth="2" opacity="0.7" strokeLinecap="round" />
          <circle cx={110+dx} cy={60+dy} r="3" fill="#6366F1" opacity="0.9" />
        </g>
      ))}
      {/* Center body */}
      <rect x="97" y="48" width="26" height="24" rx="5" fill="#4F46E5" opacity="0.9" />
      <rect x="103" y="54" width="14" height="12" rx="2.5" fill="#312E81" opacity="0.9" />
      {/* Sensor pod (GPR) */}
      <rect x="100" y="68" width="20" height="6" rx="2" fill="#1D4ED8" opacity="0.8" />
    </svg>
  );
}

export default function DronesPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'history' | 'tech' | 'maintenance'>('history');
  const [filter, setFilter] = useState<'All' | 'Operational' | 'In Development'>('All');

  const filtered = DRONES.filter(d => filter === 'All' || d.status === filter.toUpperCase() ||
    (filter === 'In Development' && d.status === 'IN DEVELOPMENT') ||
    (filter === 'Operational' && d.status === 'OPERATIONAL'));

  const expandedDrone = DRONES.find(d => d.model === selected);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-geo-white text-2xl">Fleet Intelligence</h1>
          <p className="text-sm text-geo-mist mt-1">4 active platforms · 7 sensor configurations · 85 total missions</p>
        </div>
        <div className="flex gap-2">
          {(['All', 'Operational', 'In Development'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${filter === f ? 'bg-drone-primary text-white' : 'bg-geo-graphite text-geo-mist hover:text-geo-cloud border border-geo-steel'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Drone grid */}
      <div className="grid grid-cols-2 gap-5">
        {filtered.map((drone) => (
          <div
            key={drone.model}
            onClick={() => setSelected(selected === drone.model ? null : drone.model)}
            className={`bg-geo-slate border rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${selected === drone.model ? 'border-drone-primary/60 shadow-glow-drone' : 'border-geo-steel hover:border-drone-primary/30'}`}
          >
            {/* SVG illustration */}
            <div className="relative h-40 bg-geo-graphite flex items-center justify-center p-4">
              <DroneIllustration type={drone.type} />
              <div className={`absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded border ${drone.liveColor}`}>
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${drone.dotColor} mr-1`} />
                {drone.liveStatus}
              </div>
            </div>

            {/* Card body */}
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-display font-bold text-geo-white text-lg">{drone.model}</h2>
                  <p className="text-xs text-geo-mist">{drone.type}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${drone.status === 'OPERATIONAL' ? 'text-scan-green bg-scan-green/10 border-scan-green/30' : 'text-brand-primary bg-brand-primary/10 border-brand-primary/30'}`}>
                  {drone.status}
                </span>
              </div>

              {/* Specs */}
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(drone.specs).map(([k, v]) => (
                  <div key={k} className="bg-geo-graphite rounded-lg p-2 text-center">
                    <p className="text-[9px] text-geo-mist uppercase tracking-wide mb-0.5">{k}</p>
                    <p className="font-mono text-[11px] text-geo-cloud font-semibold">{v}</p>
                  </div>
                ))}
              </div>

              {/* Sensors */}
              <div className="flex flex-wrap gap-1.5">
                {drone.sensors.map(s => (
                  <span key={s} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${SENSOR_COLORS[s] ?? 'bg-geo-graphite text-geo-mist border-geo-steel'}`}>{s}</span>
                ))}
              </div>

              {/* Missions + success */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-geo-mist">{drone.missions} missions</span>
                  <span className="font-mono text-[11px] text-drone-primary font-semibold">{drone.successRate}% success</span>
                </div>
                <div className="h-1.5 bg-geo-graphite rounded-full overflow-hidden">
                  <div className="h-full bg-drone-primary rounded-full" style={{ width: `${drone.successRate}%` }} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Expanded detail panel */}
      {expandedDrone && (
        <div className="bg-geo-slate border border-drone-primary/30 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-geo-steel flex items-center justify-between">
            <h3 className="font-display font-bold text-geo-white">{expandedDrone.model} — Detailed Records</h3>
            <div className="flex gap-2">
              {(['history', 'tech', 'maintenance'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${activeTab === t ? 'bg-drone-primary text-white' : 'text-geo-mist hover:text-geo-cloud'}`}
                >
                  {t === 'history' ? 'Mission History' : t === 'tech' ? 'Tech Specs' : 'Maintenance'}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5">
            {activeTab === 'history' && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] text-geo-mist uppercase tracking-wide border-b border-geo-steel">
                    <th className="text-left pb-2">Date</th><th className="text-left pb-2">Location</th>
                    <th className="text-right pb-2">Duration</th><th className="text-right pb-2">Anomalies</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-geo-steel/40">
                  {expandedDrone.history.map((h, i) => (
                    <tr key={i} className="hover:bg-geo-graphite/40">
                      <td className="font-mono text-xs text-geo-mist py-2.5">{h.date}</td>
                      <td className="text-xs text-geo-cloud py-2.5">{h.location}</td>
                      <td className="font-mono text-xs text-geo-cloud text-right py-2.5">{h.duration}</td>
                      <td className="font-mono text-xs text-right py-2.5">
                        <span className={h.anomalies > 0 ? 'text-signal-high' : 'text-geo-mist'}>{h.anomalies}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {activeTab === 'tech' && (
              <div className="grid grid-cols-5 gap-3">
                {Object.entries(expandedDrone.techSpecs).map(([k, v]) => (
                  <div key={k} className="bg-geo-graphite rounded-lg p-3">
                    <p className="text-[10px] text-geo-mist uppercase tracking-wide mb-1">{k.replace(/([A-Z])/g, ' $1').trim()}</p>
                    <p className="font-mono text-xs text-geo-cloud font-semibold">{v}</p>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'maintenance' && (
              <div className="space-y-2">
                {expandedDrone.maintenance.map((m, i) => (
                  <div key={i} className="flex items-center gap-4 bg-geo-graphite rounded-lg px-4 py-3">
                    <span className="font-mono text-[11px] text-geo-mist w-24 flex-shrink-0">{m.date}</span>
                    <span className="text-sm text-geo-cloud flex-1">{m.type}</span>
                    <span className="text-xs text-geo-mist">{m.tech}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${m.status === 'Complete' ? 'text-scan-green bg-scan-green/10 border-scan-green/30' : 'text-signal-medium bg-signal-medium/10 border-signal-medium/30'}`}>
                      {m.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
