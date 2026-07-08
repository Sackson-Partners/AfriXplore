'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const DOCUMENTS = [
  { id: 1, name: 'Luanshya Geological Report 2024', category: 'Geological', date: '2024-11-20', size: '45 MB', version: 'v3.2', tier: 1, excerpt: 'Comprehensive geological characterisation of the Luanshya Copper Extension project area, including structural mapping, alteration...' },
  { id: 2, name: 'Copperbelt Aeromagnetic Survey', category: 'Technical', date: '2024-11-18', size: '128 MB', version: 'v1.0', tier: 1, excerpt: 'High-resolution aeromagnetic data covering 2,400 km² of the Zambian Copperbelt. Processed total-field, reduced-to-pole...' },
  { id: 3, name: 'DPI Methodology White Paper', category: 'Technical', date: '2024-10-30', size: '3 MB', version: 'v4.1', tier: 1, excerpt: 'Technical description of the Discovery Probability Index (DPI) scoring system used across all MSIM mineral system assessments...' },
  { id: 4, name: 'Roan Antelope Feasibility Study', category: 'Geological', date: '2024-11-10', size: '87 MB', version: 'v2.0', tier: 2, excerpt: 'Pre-feasibility study for Roan Antelope Copper-Cobalt restart. Includes resource estimate, mining method selection...' },
  { id: 5, name: 'Q4 2024 Territory Financial Model', category: 'Financial', date: '2024-11-25', size: '12 MB', version: 'v1.4', tier: 2, excerpt: 'DCF model for the Zambian copper territory portfolio. Sensitivity analysis on copper price, LoM projections...' },
  { id: 6, name: 'JV Agreement Template', category: 'Legal', date: '2024-10-15', size: '890 KB', version: 'v2.3', tier: 2, excerpt: 'Standard joint venture agreement framework for mineral rights and exploration data sharing. Includes exclusivity...' },
  { id: 7, name: 'Kamoa Copper NI 43-101 Resource', category: 'Geological', date: '2024-11-01', size: '234 MB', version: 'v1.0', tier: 2, excerpt: 'NI 43-101 compliant mineral resource estimate for the Kamoa Copper Expansion project, prepared by SRK Consulting...' },
  { id: 8, name: 'Classified Exploration Target List', category: 'Geological', date: '2024-11-28', size: '18 MB', version: 'v5.1', tier: 3, excerpt: 'CONFIDENTIAL — Ranked exploration targets for Q1 2025 drill programme. Includes proprietary DPI rankings...' },
  { id: 9, name: 'Partner Revenue Share Model', category: 'Financial', date: '2024-11-22', size: '5 MB', version: 'v2.0', tier: 3, excerpt: 'CONFIDENTIAL — Revenue sharing calculations for all active partner agreements. Includes royalty schedules...' },
  { id: 10, name: 'Drill Core Database', category: 'Technical', date: '2024-10-20', size: '4.2 GB', version: 'v8.0', tier: 3, excerpt: 'CONFIDENTIAL — Complete assay database for 127 drill holes across 8 project areas. Primary copper-cobalt data...' },
  { id: 11, name: 'Environmental Baseline Study', category: 'Reports', date: '2024-10-28', size: '67 MB', version: 'v1.2', tier: 1, excerpt: 'Environmental and social baseline assessment for the Luanshya and Nkana corridor. Water, soil, biodiversity data...' },
  { id: 12, name: 'Regulatory Compliance Matrix', category: 'Legal', date: '2024-10-10', size: '2 MB', version: 'v3.0', tier: 2, excerpt: 'Compliance requirements across Zambia, DRC, Tanzania, and Ghana for mineral exploration and data sharing activities...' },
];

const AUDIT_LOG = [
  { time: '2024-11-29 16:44', user: 'msim-ops@afrixplore.io', action: 'DOWNLOAD', doc: 'Luanshya Geological Report 2024', ip: '41.190.12.44' },
  { time: '2024-11-29 14:22', user: 'j.rutherford@ivanhoe.com', action: 'VIEW', doc: 'DPI Methodology White Paper', ip: '196.207.44.21' },
  { time: '2024-11-29 11:05', user: 's.mkandawire@fqm.com', action: 'DOWNLOAD', doc: 'Roan Antelope Feasibility Study', ip: '41.72.88.5' },
  { time: '2024-11-28 17:31', user: 'p.leconte@endeavour.com', action: 'VIEW', doc: 'Copperbelt Aeromagnetic Survey', ip: '185.66.110.32' },
  { time: '2024-11-28 09:14', user: 'msim-ops@afrixplore.io', action: 'SHARE', doc: 'Q4 2024 Territory Financial Model', ip: '41.190.12.44' },
  { time: '2024-11-27 15:00', user: 'd.okonkwo@angloamerican.com', action: 'DOWNLOAD', doc: 'JV Agreement Template', ip: '81.128.22.43' },
];

const CATEGORY_COLORS: Record<string, string> = {
  'Geological': 'bg-amber-900/40 text-amber-400 border-amber-700/40',
  'Technical': 'bg-blue-900/40 text-blue-400 border-blue-700/40',
  'Financial': 'bg-emerald-900/40 text-emerald-400 border-emerald-700/40',
  'Legal': 'bg-violet-900/40 text-violet-400 border-violet-700/40',
  'Reports': 'bg-slate-700/40 text-slate-300 border-slate-600/40',
};

const TIER_STYLES: Record<number, { badge: string; label: string; canAccess: boolean }> = {
  1: { badge: 'text-scan-green bg-scan-green/10 border-scan-green/30', label: 'T1 Open', canAccess: true },
  2: { badge: 'text-signal-medium bg-signal-medium/10 border-signal-medium/30', label: 'T2 Standard', canAccess: true },
  3: { badge: 'text-signal-critical bg-signal-critical/10 border-signal-critical/30', label: 'T3 Restricted', canAccess: false },
};

const CATEGORIES = ['All', 'Geological', 'Financial', 'Technical', 'Legal', 'Reports'] as const;

export default function DataRoomPage() {
  const isAuthenticated = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('All');
  const [tierFilter, setTierFilter] = useState('All');
  const [auditOpen, setAuditOpen] = useState(false);
  const [ndaModal, setNdaModal] = useState(false);
  const [watermarkToast, setWatermarkToast] = useState(false);
  const [hoveredDoc, setHoveredDoc] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated) router.replace('/');
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  const filtered = DOCUMENTS.filter(d => {
    const matchSearch = search === '' || d.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === 'All' || d.category === category;
    const matchTier = tierFilter === 'All' || d.tier === parseInt(tierFilter.replace('Tier ', ''));
    return matchSearch && matchCat && matchTier;
  });

  const handleDownload = (doc: typeof DOCUMENTS[0]) => {
    if (!TIER_STYLES[doc.tier].canAccess) {
      setNdaModal(true);
    } else {
      setWatermarkToast(true);
      setTimeout(() => setWatermarkToast(false), 5000);
    }
  };

  return (
    <div className="flex h-full overflow-hidden flex-col">

      {/* Security header */}
      <div className="px-6 py-3 bg-amber-950/40 border-b border-amber-700/30 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          <div>
            <span className="font-display font-bold text-amber-400 text-xs">RESTRICTED ACCESS — Data Room</span>
            <span className="text-amber-700 text-xs ml-2">· All access is logged, watermarked, and audited. Unauthorized sharing violates your NDA.</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-signal-medium bg-signal-medium/10 border border-signal-medium/30 px-2.5 py-1 rounded-lg">Tier 2 — Standard Partner</span>
          <button onClick={() => setAuditOpen(true)} className="h-8 px-3 bg-geo-graphite hover:bg-geo-steel border border-geo-steel text-xs text-geo-cloud rounded-lg transition-all flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
            Audit Log
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-5">

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total Documents', value: '1,847', color: 'text-brand-primary' },
              { label: 'Your Access Level', value: 'Tier 2', color: 'text-signal-medium' },
              { label: 'Downloads (Session)', value: '3', color: 'text-scan-green' },
              { label: 'Pending NDA Upgrades', value: '2', color: 'text-signal-high' },
            ].map(s => (
              <div key={s.label} className="bg-geo-slate border border-geo-steel rounded-xl p-4">
                <p className="text-[10px] text-geo-mist uppercase tracking-wide mb-2">{s.label}</p>
                <p className={`font-mono font-bold text-2xl ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Filter bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search documents…"
              className="h-9 px-3 bg-geo-graphite border border-geo-steel rounded-lg text-xs text-geo-cloud placeholder-geo-mist focus:outline-none focus:border-brand-primary/50 w-52" />
            <div className="flex gap-1 flex-wrap">
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setCategory(c)}
                  className={`h-8 px-3 rounded-lg text-xs font-medium transition-all ${category === c ? 'bg-brand-primary text-white' : 'bg-geo-graphite text-geo-mist hover:text-geo-cloud border border-geo-steel'}`}>
                  {c}
                </button>
              ))}
            </div>
            <div className="flex gap-1 ml-auto">
              {['All', 'Tier 1', 'Tier 2', 'Tier 3'].map(t => (
                <button key={t} onClick={() => setTierFilter(t)}
                  className={`h-8 px-2.5 rounded-lg text-[10px] font-medium transition-all ${tierFilter === t ? 'bg-geo-graphite text-geo-white border border-geo-steel' : 'text-geo-mist hover:text-geo-cloud'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Document grid */}
          <div className="grid grid-cols-3 gap-4">
            {filtered.map(doc => {
              const tier = TIER_STYLES[doc.tier];
              const isRestricted = !tier.canAccess;
              const isHovered = hoveredDoc === doc.id;
              return (
                <div
                  key={doc.id}
                  className={`relative bg-geo-slate border rounded-xl overflow-hidden transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer ${isRestricted ? 'border-signal-critical/20' : 'border-geo-steel hover:border-brand-primary/30'}`}
                  onMouseEnter={() => setHoveredDoc(doc.id)}
                  onMouseLeave={() => setHoveredDoc(null)}
                >
                  {isRestricted && (
                    <div className="absolute inset-0 bg-geo-obsidian/65 flex items-center justify-center z-10 backdrop-blur-[2px]">
                      <div className="text-center px-4">
                        <svg className="w-7 h-7 text-signal-critical mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                        <p className="text-[10px] font-bold text-signal-critical">RESTRICTED</p>
                        <p className="text-[9px] text-geo-mist mt-0.5">Tier 3 Clearance Required</p>
                      </div>
                    </div>
                  )}

                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[doc.category] ?? 'bg-geo-graphite text-geo-mist border-geo-steel'}`}>
                        {doc.category}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${tier.badge}`}>
                        {tier.label}
                      </span>
                    </div>

                    <h3 className="font-display font-semibold text-geo-white text-sm mb-1 leading-snug">{doc.name}</h3>
                    <div className="flex items-center gap-2 text-[10px] text-geo-mist mb-2">
                      <span>{doc.date}</span>
                      <span>·</span>
                      <span>{doc.version}</span>
                      <span>·</span>
                      <span className="font-mono">{doc.size}</span>
                    </div>

                    {/* Preview excerpt on hover */}
                    <div className={`overflow-hidden transition-all duration-200 ${isHovered ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'}`}>
                      <p className="text-[10px] text-geo-mist leading-relaxed mb-2 line-clamp-3">{doc.excerpt}</p>
                    </div>

                    {!isRestricted && <p className="text-[9px] text-amber-600 mb-3">Will be watermarked on download</p>}

                    <div className="flex gap-2">
                      <button className="flex-1 h-7 bg-geo-graphite hover:bg-geo-steel border border-geo-steel text-[10px] text-geo-cloud rounded-lg transition-all flex items-center justify-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        Preview
                      </button>
                      <button onClick={() => handleDownload(doc)}
                        className={`flex-1 h-7 text-[10px] font-semibold rounded-lg transition-all ${isRestricted ? 'bg-signal-critical/10 text-signal-critical border border-signal-critical/30 hover:bg-signal-critical/20' : 'bg-brand-primary hover:bg-brand-hover text-white'}`}>
                        {isRestricted ? 'Request Access' : 'Download'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Audit log slide-over */}
      {auditOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAuditOpen(false)} />
          <div className="relative w-[420px] bg-geo-slate border-l border-geo-steel h-full overflow-y-auto shadow-xl">
            <div className="px-5 py-4 border-b border-geo-steel flex items-center justify-between sticky top-0 bg-geo-slate z-10">
              <div>
                <h3 className="font-display font-bold text-geo-white text-sm">Access Audit Log</h3>
                <p className="text-[10px] text-geo-mist mt-0.5">All actions are immutably recorded</p>
              </div>
              <button onClick={() => setAuditOpen(false)} className="text-geo-mist hover:text-geo-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-3">
              {AUDIT_LOG.map((entry, i) => (
                <div key={i} className="bg-geo-graphite rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${entry.action === 'DOWNLOAD' ? 'text-brand-primary bg-brand-primary/10 border-brand-primary/30' : entry.action === 'VIEW' ? 'text-geo-mist bg-geo-slate border-geo-steel' : 'text-signal-medium bg-signal-medium/10 border-signal-medium/30'}`}>
                      {entry.action}
                    </span>
                    <span className="font-mono text-[9px] text-geo-mist">{entry.ip}</span>
                  </div>
                  <p className="text-xs text-geo-cloud font-medium leading-snug">{entry.doc}</p>
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

      {/* NDA gate modal */}
      {ndaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setNdaModal(false)} />
          <div className="relative w-[440px] bg-geo-slate border border-signal-critical/30 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-signal-critical/10 border border-signal-critical/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-signal-critical" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <div>
                <h3 className="font-display font-bold text-geo-white">Tier 3 Access Required</h3>
                <p className="text-xs text-signal-critical">Classified document — NDA upgrade needed</p>
              </div>
            </div>
            <p className="text-sm text-geo-cloud mb-4">This document requires Tier 3 clearance. Please upload your executed Tier 3 NDA and allow 24 hours for review by the MSIM compliance team.</p>
            <div className="border-2 border-dashed border-geo-steel rounded-xl p-6 text-center mb-4 hover:border-brand-primary/40 transition-colors cursor-pointer">
              <svg className="w-7 h-7 text-geo-mist mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p className="text-xs text-geo-mist">Drop Tier 3 NDA (PDF) here or click to browse</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setNdaModal(false)} className="flex-1 h-10 bg-geo-graphite border border-geo-steel text-geo-cloud text-sm rounded-lg hover:bg-geo-steel transition-all">Cancel</button>
              <button onClick={() => setNdaModal(false)} className="flex-1 h-10 bg-brand-primary hover:bg-brand-hover text-white text-sm font-semibold rounded-lg transition-all">Request Upgrade</button>
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
              <p className="text-sm font-semibold text-geo-white">Download Watermark Notice</p>
              <p className="text-xs text-geo-mist mt-0.5">This document will be watermarked with your Partner ID and timestamp. All downloads are permanently logged and audited.</p>
              <div className="flex gap-2 mt-3">
                <button onClick={() => setWatermarkToast(false)} className="h-7 px-3 bg-brand-primary text-white text-xs font-semibold rounded-lg">Confirm</button>
                <button onClick={() => setWatermarkToast(false)} className="h-7 px-3 bg-geo-graphite text-geo-mist text-xs rounded-lg border border-geo-steel">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
