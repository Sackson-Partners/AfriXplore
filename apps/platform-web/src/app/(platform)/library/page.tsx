'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MineCard } from '@/components/cards/MineCard';
import { COMMODITIES } from '@/lib/mock-data';
import { getMines, getConvergenceScores, type ApiMine } from '@/lib/api-client';
import type { Mine } from '@/lib/mock-data';
import { ConvergenceScoreBar } from '@/components/ConvergenceScoreBar';
import { CertifiedBadge } from '@/components/CertifiedBadge';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';

const COUNTRIES = ['DRC', 'Zambia', 'Zimbabwe', 'Tanzania', 'Kenya', 'Ghana', 'Mali', 'Namibia', 'Botswana', 'Senegal'];
const SYSTEM_TYPES = ['All', 'Sediment-hosted', 'Orogenic', 'Magmatic', 'Epithermal', 'Skarn'];

function adaptApiMine(m: ApiMine): Mine {
  return {
    id: m.id,
    name: m.name,
    country: m.country,
    region: '',
    coordinates: [0, 0],
    commodity: [m.commodity],
    commodityCode: m.commodity.length <= 3 ? m.commodity : m.commodity.substring(0, 2).toUpperCase(),
    systemType: 'Sediment-hosted',
    operatingYears: m.mining_period ?? '—',
    peakGrade: '—',
    dpi: m.dpi_score ?? 0,
    depthReached: m.estimated_depth_m != null ? `${m.estimated_depth_m}m` : '—',
    records: 0,
    msimStatus: m.digitisation_status,
    comparableMatch: { name: '—', similarity: 0 },
    status: (m.status === 'active' ? 'active-msim' : m.status) as Mine['status'],
    continent: 'Africa',
  };
}

type ViewMode = 'grid' | 'list';
type SortKey = 'dpi' | 'name' | 'records';

export default function LibraryPage() {
  const isAuthenticated = useAuth();
  const router = useRouter();

  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());
  const [selectedCommodities, setSelectedCommodities] = useState<Set<string>>(new Set());
  const [systemType, setSystemType] = useState('All');
  const [dpiMin, setDpiMin] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortKey, setSortKey] = useState<SortKey>('dpi');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isAuthenticated) router.replace('/');
  }, [isAuthenticated, router]);

  const apiParams: Record<string, string | number> = { pageSize: 200 };
  if (searchQuery) apiParams.search = searchQuery;
  if (selectedCommodities.size === 1) apiParams.commodity = Array.from(selectedCommodities)[0];

  const { data: minesResponse, isLoading } = useQuery({
    queryKey: ['library-mines', searchQuery, Array.from(selectedCommodities).join(',')],
    queryFn: () => getMines(apiParams),
    enabled: isAuthenticated,
  });

  const { data: convergenceData } = useQuery({
    queryKey: ['convergence', 'scores'],
    queryFn: () => getConvergenceScores(1, 200),
    enabled: isAuthenticated,
  });

  const convergenceMap = useMemo(() => {
    const map = new Map();
    convergenceData?.data?.forEach((score) => {
      map.set(score.mine_id, score);
    });
    return map;
  }, [convergenceData]);

  const filteredMines = useMemo(() => {
    const apiMines = minesResponse?.data ?? [];
    let result: Mine[] = apiMines.map(adaptApiMine);

    result = result.filter((m) => {
      const countryMatch = selectedCountries.size === 0 || selectedCountries.has(m.country);
      const dpiMatch = m.dpi >= dpiMin;
      return countryMatch && dpiMatch;
    });

    result.sort((a, b) => {
      if (sortKey === 'dpi') return b.dpi - a.dpi;
      if (sortKey === 'name') return a.name.localeCompare(b.name);
      if (sortKey === 'records') return b.records - a.records;
      return 0;
    });

    return result;
  }, [minesResponse, selectedCountries, dpiMin, sortKey]);

  const toggleCountry = (c: string) => {
    setSelectedCountries(prev => {
      const next = new Set(prev);
      if (next.has(c)) { next.delete(c); } else { next.add(c); }
      return next;
    });
  };

  const toggleCommodity = (c: string) => {
    setSelectedCommodities(prev => {
      const next = new Set(prev);
      if (next.has(c)) { next.delete(c); } else { next.add(c); }
      return next;
    });
  };

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-full overflow-hidden flex-col">
      {/* Breadcrumb */}
      <div className="px-6 pt-4 pb-2 flex-shrink-0">
        <Breadcrumb
          items={[
            { label: 'Home', href: '/dashboard' },
            { label: 'Intelligence' },
            { label: 'Target Library' },
          ]}
        />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Filter Sidebar */}
        <aside className="w-[260px] flex-shrink-0 bg-geo-slate border-r border-geo-steel overflow-y-auto scrollbar-hide">
          <div className="p-4 border-b border-geo-steel flex items-center justify-between">
            <h2 className="font-display font-semibold text-sm text-geo-white">Filters</h2>
          <button
            onClick={() => {
              setSelectedCountries(new Set());
              setSelectedCommodities(new Set());
              setSystemType('All');
              setDpiMin(0);
              setSearchQuery('');
            }}
            className="text-[11px] text-brand-primary hover:underline"
          >
            Reset
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Search */}
          <div>
            <p className="text-[10px] font-semibold text-geo-mist uppercase tracking-widest mb-2">Search</p>
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-geo-mist" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Mine name, country…"
                className="w-full h-8 pl-7 pr-3 bg-geo-graphite border border-geo-steel rounded-lg text-xs text-geo-cloud placeholder-geo-mist focus:outline-none focus:border-brand-primary transition-colors"
              />
            </div>
          </div>

          {/* Country */}
          <div>
            <p className="text-[10px] font-semibold text-geo-mist uppercase tracking-widest mb-2">Country</p>
            <div className="space-y-1.5">
              {COUNTRIES.map((country) => {
                const count = filteredMines.filter(m => m.country === country).length;
                return (
                  <label key={country} className="flex items-center justify-between gap-2 cursor-pointer group">
                    <div className="flex items-center gap-2">
                      <div
                        onClick={() => toggleCountry(country)}
                        className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${
                          selectedCountries.has(country) ? 'bg-brand-primary border-brand-primary' : 'border-geo-steel bg-transparent hover:border-geo-mist'
                        }`}
                      >
                        {selectedCountries.has(country) && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </div>
                      <span className="text-xs text-geo-cloud group-hover:text-geo-white transition-colors">{country}</span>
                    </div>
                    {count > 0 && <span className="text-[10px] text-geo-steel">{count}</span>}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Commodity */}
          <div>
            <p className="text-[10px] font-semibold text-geo-mist uppercase tracking-widest mb-2">Commodity</p>
            <div className="space-y-1.5">
              {COMMODITIES.map(({ code, name }) => (
                <label key={code} className="flex items-center gap-2 cursor-pointer group">
                  <div
                    onClick={() => toggleCommodity(code)}
                    className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${
                      selectedCommodities.has(code) ? 'bg-brand-primary border-brand-primary' : 'border-geo-steel hover:border-geo-mist'
                    }`}
                  >
                    {selectedCommodities.has(code) && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs text-geo-cloud group-hover:text-geo-white transition-colors">{code} — {name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* System Type */}
          <div>
            <p className="text-[10px] font-semibold text-geo-mist uppercase tracking-widest mb-2">System Type</p>
            <div className="space-y-1.5">
              {SYSTEM_TYPES.map((type) => (
                <label key={type} className="flex items-center gap-2 cursor-pointer group">
                  <div
                    onClick={() => setSystemType(type)}
                    className={`w-4 h-4 rounded-full border flex items-center justify-center cursor-pointer transition-colors ${
                      systemType === type ? 'bg-brand-primary border-brand-primary' : 'border-geo-steel hover:border-geo-mist'
                    }`}
                  >
                    {systemType === type && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span className="text-xs text-geo-cloud group-hover:text-geo-white transition-colors">{type}</span>
                </label>
              ))}
            </div>
          </div>

          {/* DPI Score */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-geo-mist uppercase tracking-widest">DPI Score Min</p>
              <span className="font-mono text-[11px] text-geo-white font-semibold">{dpiMin}+</span>
            </div>
            <input
              type="range" min={0} max={100} step={5} value={dpiMin}
              onChange={(e) => setDpiMin(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-geo-steel mt-0.5">
              <span>0</span><span>50</span><span>100</span>
            </div>
          </div>

          {/* Apply button */}
          <button className="w-full h-10 bg-brand-primary hover:bg-brand-hover text-white rounded-lg text-sm font-semibold transition-colors">
            Apply Filters
          </button>
          <p className="text-center text-[11px] text-geo-mist">
            {isLoading ? 'Loading…' : `Showing ${filteredMines.length} results`}
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Sub-header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-geo-steel bg-geo-slate flex-shrink-0">
          <div>
            <h2 className="font-display font-semibold text-sm text-geo-white">Mine Target Library</h2>
            <p className="text-[11px] text-geo-mist">
              {isLoading ? 'Loading…' : `${filteredMines.length} mines matching filters`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex bg-geo-graphite rounded-lg border border-geo-steel overflow-hidden">
              {[
                { mode: 'grid' as const, icon: (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                  </svg>
                )},
                { mode: 'list' as const, icon: (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                )},
              ].map(({ mode, icon }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-2.5 py-1.5 transition-colors ${viewMode === mode ? 'bg-geo-steel text-geo-white' : 'text-geo-mist hover:text-geo-cloud'}`}
                >
                  {icon}
                </button>
              ))}
            </div>

            {/* Sort */}
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="h-8 px-3 bg-geo-graphite border border-geo-steel rounded-lg text-xs text-geo-cloud focus:outline-none focus:border-brand-primary cursor-pointer"
            >
              <option value="dpi">DPI Score ↓</option>
              <option value="name">Name A–Z</option>
              <option value="records">Records ↓</option>
            </select>

            <button className="h-8 px-3 border border-geo-steel rounded-lg text-xs text-geo-cloud hover:bg-geo-graphite transition-colors">
              Export All
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-sm text-geo-mist">Loading mines…</p>
            </div>
          ) : filteredMines.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="w-12 h-12 rounded-full bg-geo-graphite flex items-center justify-center">
                <svg className="w-6 h-6 text-geo-mist" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="text-sm text-geo-mist">No mines match your filters</p>
              <button onClick={() => { setSelectedCountries(new Set()); setSelectedCommodities(new Set()); setSystemType('All'); setDpiMin(0); }}
                className="text-xs text-brand-primary hover:underline">
                Clear all filters
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-3 gap-4">
              {filteredMines.map((mine) => (
                <MineCard key={mine.id} mine={mine} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredMines.map((mine) => {
                const convergenceScore = convergenceMap.get(mine.id);
                return (
                <div key={mine.id} onClick={() => router.push(`/mines/${mine.id}`)} className="flex items-center gap-4 p-4 bg-geo-slate border border-geo-steel rounded-xl hover:border-brand-primary transition-colors cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-display font-semibold text-sm text-geo-white">{mine.name}</span>
                      <span className="text-[10px] bg-geo-graphite text-geo-mist px-1.5 py-0.5 rounded">{mine.commodityCode}</span>
                    </div>
                    <p className="text-xs text-geo-mist">{mine.region}, {mine.country} · {mine.operatingYears} · {mine.systemType}</p>
                  </div>
                  <div className="w-64">
                    {convergenceScore ? (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-gray-400">Convergence</span>
                          <span className="font-mono font-bold text-sm text-white">{convergenceScore.estimated_convergence_score.toFixed(0)}/100</span>
                          {convergenceScore.certified_target && (
                            <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <ConvergenceScoreBar
                          breakdown={{
                            drone_score: 0,
                            archive_score: 0,
                            scout_score: 0,
                            geology_score: convergenceScore.geology_score,
                          }}
                          totalScore={convergenceScore.estimated_convergence_score}
                          height="sm"
                        />
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">No score</div>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-mono text-xs text-geo-mist">DPI</p>
                      <p className="font-mono font-bold text-sm text-geo-white">{mine.dpi}</p>
                    </div>
                    <span className="text-xs text-brand-primary hover:underline whitespace-nowrap">View →</span>
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
