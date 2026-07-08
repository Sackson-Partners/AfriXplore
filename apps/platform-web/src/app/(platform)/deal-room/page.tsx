'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const DEALS = [
  { id: 'd1', name: 'Luanshya Copper Extension', partner: 'Ivanhoe Mines', value: '$4.2M', stage: 'Due Diligence', progress: 67, daysLeft: 18, color: 'bg-amber-500', milestone: 3 },
  { id: 'd2', name: 'Geita Gold Block 7', partner: 'AngloGold Ashanti', value: '$8.7M', stage: 'Active', progress: 23, daysLeft: 45, color: 'bg-yellow-500', milestone: 1 },
  { id: 'd3', name: 'Kolwezi Cobalt Joint Venture', partner: 'Glencore', value: '$22M', stage: 'Closing', progress: 89, daysLeft: 7, color: 'bg-blue-500', milestone: 5 },
  { id: 'd4', name: 'Roan Antelope Restart', partner: 'First Quantum', value: '$3.1M', stage: 'Active', progress: 45, daysLeft: 32, color: 'bg-emerald-500', milestone: 2 },
  { id: 'd5', name: 'Kamoa Copper Expansion', partner: 'Ivanhoe Mines', value: '$15M', stage: 'Completed', progress: 100, daysLeft: 0, color: 'bg-amber-500', milestone: 6 },
];

const MILESTONES = ['NDA Signed', 'LOI Submitted', 'Due Diligence', 'Term Sheet', 'Final Agreement', 'Closed'];

const STAGE_COLORS: Record<string, string> = {
  'Due Diligence': 'text-signal-medium bg-signal-medium/10 border-signal-medium/30',
  'Active': 'text-drone-primary bg-drone-primary/10 border-drone-primary/30',
  'Closing': 'text-scan-green bg-scan-green/10 border-scan-green/30',
  'Completed': 'text-geo-mist bg-geo-graphite border-geo-steel',
};

const MESSAGES_BY_DEAL: Record<string, Array<{ from: string; name: string; text: string; time: string; read: boolean }>> = {
  d1: [
    { from: 'partner', name: 'James Rutherford', text: 'Hi team — we\'ve completed our initial review of the Luanshya geological model. Very encouraging DPI score.', time: '09:14', read: true },
    { from: 'us', name: 'MSIM Team', text: 'Glad to hear it James. The ANM-0471 anomaly is particularly compelling — copper at ~340m depth, 94% confidence.', time: '09:31', read: true },
    { from: 'partner', name: 'James Rutherford', text: 'Can you share the full seismic interpretation? We\'d like our geological team to review before signing the LOI.', time: '10:05', read: true },
    { from: 'us', name: 'MSIM Team', text: 'Uploading to the Data Room now — file: LUA-2024-SEISMIC-INTERPRETATION.pdf, Tier 2 access. Let me know once your team reviews.', time: '10:22', read: true },
    { from: 'partner', name: 'James Rutherford', text: 'Received. We\'ll schedule an internal review for Friday and come back to you early next week.', time: '11:45', read: false },
  ],
  d2: [
    { from: 'partner', name: 'Sarah Osei', text: 'Good morning — confirming receipt of the Geita Block 7 initial anomaly report.', time: '08:30', read: true },
    { from: 'us', name: 'MSIM Team', text: 'Morning Sarah — 8 high-confidence targets in Block 7. Gold and silver primary commodities. DPI range 71-89.', time: '09:00', read: true },
    { from: 'partner', name: 'Sarah Osei', text: 'Impressive. Can we fast-track the LOI for Block 7A specifically?', time: '14:20', read: false },
  ],
  d3: [], d4: [], d5: [],
};

const DOCS_BY_DEAL: Record<string, Array<{ name: string; version: string; status: 'draft' | 'review' | 'signed'; signatories: string[] }>> = {
  d1: [
    { name: 'Non-Disclosure Agreement', version: 'v2.1', status: 'signed', signatories: ['J. Rutherford', 'MSIM Legal'] },
    { name: 'Letter of Intent', version: 'v1.3', status: 'review', signatories: ['J. Rutherford', 'MSIM Legal'] },
    { name: 'Technical Data License', version: 'v1.0', status: 'draft', signatories: [] },
    { name: 'JV Agreement Draft', version: 'v0.9', status: 'draft', signatories: [] },
    { name: 'Confidentiality Extension', version: 'v1.1', status: 'signed', signatories: ['J. Rutherford', 'MSIM Legal'] },
  ],
  d2: [
    { name: 'Non-Disclosure Agreement', version: 'v1.0', status: 'signed', signatories: ['S. Osei', 'MSIM Legal'] },
    { name: 'Letter of Intent', version: 'v0.5', status: 'draft', signatories: [] },
    { name: 'Technical Data License', version: 'v1.0', status: 'draft', signatories: [] },
    { name: 'JV Agreement Draft', version: 'v0.2', status: 'draft', signatories: [] },
    { name: 'Confidentiality Extension', version: 'v1.0', status: 'draft', signatories: [] },
  ],
  d3: [], d4: [], d5: [],
};

const TASKS = {
  todo: [
    { title: 'Review seismic interpretation', assignee: 'GL', priority: 'high', due: 'Dec 6' },
    { title: 'Draft term sheet', assignee: 'LC', priority: 'medium', due: 'Dec 10' },
    { title: 'Schedule site visit', assignee: 'PL', priority: 'low', due: 'Dec 15' },
  ],
  inProgress: [
    { title: 'DPI model validation', assignee: 'GL', priority: 'high', due: 'Dec 3' },
    { title: 'Environmental baseline', assignee: 'FA', priority: 'medium', due: 'Dec 8' },
  ],
  done: [
    { title: 'Initial NDA signed', assignee: 'LC', priority: 'high', due: 'Nov 20' },
    { title: 'Partner KYC complete', assignee: 'PL', priority: 'medium', due: 'Nov 22' },
    { title: 'LOI draft reviewed', assignee: 'FA', priority: 'high', due: 'Nov 28' },
  ],
};

const ACTIVITY = [
  { icon: '📄', text: 'LOI v1.3 sent for review by J. Rutherford', time: '2h ago', color: 'text-brand-primary' },
  { icon: '💬', text: 'New message from James Rutherford (Ivanhoe)', time: '3h ago', color: 'text-drone-primary' },
  { icon: '✅', text: 'NDA countersigned — deal milestone 1 complete', time: '1d ago', color: 'text-scan-green' },
  { icon: '📁', text: 'Seismic interpretation PDF uploaded to Data Room', time: '1d ago', color: 'text-geo-mist' },
  { icon: '📊', text: 'DPI updated: Luanshya Block 4 → 94 (+3)', time: '2d ago', color: 'text-copper-light' },
  { icon: '✈', text: 'GeoSwarm Falcon-G1 survey complete — 12 anomalies', time: '3d ago', color: 'text-drone-primary' },
  { icon: '💰', text: 'Milestone 1 payment received — $840K', time: '4d ago', color: 'text-scan-green' },
  { icon: '🤝', text: 'Partner KYC verification approved', time: '5d ago', color: 'text-geo-mist' },
  { icon: '📋', text: 'Deal intake form completed', time: '1w ago', color: 'text-geo-mist' },
  { icon: '🚀', text: 'Deal created — Luanshya Copper Extension', time: '1w ago', color: 'text-brand-primary' },
];

const INGESTION = [
  { name: 'LUA-GEOLOGICAL-REPORT-2024.pdf', size: '45 MB', stage: 4, entities: ['Luanshya Mine', '-12.45°S', 'DPI: 94', 'Copper'] },
  { name: 'AEROMAGNETIC-SURVEY-Q4.tif', size: '128 MB', stage: 2, entities: [] },
  { name: 'DRILL-CORE-ASSAY-2023.csv', size: '2.4 MB', stage: 5, entities: ['Cu 3.2%', 'Co 0.8%', '340m depth', '12 intercepts'] },
  { name: 'FEASIBILITY-STUDY-V3.docx', size: '12 MB', stage: 3, entities: [] },
];

const PIPELINE_STAGES = ['Upload', 'OCR', 'Classify', 'Extract', 'Indexed'];

type MainTab = 'overview' | 'messenger' | 'edocs' | 'collab' | 'ingestion';

export default function DealRoomPage() {
  const isAuthenticated = useAuth();
  const router = useRouter();
  const [selectedDeal, setSelectedDeal] = useState('d1');
  const [tab, setTab] = useState<MainTab>('overview');
  const [message, setMessage] = useState('');
  const [stageFilter, setStageFilter] = useState('All');
  const [signModal, setSignModal] = useState(false);
  const [signName, setSignName] = useState('');

  useEffect(() => {
    if (!isAuthenticated) router.replace('/');
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  const deal = DEALS.find(d => d.id === selectedDeal) ?? DEALS[0];
  const messages = MESSAGES_BY_DEAL[selectedDeal] ?? [];
  const docs = DOCS_BY_DEAL[selectedDeal] ?? [];

  const filtered = DEALS.filter(d => stageFilter === 'All' || d.stage === stageFilter);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: deal list */}
      <aside className="w-72 flex-shrink-0 border-r border-geo-steel flex flex-col bg-geo-slate/30">
        <div className="px-4 py-4 border-b border-geo-steel flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold text-geo-white text-sm">Deal Pipeline</h2>
            <button className="h-7 px-2.5 bg-brand-primary hover:bg-brand-hover text-white text-[10px] font-semibold rounded-lg transition-all">
              + New Deal
            </button>
          </div>
          <div className="flex gap-1 flex-wrap">
            {['All', 'Active', 'Due Diligence', 'Closing'].map(s => (
              <button key={s} onClick={() => setStageFilter(s)}
                className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${stageFilter === s ? 'bg-brand-primary text-white' : 'text-geo-mist hover:text-geo-cloud'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-geo-steel/30">
          {filtered.map(d => (
            <button key={d.id} onClick={() => setSelectedDeal(d.id)}
              className={`w-full text-left px-4 py-4 hover:bg-geo-graphite/40 transition-all ${selectedDeal === d.id ? 'bg-geo-graphite/60 border-l-2 border-l-brand-primary' : ''}`}>
              <div className="flex items-center gap-2.5 mb-2">
                <div className={`w-7 h-7 rounded-lg ${d.color} flex items-center justify-center flex-shrink-0`}>
                  <span className="text-white font-bold text-[10px]">{d.partner[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-xs text-geo-white truncate">{d.name}</p>
                  <p className="text-[10px] text-geo-mist">{d.partner}</p>
                </div>
              </div>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${STAGE_COLORS[d.stage] ?? ''}`}>{d.stage}</span>
                <span className="font-mono text-[10px] text-scan-green">{d.value}</span>
              </div>
              <div className="h-1 bg-geo-graphite rounded-full overflow-hidden">
                <div className="h-full bg-brand-primary rounded-full transition-all" style={{ width: `${d.progress}%` }} />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-geo-mist">{d.progress}% complete</span>
                {d.daysLeft > 0 && <span className="text-[9px] text-signal-medium">{d.daysLeft}d left</span>}
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Center workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Deal header */}
        <div className="px-5 py-3.5 border-b border-geo-steel bg-geo-slate/50 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${deal.color} flex items-center justify-center`}>
              <span className="text-white font-bold text-sm">{deal.partner[0]}</span>
            </div>
            <div>
              <h2 className="font-display font-bold text-geo-white text-base leading-tight">{deal.name}</h2>
              <p className="text-[11px] text-geo-mist">{deal.partner}</p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${STAGE_COLORS[deal.stage] ?? ''}`}>{deal.stage}</span>
            <span className="font-mono font-bold text-scan-green text-sm">{deal.value}</span>
          </div>
          <div className="flex gap-2">
            {['Edit', 'Share', 'Archive'].map(a => (
              <button key={a} className="h-8 px-3 bg-geo-graphite hover:bg-geo-steel border border-geo-steel text-geo-cloud text-xs rounded-lg transition-all">{a}</button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 border-b border-geo-steel flex gap-0.5 bg-geo-slate/20 flex-shrink-0">
          {([
            { id: 'overview', label: 'Overview' },
            { id: 'messenger', label: 'Messenger' },
            { id: 'edocs', label: 'E-Documents' },
            { id: 'collab', label: 'Collaboration' },
            { id: 'ingestion', label: 'Doc Ingestion' },
          ] as { id: MainTab; label: string }[]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-xs font-medium border-b-2 transition-all ${tab === t.id ? 'border-brand-primary text-brand-primary' : 'border-transparent text-geo-mist hover:text-geo-cloud'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-5">

          {tab === 'overview' && (
            <div className="space-y-5">
              {/* KPI cards */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Deal Value', value: deal.value, color: 'text-scan-green' },
                  { label: 'Survey Area', value: '1,400 km²', color: 'text-drone-primary' },
                  { label: 'Target DPI', value: '94', color: 'text-copper-light' },
                  { label: 'Proj. Return', value: '3.2×', color: 'text-brand-primary' },
                ].map(k => (
                  <div key={k.label} className="bg-geo-slate border border-geo-steel rounded-xl p-3">
                    <p className="text-[10px] text-geo-mist uppercase tracking-wide">{k.label}</p>
                    <p className={`font-mono font-bold text-xl mt-1 ${k.color}`}>{k.value}</p>
                  </div>
                ))}
              </div>

              {/* GeoSwarm drone data */}
              <div className="bg-drone-primary/5 border border-drone-primary/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-drone-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                    <h3 className="font-display font-semibold text-drone-primary text-sm">GeoSwarm Survey Data</h3>
                  </div>
                  <a href="http://localhost:5004/dashboard" target="_blank" rel="noreferrer" className="text-[10px] text-drone-primary hover:underline flex items-center gap-1">
                    View in GeoSwarm →
                  </a>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Last Survey', value: 'Nov 28, 2024' },
                    { label: 'Anomalies Found', value: '12' },
                    { label: 'Confidence', value: '94%' },
                    { label: 'Survey Type', value: 'Aeromagnetic' },
                  ].map(s => (
                    <div key={s.label} className="bg-geo-graphite rounded-lg p-2.5">
                      <p className="text-[9px] text-geo-mist uppercase tracking-wide">{s.label}</p>
                      <p className="font-mono text-xs text-drone-primary font-semibold mt-0.5">{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Milestone stepper */}
              <div>
                <h3 className="font-display font-semibold text-geo-white text-sm mb-3">Deal Milestones</h3>
                <div className="flex items-center gap-0">
                  {MILESTONES.map((m, i) => (
                    <div key={m} className="flex items-center flex-1">
                      <div className={`flex flex-col items-center flex-1 ${i === MILESTONES.length - 1 ? '' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all ${i < deal.milestone ? 'bg-brand-primary border-brand-primary text-white' : i === deal.milestone ? 'border-brand-primary text-brand-primary bg-brand-primary/10' : 'border-geo-steel text-geo-mist'}`}>
                          {i < deal.milestone ? '✓' : i + 1}
                        </div>
                        <p className={`text-[9px] mt-1.5 text-center max-w-[60px] leading-snug ${i <= deal.milestone ? 'text-geo-cloud' : 'text-geo-mist'}`}>{m}</p>
                      </div>
                      {i < MILESTONES.length - 1 && (
                        <div className={`h-0.5 flex-1 mb-5 ${i < deal.milestone - 1 ? 'bg-brand-primary' : 'bg-geo-steel'}`} />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Partner contact */}
              <div className="bg-geo-slate border border-geo-steel rounded-xl p-4">
                <h3 className="font-display font-semibold text-geo-white text-sm mb-3">Partner Contact</h3>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl ${deal.color} flex items-center justify-center`}>
                    <span className="text-white font-bold">{deal.partner[0]}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-geo-white">James Rutherford</p>
                    <p className="text-xs text-geo-mist">VP Exploration · {deal.partner}</p>
                    <div className="flex gap-3 mt-1.5">
                      <span className="text-[10px] text-geo-mist font-mono">j.rutherford@ivanhoe.com</span>
                      <span className="text-[10px] text-geo-mist font-mono">+27 11 514 2222</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'messenger' && (
            <div className="flex flex-col h-full" style={{ minHeight: '500px' }}>
              <div className="flex-1 space-y-4 pb-4">
                {messages.length === 0 ? (
                  <div className="text-center py-12 text-geo-mist text-sm">No messages yet for this deal.</div>
                ) : (
                  messages.map((msg, i) => (
                    <div key={i} className={`flex gap-3 ${msg.from === 'us' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white ${msg.from === 'us' ? 'bg-brand-primary' : deal.color}`}>
                        {msg.name[0]}
                      </div>
                      <div className={`max-w-[68%] flex flex-col ${msg.from === 'us' ? 'items-end' : 'items-start'}`}>
                        <p className="text-[10px] text-geo-mist mb-1">{msg.name} · {msg.time}</p>
                        <div className={`rounded-xl px-4 py-2.5 text-sm leading-relaxed ${msg.from === 'us' ? 'bg-brand-primary text-white rounded-tr-sm' : 'bg-geo-graphite text-geo-cloud border border-geo-steel rounded-tl-sm'}`}>
                          {msg.text}
                        </div>
                        {msg.from === 'us' && (
                          <p className="text-[9px] text-geo-mist mt-0.5">{msg.read ? '✓✓ Read' : '✓ Delivered'}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div className="flex gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white ${deal.color}`}>
                    {deal.partner[0]}
                  </div>
                  <div className="bg-geo-graphite border border-geo-steel rounded-xl rounded-tl-sm px-4 py-3 flex gap-1 items-center">
                    {[0, 0.2, 0.4].map((d, i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-geo-mist animate-bounce" style={{ animationDelay: `${d}s` }} />)}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 border-t border-geo-steel pt-4 flex-shrink-0">
                <button className="h-10 px-3 bg-geo-graphite border border-geo-steel rounded-lg text-geo-mist hover:text-geo-cloud transition-all" title="Attach document">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                  </svg>
                </button>
                <input value={message} onChange={e => setMessage(e.target.value)} placeholder="Type a message…" onKeyDown={e => e.key === 'Enter' && setMessage('')}
                  className="flex-1 h-10 px-4 bg-geo-graphite border border-geo-steel rounded-lg text-sm text-geo-cloud placeholder-geo-mist focus:outline-none focus:border-brand-primary/50" />
                <button onClick={() => setMessage('')} className="h-10 px-4 bg-brand-primary hover:bg-brand-hover text-white text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                  Send
                </button>
              </div>
            </div>
          )}

          {tab === 'edocs' && (
            <div className="space-y-4">
              {/* Progress bar */}
              <div className="bg-geo-slate border border-geo-steel rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-display font-semibold text-geo-white text-sm">Signing Progress</h3>
                  <span className="font-mono text-xs text-scan-green">{docs.filter(d => d.status === 'signed').length}/{docs.length} signed</span>
                </div>
                <div className="h-1.5 bg-geo-graphite rounded-full overflow-hidden">
                  <div className="h-full bg-scan-green rounded-full" style={{ width: `${(docs.filter(d => d.status === 'signed').length / Math.max(docs.length, 1)) * 100}%` }} />
                </div>
              </div>

              {/* Document list */}
              <div className="space-y-2">
                {docs.length === 0 ? (
                  <p className="text-center text-geo-mist text-sm py-8">No documents yet for this deal.</p>
                ) : docs.map((doc, i) => (
                  <div key={i} className={`bg-geo-slate border rounded-xl px-4 py-3.5 flex items-center gap-4 ${doc.status === 'signed' ? 'border-scan-green/20' : doc.status === 'review' ? 'border-signal-medium/20' : 'border-geo-steel'}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${doc.status === 'signed' ? 'bg-scan-green/10' : doc.status === 'review' ? 'bg-signal-medium/10' : 'bg-geo-graphite'}`}>
                      <svg className={`w-4 h-4 ${doc.status === 'signed' ? 'text-scan-green' : doc.status === 'review' ? 'text-signal-medium' : 'text-geo-mist'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm text-geo-white">{doc.name}</p>
                        <span className="text-[10px] text-geo-mist">{doc.version}</span>
                      </div>
                      {doc.signatories.length > 0 && (
                        <p className="text-[11px] text-geo-mist mt-0.5">Signatories: {doc.signatories.join(', ')}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${doc.status === 'signed' ? 'text-scan-green bg-scan-green/10 border-scan-green/30' : doc.status === 'review' ? 'text-signal-medium bg-signal-medium/10 border-signal-medium/30' : 'text-geo-mist bg-geo-graphite border-geo-steel'}`}>
                        {doc.status.toUpperCase()}
                      </span>
                      {doc.status === 'draft' && <button className="h-7 px-3 bg-signal-medium/10 text-signal-medium border border-signal-medium/30 text-[10px] font-semibold rounded-lg hover:bg-signal-medium/20 transition-all">Send for Review</button>}
                      {doc.status === 'review' && (
                        <button onClick={() => setSignModal(true)} className="h-7 px-3 bg-scan-green/10 text-scan-green border border-scan-green/30 text-[10px] font-semibold rounded-lg hover:bg-scan-green/20 transition-all flex items-center gap-1">
                          ✍ Sign Now
                        </button>
                      )}
                      {doc.status === 'signed' && <span className="text-xs text-scan-green">✓ Nov 20</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'collab' && (
            <div className="space-y-5">
              {/* Team */}
              <div>
                <h3 className="font-display font-semibold text-geo-white text-sm mb-3">Deal Team</h3>
                <div className="flex gap-3">
                  {[
                    { initials: 'GL', role: 'Geologist', name: 'Dr. M. Chirwa', color: 'bg-amber-500' },
                    { initials: 'FA', role: 'Financial Analyst', name: 'K. Mwansa', color: 'bg-blue-500' },
                    { initials: 'LC', role: 'Legal Counsel', name: 'A. Phiri', color: 'bg-emerald-500' },
                    { initials: 'PL', role: 'Project Lead', name: 'J. Mwanza', color: 'bg-violet-500' },
                    { initials: 'PX', role: 'Partner Liaison', name: 'T. Banda', color: 'bg-rose-500' },
                  ].map(m => (
                    <div key={m.initials} className="flex flex-col items-center gap-1.5">
                      <div className={`w-10 h-10 rounded-xl ${m.color} flex items-center justify-center`}>
                        <span className="text-white font-bold text-xs">{m.initials}</span>
                      </div>
                      <p className="text-[10px] text-geo-cloud text-center leading-snug max-w-[60px]">{m.role}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Task board */}
              <div>
                <h3 className="font-display font-semibold text-geo-white text-sm mb-3">Task Board</h3>
                <div className="grid grid-cols-3 gap-4">
                  {(['todo', 'inProgress', 'done'] as const).map(col => (
                    <div key={col} className="bg-geo-slate border border-geo-steel rounded-xl overflow-hidden">
                      <div className="px-3 py-2.5 border-b border-geo-steel bg-geo-graphite/30">
                        <p className="text-[10px] font-bold text-geo-mist uppercase tracking-wide">
                          {col === 'todo' ? 'To Do' : col === 'inProgress' ? 'In Progress' : 'Done'}
                        </p>
                      </div>
                      <div className="p-2 space-y-2">
                        {TASKS[col].map((task, i) => (
                          <div key={i} className="bg-geo-graphite rounded-lg p-2.5 hover:border-brand-primary/30 border border-transparent transition-all">
                            <p className="text-xs text-geo-cloud font-medium mb-1.5">{task.title}</p>
                            <div className="flex items-center justify-between">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${col === 'todo' ? 'bg-amber-500' : col === 'inProgress' ? 'bg-brand-primary' : 'bg-scan-green'}`}>{task.assignee}</div>
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${task.priority === 'high' ? 'text-signal-critical bg-signal-critical/10' : task.priority === 'medium' ? 'text-signal-medium bg-signal-medium/10' : 'text-geo-mist bg-geo-slate'}`}>{task.priority}</span>
                                <span className="text-[9px] text-geo-mist">{task.due}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                        {col === 'todo' && (
                          <button className="w-full text-center text-[10px] text-geo-mist hover:text-drone-primary py-2 transition-colors">+ Add Task</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Comments */}
              <div>
                <h3 className="font-display font-semibold text-geo-white text-sm mb-3">Team Comments</h3>
                <div className="space-y-3">
                  {[
                    { initials: 'GL', color: 'bg-amber-500', text: 'Reviewed the seismic cross-section. The fault corridor at -12.8°S is a strong fluid pathway — increases DPI. Recommend prioritising drill hole DH-12.', time: '2h ago' },
                    { initials: 'FA', color: 'bg-blue-500', text: 'Q4 cash flow model updated with revised copper price assumptions ($3.85/lb). IRR improves to 34% at full JV structure.', time: '5h ago' },
                    { initials: 'LC', color: 'bg-emerald-500', text: 'LOI draft v1.3 circulated to @FA and @GL for review. Note clause 7.2 on exclusivity — I\'ve softened the language per partner feedback.', time: '1d ago' },
                    { initials: 'PL', color: 'bg-violet-500', text: 'Site visit confirmed for Dec 12-14. Ivanhoe team flying in 5 geologists. Arranging transport from Ndola airport. @PX please coordinate with James.', time: '2d ago' },
                    { initials: 'PX', color: 'bg-rose-500', text: '@PL Confirmed — James confirmed the Ndola arrival. I\'ve booked the field camp and arranged the core shed tour.', time: '2d ago' },
                  ].map((c, i) => (
                    <div key={i} className="flex gap-3">
                      <div className={`w-7 h-7 rounded-full ${c.color} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-white font-bold text-[9px]">{c.initials}</span>
                      </div>
                      <div className="flex-1 bg-geo-graphite rounded-xl px-3.5 py-2.5">
                        <p className="text-xs text-geo-cloud">{c.text}</p>
                        <p className="text-[10px] text-geo-mist mt-1">{c.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'ingestion' && (
            <div className="space-y-5">
              {/* Upload zone */}
              <div className="border-2 border-dashed border-geo-steel rounded-xl p-8 text-center hover:border-brand-primary/40 transition-colors cursor-pointer">
                <svg className="w-10 h-10 text-geo-mist mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className="font-display font-semibold text-geo-cloud mb-1">Drop files or click to browse</p>
                <p className="text-xs text-geo-mist mb-3">Geological reports, survey data, financial models, legal documents</p>
                <div className="flex gap-2 justify-center flex-wrap">
                  {['PDF', 'GeoTIFF', 'CSV', 'DOCX', 'XLS'].map(t => (
                    <span key={t} className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-brand-primary/10 text-brand-primary border border-brand-primary/30">{t}</span>
                  ))}
                </div>
              </div>

              {/* Pipeline status */}
              <div>
                <h3 className="font-display font-semibold text-geo-white text-sm mb-3">Ingestion Pipeline</h3>
                <div className="space-y-3">
                  {INGESTION.map((file, i) => (
                    <div key={i} className="bg-geo-slate border border-geo-steel rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-mono text-[11px] text-geo-cloud font-medium">{file.name}</p>
                          <p className="text-[10px] text-geo-mist">{file.size}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${file.stage === 5 ? 'text-scan-green bg-scan-green/10 border-scan-green/30' : 'text-signal-medium bg-signal-medium/10 border-signal-medium/30'}`}>
                          {file.stage === 5 ? 'Indexed' : 'Processing'}
                        </span>
                      </div>
                      {/* Stage pipeline */}
                      <div className="flex items-center gap-0 mb-3">
                        {PIPELINE_STAGES.map((stage, si) => (
                          <div key={stage} className="flex items-center flex-1">
                            <div className={`flex flex-col items-center ${si < PIPELINE_STAGES.length - 1 ? 'flex-1' : ''}`}>
                              <div className={`w-5 h-5 rounded-full text-[8px] flex items-center justify-center font-bold ${si < file.stage ? 'bg-brand-primary text-white' : si === file.stage ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary' : 'bg-geo-graphite text-geo-mist border border-geo-steel'}`}>
                                {si < file.stage ? '✓' : si + 1}
                              </div>
                              <p className="text-[8px] text-geo-mist mt-1 text-center whitespace-nowrap">{stage}</p>
                            </div>
                            {si < PIPELINE_STAGES.length - 1 && <div className={`h-0.5 flex-1 mb-4 ${si < file.stage - 1 ? 'bg-brand-primary' : 'bg-geo-graphite'}`} />}
                          </div>
                        ))}
                      </div>
                      {file.entities.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          <span className="text-[9px] text-geo-mist mr-1">Extracted:</span>
                          {file.entities.map(e => (
                            <span key={e} className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-brand-primary/10 text-brand-primary border border-brand-primary/20">{e}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Security footer */}
        <div className="px-5 py-2 border-t border-geo-steel bg-geo-slate/30 flex items-center gap-2 flex-shrink-0">
          <svg className="w-3 h-3 text-geo-mist" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          <p className="text-[10px] text-geo-mist">AES-256 · TLS 1.3 · SOC 2 Type II · All actions are audit-logged</p>
        </div>
      </div>

      {/* Right: activity rail */}
      <aside className="w-72 flex-shrink-0 border-l border-geo-steel flex flex-col">
        <div className="px-4 py-3.5 border-b border-geo-steel flex items-center justify-between flex-shrink-0">
          <h3 className="font-display font-semibold text-geo-white text-sm">Activity</h3>
          <svg className="w-4 h-4 text-geo-mist" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-geo-steel/30">
          {ACTIVITY.map((a, i) => (
            <div key={i} className="px-4 py-3 flex gap-3">
              <span className="text-base flex-shrink-0 mt-0.5">{a.icon}</span>
              <div>
                <p className="text-xs text-geo-cloud leading-snug">{a.text}</p>
                <p className="text-[10px] text-geo-mist mt-0.5">{a.time}</p>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Sign modal */}
      {signModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSignModal(false)} />
          <div className="relative w-[420px] bg-geo-slate border border-geo-steel rounded-2xl p-6 shadow-2xl">
            <h3 className="font-display font-bold text-geo-white text-lg mb-1">Sign Document</h3>
            <p className="text-xs text-geo-mist mb-5">Letter of Intent v1.3 — Luanshya Copper Extension</p>
            <div className="mb-4">
              <label className="text-xs font-medium text-geo-cloud block mb-1.5">Full Legal Name</label>
              <input value={signName} onChange={e => setSignName(e.target.value)} placeholder="Type your full name"
                className="w-full h-10 px-3 bg-geo-graphite border border-geo-steel rounded-lg text-sm text-geo-cloud focus:outline-none focus:border-scan-green/50" />
            </div>
            <div className="mb-5">
              <label className="text-xs font-medium text-geo-cloud block mb-1.5">Signature</label>
              <div className="h-24 bg-geo-graphite border border-geo-steel rounded-xl flex items-center justify-center text-geo-mist text-sm border-dashed">
                Draw or type signature here
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setSignModal(false)} className="flex-1 h-10 bg-geo-graphite border border-geo-steel text-geo-cloud text-sm rounded-lg">Cancel</button>
              <button onClick={() => setSignModal(false)} className="flex-1 h-10 bg-scan-green hover:bg-scan-green/80 text-white text-sm font-bold rounded-lg transition-all">Confirm Signature</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
