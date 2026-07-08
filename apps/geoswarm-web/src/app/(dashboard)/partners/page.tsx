'use client';

import { useState } from 'react';

const PARTNERS = [
  {
    id: 'ivanhoe', name: 'Ivanhoe Mines', country: 'South Africa', flag: '🇿🇦',
    contracts: 3, km2: 4200, status: 'Active',
    stats: { investment: '$12.4M', surveys: 8, packages: 14 },
    color: 'bg-amber-500',
    contracts_list: [
      { id: 'GS-2024-001', type: 'Aeromagnetic Survey', area: '1,400 km²', status: 'Active', value: '$4.2M', delivery: '2025-03-15' },
      { id: 'GS-2024-002', type: 'Hyperspectral', area: '800 km²', status: 'Complete', value: '$3.1M', delivery: '2024-11-01' },
      { id: 'GS-2024-003', type: 'Gravity Survey', area: '2,000 km²', status: 'Processing', value: '$5.1M', delivery: '2025-01-30' },
    ],
    activity: [
      { time: '2h ago', text: 'Block 4 anomaly report delivered (ANM-0471)', type: 'delivery' },
      { time: '1d ago', text: 'Falcon-G1 survey completed — 94% confidence', type: 'survey' },
      { time: '3d ago', text: 'Milestone 2 payment confirmed — $2.1M', type: 'payment' },
      { time: '5d ago', text: 'Data package GeoTIFF-2024-IV uploaded', type: 'upload' },
      { time: '1w ago', text: 'Contract GS-2024-003 signed', type: 'contract' },
    ],
    messages: [
      { from: 'partner', name: 'James Rutherford', text: 'Hi team — can you confirm the delivery timeline for the Luanshya Block 4 survey?', time: '09:14' },
      { from: 'us', name: 'GeoSwarm Ops', text: 'Hi James, confirmed for Friday. Falcon-G1 is currently 73% complete over Block 4. Full data package by EOD Friday.', time: '09:31' },
      { from: 'partner', name: 'James Rutherford', text: 'Excellent. Will the report include the seismic interpretation layer?', time: '10:05' },
      { from: 'us', name: 'GeoSwarm Ops', text: 'Yes — we\'re adding the 3D seismic interpretation. ANM-0471 shows strong copper anomaly at ~340m depth. You\'ll want to see this.', time: '10:22' },
      { from: 'partner', name: 'James Rutherford', text: 'Brilliant. Please also add a section on the fault corridor at -12.8°S. We flagged that in the last review.', time: '11:45' },
    ],
  },
  {
    id: 'fqm', name: 'First Quantum Minerals', country: 'Zambia', flag: '🇿🇲',
    contracts: 2, km2: 2800, status: 'Active',
    stats: { investment: '$7.2M', surveys: 4, packages: 7 },
    color: 'bg-blue-500',
    contracts_list: [
      { id: 'GS-2024-004', type: 'Aeromagnetic Survey', area: '1,200 km²', status: 'Active', value: '$3.6M', delivery: '2025-02-28' },
      { id: 'GS-2024-005', type: 'Hyperspectral', area: '1,600 km²', status: 'Planning', value: '$3.6M', delivery: '2025-04-30' },
    ],
    activity: [
      { time: '4h ago', text: 'Roan Antelope survey phase 1 complete', type: 'survey' },
      { time: '2d ago', text: 'Contract GS-2024-005 approved', type: 'contract' },
      { time: '4d ago', text: '3D model exported — Roan Antelope West', type: 'delivery' },
      { time: '1w ago', text: 'Site access confirmed for Jan 2025', type: 'upload' },
      { time: '2w ago', text: 'Initial payment received — $1.8M', type: 'payment' },
    ],
    messages: [
      { from: 'partner', name: 'Sarah Mkandawire', text: 'When can we expect the Phase 1 results from Roan Antelope?', time: '14:30' },
      { from: 'us', name: 'GeoSwarm Ops', text: 'Phase 1 is complete — data is in processing. Full report by Wednesday next week.', time: '15:01' },
      { from: 'partner', name: 'Sarah Mkandawire', text: 'Perfect. Can you include the cobalt probability layer we discussed?', time: '15:45' },
    ],
  },
  {
    id: 'anglo', name: 'Anglo American', country: 'United Kingdom', flag: '🇬🇧',
    contracts: 1, km2: 950, status: 'Active',
    stats: { investment: '$2.9M', surveys: 2, packages: 3 },
    color: 'bg-red-500',
    contracts_list: [
      { id: 'GS-2024-006', type: 'Gravity + Aeromagnetic', area: '950 km²', status: 'Active', value: '$2.9M', delivery: '2025-01-15' },
    ],
    activity: [
      { time: '1d ago', text: 'Kolwezi survey corridor approved', type: 'survey' },
      { time: '3d ago', text: 'NDA updated and countersigned', type: 'contract' },
      { time: '1w ago', text: 'Technical kickoff meeting completed', type: 'upload' },
    ],
    messages: [
      { from: 'partner', name: 'David Okonkwo', text: 'We need the survey footprint to cover the extended DRC corridor — can you revise the scope?', time: '08:00' },
      { from: 'us', name: 'GeoSwarm Ops', text: 'Reviewing the revised coordinates now. We can extend 120km² at no additional cost given our deployment window.', time: '08:45' },
    ],
  },
  {
    id: 'endeavour', name: 'Endeavour Mining', country: 'Canada', flag: '🇨🇦',
    contracts: 2, km2: 1750, status: 'Active',
    stats: { investment: '$5.1M', surveys: 3, packages: 5 },
    color: 'bg-yellow-500',
    contracts_list: [
      { id: 'GS-2024-007', type: 'Hyperspectral', area: '750 km²', status: 'Complete', value: '$2.2M', delivery: '2024-10-15' },
      { id: 'GS-2024-008', type: 'Aeromagnetic', area: '1,000 km²', status: 'Active', value: '$2.9M', delivery: '2025-02-01' },
    ],
    activity: [
      { time: '3h ago', text: 'Geita Gold Block 7 survey underway', type: 'survey' },
      { time: '2d ago', text: 'Final payment for GS-2024-007 received', type: 'payment' },
      { time: '5d ago', text: 'Hyperspectral report — 8 mineral targets', type: 'delivery' },
    ],
    messages: [
      { from: 'partner', name: 'Pierre Leconte', text: 'Hyperspectral results look impressive — particularly the gold anomaly cluster at Geita Block 7.', time: '16:20' },
      { from: 'us', name: 'GeoSwarm Ops', text: 'Agreed — 8 high-confidence targets identified. Block 7 is the strongest signal. We recommend prioritising that for Phase 2.', time: '16:55' },
    ],
  },
  {
    id: 'hummingbird', name: 'Hummingbird Resources', country: 'United Kingdom', flag: '🇬🇧',
    contracts: 0, km2: 0, status: 'Pending',
    stats: { investment: '$0', surveys: 0, packages: 0 },
    color: 'bg-purple-500',
    contracts_list: [],
    activity: [
      { time: '1d ago', text: 'Proposal sent — Yanfolila corridor survey', type: 'upload' },
      { time: '3d ago', text: 'Introductory call completed', type: 'contract' },
    ],
    messages: [
      { from: 'partner', name: 'Thomas Briggs', text: 'We\'ve reviewed your proposal for the Yanfolila corridor. Very interested — can we schedule a technical walkthrough?', time: '11:00' },
      { from: 'us', name: 'GeoSwarm Ops', text: 'Absolutely. Our technical lead is available Thursday or Friday this week.', time: '11:30' },
    ],
  },
];

const TABS = ['Overview', 'Contracts', 'Deliverables', 'Messages'] as const;
type Tab = typeof TABS[number];

const activityIcon: Record<string, string> = {
  delivery: '📦', survey: '✈', payment: '💳', upload: '📁', contract: '📋',
};

const statusColors: Record<string, string> = {
  Active: 'text-scan-green bg-scan-green/10 border-scan-green/30',
  Complete: 'text-geo-mist bg-geo-graphite border-geo-steel',
  Processing: 'text-signal-medium bg-signal-medium/10 border-signal-medium/30',
  Planning: 'text-brand-primary bg-brand-primary/10 border-brand-primary/30',
};

export default function PartnersPage() {
  const [selectedId, setSelectedId] = useState('ivanhoe');
  const [tab, setTab] = useState<Tab>('Overview');
  const [message, setMessage] = useState('');

  const partner = PARTNERS.find(p => p.id === selectedId) ?? PARTNERS[0];

  return (
    <div className="flex h-full">
      {/* Left: partner list */}
      <aside className="w-80 flex-shrink-0 border-r border-geo-steel flex flex-col">
        <div className="p-4 border-b border-geo-steel">
          <h2 className="font-display font-semibold text-geo-white text-sm">Partner Portfolio</h2>
          <p className="text-[10px] text-geo-mist mt-0.5">{PARTNERS.filter(p => p.status === 'Active').length} active · {PARTNERS.filter(p => p.status === 'Pending').length} pending</p>
          <input
            type="text" placeholder="Search partners…"
            className="w-full mt-3 h-8 px-3 bg-geo-graphite border border-geo-steel rounded-lg text-xs text-geo-cloud placeholder-geo-mist focus:outline-none focus:border-drone-primary/50"
          />
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-geo-steel/40">
          {PARTNERS.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={`w-full text-left px-4 py-3.5 hover:bg-geo-graphite/40 transition-all duration-150 ${selectedId === p.id ? 'bg-geo-graphite/60 border-l-2 border-l-drone-primary' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl ${p.color} flex items-center justify-center flex-shrink-0`}>
                  <span className="text-white font-bold text-sm">{p.name[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm text-geo-white truncate">{p.name}</p>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ml-2 flex-shrink-0 ${p.status === 'Active' ? 'text-scan-green bg-scan-green/10 border-scan-green/30' : 'text-geo-mist bg-geo-graphite border-geo-steel'}`}>
                      {p.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-geo-mist truncate mt-0.5">{p.flag} {p.country}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-geo-mist">{p.contracts} contracts</span>
                    <span className="text-[10px] text-drone-primary">{p.km2.toLocaleString()} km²</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Right: detail panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Partner header */}
        <div className="px-6 py-4 border-b border-geo-steel bg-geo-slate/50 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${partner.color} flex items-center justify-center`}>
              <span className="text-white font-bold text-lg">{partner.name[0]}</span>
            </div>
            <div>
              <h2 className="font-display font-bold text-geo-white text-lg">{partner.name}</h2>
              <p className="text-xs text-geo-mist">{partner.flag} {partner.country}</p>
            </div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${partner.status === 'Active' ? 'text-scan-green bg-scan-green/10 border-scan-green/30' : 'text-geo-mist bg-geo-graphite border-geo-steel'}`}>
              {partner.status}
            </span>
          </div>
          <button className="h-8 px-4 bg-drone-primary hover:bg-drone-dark text-white text-xs font-semibold rounded-lg transition-all">
            Generate Report
          </button>
        </div>

        {/* Stats pills */}
        <div className="px-6 py-3 border-b border-geo-steel flex gap-4 flex-shrink-0">
          {[
            { label: 'Total Investment', value: partner.stats.investment },
            { label: 'Surveys Completed', value: partner.stats.surveys.toString() },
            { label: 'Data Packages', value: partner.stats.packages.toString() },
          ].map(s => (
            <div key={s.label} className="bg-geo-graphite border border-geo-steel rounded-lg px-4 py-2">
              <p className="text-[10px] text-geo-mist uppercase tracking-wide">{s.label}</p>
              <p className="font-mono font-bold text-geo-white text-sm mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="px-6 border-b border-geo-steel flex gap-1 flex-shrink-0 bg-geo-slate/30">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-xs font-medium border-b-2 transition-all duration-150 ${tab === t ? 'border-drone-primary text-drone-primary' : 'border-transparent text-geo-mist hover:text-geo-cloud'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'Overview' && (
            <div className="space-y-5">
              {/* Territory map placeholder */}
              <div className="bg-geo-slate border border-geo-steel rounded-xl overflow-hidden h-40 relative">
                <svg className="w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <line key={`h${i}`} x1="0" y1={`${16.66*(i+1)}%`} x2="100%" y2={`${16.66*(i+1)}%`} stroke="#0EA5E9" strokeWidth="0.5" />
                  ))}
                  {Array.from({ length: 8 }).map((_, i) => (
                    <line key={`v${i}`} x1={`${12.5*(i+1)}%`} y1="0" x2={`${12.5*(i+1)}%`} y2="100%" stroke="#0EA5E9" strokeWidth="0.5" />
                  ))}
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <a href="/map" className="text-xs text-drone-primary hover:underline">View in 3D Map →</a>
                </div>
                <div className="absolute top-3 left-3 text-[10px] font-mono text-geo-mist bg-geo-graphite/80 px-2 py-1 rounded">
                  Territory Overview · {partner.km2.toLocaleString()} km²
                </div>
              </div>

              {/* Recent activity */}
              <div>
                <h3 className="font-display font-semibold text-geo-white text-sm mb-3">Recent Activity</h3>
                <div className="space-y-2">
                  {partner.activity.map((a, i) => (
                    <div key={i} className="flex items-start gap-3 bg-geo-graphite/40 rounded-lg px-3 py-2.5">
                      <span className="text-base flex-shrink-0">{activityIcon[a.type]}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-geo-cloud">{a.text}</p>
                        <p className="text-[10px] text-geo-mist mt-0.5">{a.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'Contracts' && (
            <div>
              {partner.contracts_list.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-geo-mist text-sm">No contracts yet.</p>
                  <button className="mt-3 text-xs text-drone-primary hover:underline">Create first contract →</button>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] text-geo-mist uppercase tracking-wide border-b border-geo-steel">
                      {['Contract ID', 'Survey Type', 'Area', 'Status', 'Value', 'Delivery'].map(h => (
                        <th key={h} className="text-left pb-3 pr-4">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-geo-steel/40">
                    {partner.contracts_list.map(c => (
                      <tr key={c.id} className="hover:bg-geo-graphite/40">
                        <td className="font-mono text-xs text-drone-primary py-3 pr-4">{c.id}</td>
                        <td className="text-xs text-geo-cloud py-3 pr-4">{c.type}</td>
                        <td className="font-mono text-xs text-geo-mist py-3 pr-4">{c.area}</td>
                        <td className="py-3 pr-4">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusColors[c.status] ?? 'bg-geo-graphite text-geo-mist border-geo-steel'}`}>{c.status}</span>
                        </td>
                        <td className="font-mono text-xs text-scan-green py-3 pr-4">{c.value}</td>
                        <td className="font-mono text-xs text-geo-mist py-3">{c.delivery}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === 'Deliverables' && (
            <div className="grid grid-cols-2 gap-3">
              {['GeoTIFF Mosaic', 'Anomaly CSV', '3D Terrain Model', 'Interpretation Report', 'Raw Sensor Data', 'NI 43-101 Input Package'].map((name, i) => (
                <div key={name} className="bg-geo-slate border border-geo-steel rounded-xl p-4 hover:border-drone-primary/30 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 rounded-lg bg-geo-graphite border border-geo-steel flex items-center justify-center">
                      <svg className="w-4 h-4 text-drone-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                    </div>
                    <span className="text-[10px] font-medium text-scan-green bg-scan-green/10 border border-scan-green/30 px-2 py-0.5 rounded-full">Delivered</span>
                  </div>
                  <p className="font-display font-semibold text-geo-white text-xs mb-1">{name}</p>
                  <p className="text-[10px] text-geo-mist mb-3">{['128MB', '2.4MB', '840MB', '4.2MB', '2.1GB', '34MB'][i]} · v{i + 1}.0 · Nov 2024</p>
                  <div className="flex gap-2">
                    <button className="flex-1 h-7 bg-geo-graphite hover:bg-drone-primary/10 border border-geo-steel hover:border-drone-primary/40 text-geo-cloud text-[10px] rounded-lg transition-all">
                      Preview
                    </button>
                    <button className="flex-1 h-7 bg-drone-primary hover:bg-drone-dark text-white text-[10px] font-semibold rounded-lg transition-all">
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'Messages' && (
            <div className="flex flex-col h-full">
              <div className="flex-1 space-y-4 mb-4">
                {partner.messages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.from === 'us' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white ${msg.from === 'us' ? 'bg-drone-primary' : partner.color}`}>
                      {msg.name[0]}
                    </div>
                    <div className={`max-w-[70%] ${msg.from === 'us' ? 'items-end' : 'items-start'} flex flex-col`}>
                      <p className="text-[10px] text-geo-mist mb-1">{msg.name} · {msg.time}</p>
                      <div className={`rounded-xl px-3.5 py-2.5 text-sm ${msg.from === 'us' ? 'bg-drone-primary text-white rounded-tr-sm' : 'bg-geo-graphite text-geo-cloud border border-geo-steel rounded-tl-sm'}`}>
                        {msg.text}
                      </div>
                    </div>
                  </div>
                ))}
                {/* Typing indicator */}
                <div className="flex gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white ${partner.color}`}>
                    {partner.name[0]}
                  </div>
                  <div className="bg-geo-graphite border border-geo-steel rounded-xl rounded-tl-sm px-4 py-3 flex gap-1 items-center">
                    {[0, 0.2, 0.4].map((delay, i) => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-geo-mist animate-bounce" style={{ animationDelay: `${delay}s` }} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Message input */}
              <div className="flex gap-2 border-t border-geo-steel pt-4 flex-shrink-0">
                <button className="h-10 px-3 bg-geo-graphite border border-geo-steel rounded-lg text-geo-mist hover:text-geo-cloud transition-all">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                  </svg>
                </button>
                <input
                  type="text"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Type a message…"
                  className="flex-1 h-10 px-4 bg-geo-graphite border border-geo-steel rounded-lg text-sm text-geo-cloud placeholder-geo-mist focus:outline-none focus:border-drone-primary/50"
                  onKeyDown={e => { if (e.key === 'Enter') setMessage(''); }}
                />
                <button
                  onClick={() => setMessage('')}
                  className="h-10 px-4 bg-drone-primary hover:bg-drone-dark text-white text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
