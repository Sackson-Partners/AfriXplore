'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getArchiveDocs, type ArchiveDocument } from '@/lib/api-client';

type DocType = 'all' | 'report' | 'survey' | 'assay' | 'permit' | 'map';

// Adapt API doc to display shape
interface VaultDocument {
  id: string;
  title: string;
  mine: string;
  country: string;
  type: 'report' | 'survey' | 'assay' | 'permit' | 'map';
  year: number;
  pages: number;
  source: string;
  size: string;
  digitised: boolean;
  confidence: number;
}

function adaptDoc(d: ArchiveDocument): VaultDocument {
  const validTypes = ['report', 'survey', 'assay', 'permit', 'map'] as const;
  const type = validTypes.includes(d.document_type as typeof validTypes[number])
    ? (d.document_type as VaultDocument['type'])
    : 'report';
  return {
    id: d.id,
    title: d.title,
    mine: d.mine_name ?? '—',
    country: d.mine_country ?? d.country ?? '—',
    type,
    year: d.year ?? 0,
    pages: d.page_count ?? 0,
    source: d.author ?? '—',
    size: '—',
    digitised: d.status === 'indexed',
    confidence: d.confidence_score ?? 0,
  };
}

const TYPE_CONFIG: Record<VaultDocument['type'], { label: string; color: string; bg: string; icon: string }> = {
  report:  { label: 'Report',  color: 'text-blue-400',   bg: 'bg-blue-900/30',   icon: '📄' },
  survey:  { label: 'Survey',  color: 'text-amber-400',  bg: 'bg-amber-900/30',  icon: '🗺' },
  assay:   { label: 'Assay',   color: 'text-signal-low', bg: 'bg-signal-low/20', icon: '🔬' },
  permit:  { label: 'Permit',  color: 'text-purple-400', bg: 'bg-purple-900/30', icon: '📋' },
  map:     { label: 'Map',     color: 'text-orange-400', bg: 'bg-orange-900/30', icon: '🗾' },
};

export default function VaultPage() {
  const isAuthenticated = useAuth();
  const router = useRouter();
  const [filter, setFilter] = useState<DocType>('all');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('list');
  const [selected, setSelected] = useState<VaultDocument | null>(null);

  useEffect(() => {
    if (!isAuthenticated) router.replace('/');
  }, [isAuthenticated, router]);

  const queryParams: Record<string, string | number> = { pageSize: 100 };
  if (filter !== 'all') queryParams.type = filter;
  if (search) queryParams.search = search;

  const { data: docsResponse, isLoading } = useQuery({
    queryKey: ['archive-docs', filter, search],
    queryFn: () => getArchiveDocs(queryParams),
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) return null;

  const apiDocs = docsResponse?.data ?? [];
  const filtered = apiDocs.length > 0
    ? apiDocs.map(adaptDoc)
    : ([] as VaultDocument[]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-5 py-4 bg-geo-slate border-b border-geo-steel flex-shrink-0">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-geo-mist" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z" />
            </svg>
            <input
              type="text"
              placeholder="Search documents, mines, sources…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-geo-graphite border border-geo-steel rounded-lg text-sm text-geo-cloud placeholder-geo-mist focus:outline-none focus:border-brand-primary"
            />
          </div>
          <div className="flex gap-1 bg-geo-graphite border border-geo-steel rounded-lg p-1">
            {(['all', 'report', 'survey', 'assay', 'permit', 'map'] as const).map(t => (
              <button key={t} onClick={() => setFilter(t)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors capitalize ${filter === t ? 'bg-brand-primary text-white' : 'text-geo-mist hover:text-geo-cloud'}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-geo-graphite border border-geo-steel rounded-lg p-1">
            <button onClick={() => setView('list')} className={`p-1.5 rounded transition-colors ${view === 'list' ? 'bg-geo-steel text-geo-white' : 'text-geo-mist hover:text-geo-cloud'}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
            </button>
            <button onClick={() => setView('grid')} className={`p-1.5 rounded transition-colors ${view === 'grid' ? 'bg-geo-steel text-geo-white' : 'text-geo-mist hover:text-geo-cloud'}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
            </button>
          </div>
          <p className="text-[11px] text-geo-mist whitespace-nowrap">
            {isLoading ? 'Loading…' : `${docsResponse?.total ?? filtered.length} documents`}
          </p>
        </div>

        {/* Document list/grid */}
        <div className="flex-1 overflow-y-auto p-4 bg-geo-obsidian">
          {isLoading && (
            <div className="flex items-center justify-center py-20 text-geo-mist text-sm">Loading documents…</div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="flex items-center justify-center py-20 text-geo-mist text-sm">No documents found.</div>
          )}
          {!isLoading && view === 'list' ? (
            <div className="space-y-1.5">
              {filtered.map(doc => {
                const cfg = TYPE_CONFIG[doc.type];
                const isSelected = selected?.id === doc.id;
                return (
                  <div
                    key={doc.id}
                    onClick={() => setSelected(isSelected ? null : doc)}
                    className={`flex items-center gap-4 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-brand-primary bg-brand-primary/5'
                        : 'border-geo-steel bg-geo-slate hover:bg-geo-graphite hover:border-geo-mist'
                    }`}
                  >
                    <span className="text-xl">{cfg.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-geo-white truncate">{doc.title}</p>
                      <p className="text-[11px] text-geo-mist mt-0.5">{doc.mine} · {doc.country} · {doc.source}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                      <span className="font-mono text-[10px] text-geo-mist">{doc.year}</span>
                      <span className="font-mono text-[10px] text-geo-mist">{doc.pages}p</span>
                      <span className="font-mono text-[10px] text-geo-mist w-14 text-right">{doc.size}</span>
                      {!doc.digitised && (
                        <span className="text-[9px] bg-signal-medium/20 text-signal-medium px-1.5 py-0.5 rounded">PENDING</span>
                      )}
                      <div className="flex items-center gap-1 w-16">
                        <div className="flex-1 h-1 bg-geo-graphite rounded-full overflow-hidden">
                          <div className="h-full bg-brand-primary rounded-full" style={{ width: `${doc.confidence}%` }} />
                        </div>
                        <span className="font-mono text-[9px] text-geo-mist">{doc.confidence}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {filtered.map(doc => {
                const cfg = TYPE_CONFIG[doc.type];
                const isSelected = selected?.id === doc.id;
                return (
                  <div
                    key={doc.id}
                    onClick={() => setSelected(isSelected ? null : doc)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected ? 'border-brand-primary bg-brand-primary/5' : 'border-geo-steel bg-geo-slate hover:bg-geo-graphite hover:border-geo-mist'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <span className="text-2xl">{cfg.icon}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                    </div>
                    <p className="text-sm font-medium text-geo-white leading-snug mb-1">{doc.title}</p>
                    <p className="text-[11px] text-geo-mist">{doc.mine} · {doc.country}</p>
                    <div className="flex items-center justify-between mt-3">
                      <span className="font-mono text-[10px] text-geo-mist">{doc.year} · {doc.pages}p · {doc.size}</span>
                      {!doc.digitised && <span className="text-[9px] bg-signal-medium/20 text-signal-medium px-1.5 py-0.5 rounded">PENDING</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-80 flex-shrink-0 bg-geo-slate border-l border-geo-steel flex flex-col overflow-y-auto">
          <div className="px-5 py-4 border-b border-geo-steel flex items-start justify-between">
            <div>
              <p className="text-[10px] text-geo-mist uppercase tracking-widest mb-1">Document Detail</p>
              <h3 className="font-display font-semibold text-sm text-geo-white leading-snug">{selected.title}</h3>
            </div>
            <button onClick={() => setSelected(null)} className="text-geo-mist hover:text-geo-white text-lg leading-none ml-2 mt-0.5">×</button>
          </div>

          <div className="p-4 space-y-4 flex-1">
            {/* Meta */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Mine', value: selected.mine },
                { label: 'Country', value: selected.country },
                { label: 'Year', value: String(selected.year) },
                { label: 'Pages', value: String(selected.pages) },
                { label: 'File Size', value: selected.size },
                { label: 'Source', value: selected.source },
              ].map(({ label, value }) => (
                <div key={label} className="bg-geo-graphite rounded-lg p-2.5">
                  <p className="text-[9px] text-geo-steel uppercase tracking-widest mb-0.5">{label}</p>
                  <p className="text-[11px] text-geo-cloud font-medium truncate">{value}</p>
                </div>
              ))}
            </div>

            {/* Confidence */}
            <div className="bg-geo-graphite rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-geo-mist uppercase tracking-widest">Digitisation Confidence</p>
                <span className="font-mono text-sm font-bold text-geo-white">{selected.confidence}%</span>
              </div>
              <div className="h-2 bg-geo-slate rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${selected.confidence}%`, backgroundColor: selected.confidence >= 90 ? '#22C55E' : selected.confidence >= 70 ? '#EAB308' : '#EF4444' }}
                />
              </div>
              <p className="text-[10px] text-geo-mist mt-2">
                {selected.digitised ? 'OCR extraction complete' : 'Awaiting digitisation pipeline'}
              </p>
            </div>

            {/* Status */}
            <div className="flex items-center gap-2 p-3 bg-geo-graphite rounded-xl">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${selected.digitised ? 'bg-signal-low' : 'bg-signal-medium'}`} />
              <p className="text-[11px] text-geo-cloud">
                {selected.digitised ? 'Available for AI analysis' : 'Queued for processing'}
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <button className="w-full h-9 bg-brand-primary text-white text-xs font-semibold rounded-lg hover:bg-brand-hover transition-colors">
                Open Document →
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button className="h-8 border border-geo-steel rounded-lg text-[11px] text-geo-cloud hover:bg-geo-graphite transition-colors">
                  Download PDF
                </button>
                <button className="h-8 border border-geo-steel rounded-lg text-[11px] text-geo-cloud hover:bg-geo-graphite transition-colors">
                  Link to Mine
                </button>
              </div>
              <button className="w-full h-8 border border-geo-steel rounded-lg text-[11px] text-geo-cloud hover:bg-geo-graphite transition-colors">
                Export Data (JSON)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
