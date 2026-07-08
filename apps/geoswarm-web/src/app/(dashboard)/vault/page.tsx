'use client';

import { useState } from 'react';

const DATASETS = [
  { id: 1, name: 'LUA-2024-AEROMAGNETIC-BLOCK4.tif', type: 'GeoTIFF', partner: 'Ivanhoe Mines', size: '128 MB', date: '2024-11-28', tier: 1, category: 'Technical' },
  { id: 2, name: 'COPPERBELT-GRAVITY-SURVEY-Q4.csv', type: 'CSV', partner: 'First Quantum', size: '4.2 MB', date: '2024-11-25', tier: 1, category: 'Technical' },
  { id: 3, name: 'ROAN-ANT-3D-MODEL-V2.glb', type: '3D Model', partner: 'First Quantum', size: '840 MB', date: '2024-11-20', tier: 2, category: 'Technical' },
  { id: 4, name: 'GEITA-HYPERSPECTRAL-BLOCK7.tif', type: 'GeoTIFF', partner: 'Endeavour Mining', size: '256 MB', date: '2024-11-18', tier: 2, category: 'Technical' },
  { id: 5, name: 'INTERPRETATION-REPORT-LUA-Q4.pdf', type: 'Report', partner: 'Ivanhoe Mines', size: '4.2 MB', date: '2024-11-15', tier: 1, category: 'Reports' },
  { id: 6, name: 'ANOMALY-DATABASE-ALL-PARTNERS.csv', type: 'CSV', partner: 'Internal', size: '18 MB', date: '2024-11-12', tier: 2, category: 'Technical' },
  { id: 7, name: 'CLASSIFIED-TARGET-LIST-2024.pdf', type: 'Report', partner: 'Internal', size: '3.8 MB', date: '2024-11-10', tier: 3, category: 'Reports' },
  { id: 8, name: 'KOLWEZI-RAW-SENSOR-DRC.zip', type: 'RAW', partner: 'Anglo American', size: '2.1 GB', date: '2024-11-08', tier: 3, category: 'Technical' },
  { id: 9, name: 'REVENUE-SHARE-MODEL-2025.xlsx', type: 'CSV', partner: 'Internal', size: '890 KB', date: '2024-11-05', tier: 3, category: 'Financial' },
  { id: 10, name: 'ENV-BASELINE-ZAMBIA-2024.pdf', type: 'Report', partner: 'Multi-Partner', size: '67 MB', date: '2024-10-30', tier: 1, category: 'Reports' },
  { id: 11, name: 'DRILL-CORE-ASSAY-DATABASE.db', type: 'RAW', partner: 'Multi-Partner', size: '4.2 GB', date: '2024-10-25', tier: 3, category: 'Technical' },
  { id: 12, name: 'REGULATORY-COMPLIANCE-2024.pdf', type: 'Report', partner: 'Internal', size: '2.1 MB', date: '2024-10-20', tier: 2, category: 'Legal' },
];

const TYPE_COLORS: Record<string, string> = {
  'GeoTIFF': 'bg-blue-900/40 text-blue-400 border-blue-700/40',
  'CSV': 'bg-emerald-900/40 text-emerald-400 border-emerald-700/40',
  '3D Model': 'bg-violet-900/40 text-violet-400 border-violet-700/40',
  'Report': 'bg-amber-900/40 text-amber-400 border-amber-700/40',
  'RAW': 'bg-red-900/40 text-red-400 border-red-700/40',
};

const TIER_STYLES: Record<number, { badge: string; label: string; canAccess: boolean }> = {
  1: { badge: 'text-scan-green bg-scan-green/10 border-scan-green/30', label: 'T1 Open', canAccess: true },
  2: { badge: 'text-signal-medium bg-signal-medium/10 border-signal-medium/30', label: 'T2 Standard', canAccess: true },
  3: { badge: 'text-signal-critical bg-signal-critical/10 border-signal-critical/30', label: 'T3 Restricted', canAccess: false },
};

const AUDIT_LOG = [
  { time: '2024-11-29 14:32:01', user: 'ops@geoswarm.io', action: 'DOWNLOAD', doc: 'LUA-2024-AEROMAGNETIC-BLOCK4.tif', ip: '41.190.12.44' },
  { time: '2024-11-29 12:14:55', user: 'j.rutherford@ivanhoe.com', action: 'VIEW', doc: 'INTERPRETATION-REPORT-LUA-Q4.pdf', ip: '196.207.44.21' },
  { time: '2024-11-28 16:44:12', user: 's.mkandawire@fqm.com', action: 'DOWNLOAD', doc: 'COPPERBELT-GRAVITY-SURVEY-Q4.csv', ip: '41.72.88.5' },
  { time: '2024-11-28 09:22:30', user: 'ops@geoswarm.io', action: 'SHARE', doc: 'ROAN-ANT-3D-MODEL-V2.glb', ip: '41.190.12.44' },
  { time: '2024-11-27 17:01:44', user: 'p.leconte@endeavour.com', action: 'DOWNLOAD', doc: 'GEITA-HYPERSPECTRAL-BLOCK7.tif', ip: '185.66.110.32' },
];

export default function VaultPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [tierFilter, setTierFilter] = useState('All');
  const [auditOpen, setAuditOpen] = useState(false);
  const [ndaModal, setNdaModal] = useState(false);
  const [watermarkToast, setWatermarkToast] = useState(false);

  const types = ['All', 'GeoTIFF', 'CSV', '3D Model', 'Report', 'RAW'];
  const tiers = ['All', 'Tier 1', 'Tier 2', 'Tier 3'];

  const filtered = DATASETS.filter(d => {
    const matchSearch = search === '' || d.name.toLowerCase().includes(search.toLowerCase()) || d.partner.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'All' || d.type === typeFilter;
    const matchTier = tierFilter === 'All' || d.tier === parseInt(tierFilter.split(' ')[1]);
    return matchSearch && matchType && matchTier;
  });

  const handleDownload = (ds: typeof DATASETS[0]) => {
    if (!TIER_STYLES[ds.tier].canAccess) {
      setNdaModal(true);
    } else {
      setWatermarkToast(true);
      setTimeout(() => setWatermarkToast(false), 4000);
    }
  };

  return (
    <div className="p-6 space-y-5">

      {/* Security header */}
      <div className="bg-amber-950/30 border border-amber-700/40 rounded-xl px-5 py-4 flex items-start justify-between">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          <div>
            <p className="font-display font-bold text-amber-400 text-sm">RESTRICTED ACCESS — Data Vault</p>
            <p className="text-xs text-amber-600 mt-0.5">All access is logged, watermarked, and audited. Unauthorized sharing violates your NDA.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
          <span className="text-[10px] font-bold text-signal-medium bg-signal-medium/10 border border-signal-medium/30 px-2.5 py-1 rounded-lg">
            Tier 2 — Standard Partner
          </span>
          <button
            onClick={() => setAuditOpen(true)}
            className="h-8 px-3 bg-geo-graphite hover:bg-geo-steel border border-geo-steel text-xs text-geo-cloud rounded-lg transition-all flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
            Audit Log
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Datasets', value: '247', color: 'text-drone-primary' },
          { label: 'Storage Used', value: '1.2 TB', sub: '/ 5 TB', color: 'text-geo-cloud' },
          { label: 'Downloads (Month)', value: '34', color: 'text-scan-green' },
          { label: 'Pending Auth', value: '3', color: 'text-signal-high' },
        ].map(s => (
          <div key={s.label} className="bg-geo-slate border border-geo-steel rounded-xl p-4">
            <p className="text-[10px] text-geo-mist uppercase tracking-wide mb-2">{s.label}</p>
            <p className={`font-mono font-bold text-2xl ${s.color}`}>
              {s.value}<span className="text-sm text-geo-mist ml-0.5">{s.sub ?? ''}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search datasets…"
          className="h-9 px-3 bg-geo-graphite border border-geo-steel rounded-lg text-xs text-geo-cloud placeholder-geo-mist focus:outline-none focus:border-drone-primary/50 w-56"
        />
        <div className="flex gap-1">
          {types.map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`h-9 px-3 rounded-lg text-xs font-medium transition-all ${typeFilter === t ? 'bg-drone-primary text-white' : 'bg-geo-graphite text-geo-mist hover:text-geo-cloud border border-geo-steel'}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto">
          {tiers.map(t => (
            <button key={t} onClick={() => setTierFilter(t)}
              className={`h-9 px-3 rounded-lg text-xs font-medium transition-all ${tierFilter === t ? 'bg-geo-graphite text-geo-white border border-geo-steel' : 'text-geo-mist hover:text-geo-cloud'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Dataset grid */}
      <div className="grid grid-cols-3 gap-4">
        {filtered.map(ds => {
          const tier = TIER_STYLES[ds.tier];
          const isRestricted = !tier.canAccess;
          return (
            <div key={ds.id} className={`relative bg-geo-slate border rounded-xl overflow-hidden transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg ${isRestricted ? 'border-signal-critical/20' : 'border-geo-steel hover:border-drone-primary/30'}`}>
              {isRestricted && (
                <div className="absolute inset-0 bg-geo-obsidian/60 flex items-center justify-center z-10 backdrop-blur-[1px]">
                  <div className="text-center">
                    <svg className="w-6 h-6 text-signal-critical mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    <p className="text-[10px] font-bold text-signal-critical">RESTRICTED</p>
                    <p className="text-[9px] text-geo-mist">Tier 3 Clearance Required</p>
                  </div>
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${TYPE_COLORS[ds.type] ?? 'bg-geo-graphite text-geo-mist border-geo-steel'}`}>
                    {ds.type}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${tier.badge}`}>
                    {tier.label}
                  </span>
                </div>
                <p className="font-mono text-[10px] text-geo-cloud font-medium leading-snug mb-1 truncate" title={ds.name}>{ds.name}</p>
                <p className="text-[10px] text-geo-mist mb-3">{ds.partner} · {ds.date}</p>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[11px] text-geo-mist">{ds.size}</span>
                  {!isRestricted && <span className="text-[9px] text-amber-600">Will be watermarked</span>}
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 h-7 bg-geo-graphite hover:bg-geo-steel border border-geo-steel text-[10px] text-geo-cloud rounded-lg transition-all flex items-center justify-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Preview
                  </button>
                  <button
                    onClick={() => handleDownload(ds)}
                    className={`flex-1 h-7 text-[10px] font-semibold rounded-lg transition-all ${isRestricted ? 'bg-signal-critical/10 hover:bg-signal-critical/20 text-signal-critical border border-signal-critical/30' : 'bg-drone-primary hover:bg-drone-dark text-white'}`}
                  >
                    {isRestricted ? 'Request Access' : 'Download'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Audit log slide-over */}
      {auditOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAuditOpen(false)} />
          <div className="relative w-[420px] bg-geo-slate border-l border-geo-steel h-full overflow-y-auto shadow-xl">
            <div className="px-5 py-4 border-b border-geo-steel flex items-center justify-between sticky top-0 bg-geo-slate z-10">
              <h3 className="font-display font-bold text-geo-white text-sm">Access Audit Log</h3>
              <button onClick={() => setAuditOpen(false)} className="text-geo-mist hover:text-geo-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-3">
              {AUDIT_LOG.map((entry, i) => (
                <div key={i} className="bg-geo-graphite rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${entry.action === 'DOWNLOAD' ? 'text-drone-primary bg-drone-primary/10 border-drone-primary/30' : entry.action === 'VIEW' ? 'text-geo-mist bg-geo-slate border-geo-steel' : 'text-signal-medium bg-signal-medium/10 border-signal-medium/30'}`}>
                      {entry.action}
                    </span>
                    <span className="font-mono text-[9px] text-geo-mist">{entry.ip}</span>
                  </div>
                  <p className="font-mono text-[10px] text-geo-cloud truncate">{entry.doc}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-geo-mist">{entry.user}</span>
                    <span className="font-mono text-[9px] text-geo-mist">{entry.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* NDA Gate modal */}
      {ndaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setNdaModal(false)} />
          <div className="relative w-[440px] bg-geo-slate border border-signal-critical/30 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-signal-critical/10 border border-signal-critical/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-signal-critical" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <div>
                <h3 className="font-display font-bold text-geo-white">Tier 3 Access Required</h3>
                <p className="text-xs text-signal-critical">Restricted document</p>
              </div>
            </div>
            <p className="text-sm text-geo-cloud mb-4">This document requires Tier 3 clearance. Please upload your executed Tier 3 NDA and allow 24h for review by the GeoSwarm compliance team.</p>
            <div className="border-2 border-dashed border-geo-steel rounded-xl p-6 text-center mb-4 hover:border-drone-primary/40 transition-colors cursor-pointer">
              <svg className="w-8 h-8 text-geo-mist mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p className="text-xs text-geo-mist">Drop Tier 3 NDA PDF here or click to browse</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setNdaModal(false)} className="flex-1 h-10 bg-geo-graphite border border-geo-steel text-geo-cloud text-sm rounded-lg hover:bg-geo-steel transition-all">Cancel</button>
              <button onClick={() => setNdaModal(false)} className="flex-1 h-10 bg-drone-primary hover:bg-drone-dark text-white text-sm font-semibold rounded-lg transition-all">Request Upgrade</button>
            </div>
          </div>
        </div>
      )}

      {/* Watermark toast */}
      {watermarkToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-geo-slate border border-signal-medium/40 rounded-xl shadow-xl px-5 py-4 max-w-sm">
          <div className="flex items-start gap-3">
            <svg className="w-4 h-4 text-signal-medium flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-geo-white">Watermark Notice</p>
              <p className="text-xs text-geo-mist mt-0.5">This file will be watermarked with your Partner ID and timestamp. All downloads are tracked and audited.</p>
              <div className="flex gap-2 mt-3">
                <button onClick={() => setWatermarkToast(false)} className="h-7 px-3 bg-drone-primary text-white text-xs font-semibold rounded-lg">Confirm Download</button>
                <button onClick={() => setWatermarkToast(false)} className="h-7 px-3 bg-geo-graphite text-geo-mist text-xs rounded-lg border border-geo-steel">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
