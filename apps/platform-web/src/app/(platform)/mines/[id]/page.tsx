'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DPIGauge } from '@/components/data/DPIGauge';
import { CommodityBadge } from '@/components/ui/Badge';
import { MINERAL_SYSTEM_PARAMS } from '@/lib/mock-data';
import { useQuery } from '@tanstack/react-query';
import { getMine, getArchiveDocs } from '@/lib/api-client';
import { ConvergenceScoreCard } from '@/components/ConvergenceScoreCard';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';

type CrossSectionTab = 'cross-section' | 'plan-view' | '3d' | 'system-model';

// Geological cross-section SVG component
function CrossSection() {
  return (
    <svg viewBox="0 0 700 280" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#94A3B8" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#64748B" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id="oxide" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#92400E" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#78350F" stopOpacity="0.8" />
        </linearGradient>
        <linearGradient id="primary" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1F2937" />
          <stop offset="100%" stopColor="#111827" />
        </linearGradient>
        <linearGradient id="basement" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0F172A" />
          <stop offset="100%" stopColor="#0A0E14" />
        </linearGradient>
        <filter id="ore-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id="ore-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#B45309" stopOpacity="0.6" />
        </radialGradient>
      </defs>

      {/* Surface / Sky */}
      <rect x="0" y="0" width="700" height="40" fill="url(#sky)" />

      {/* Oxide zone */}
      <rect x="0" y="40" width="700" height="70" fill="url(#oxide)" />

      {/* Primary zone */}
      <rect x="0" y="110" width="700" height="130" fill="url(#primary)" />

      {/* Basement */}
      <rect x="0" y="240" width="700" height="40" fill="url(#basement)" />

      {/* Tilted sedimentary layers */}
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i} transform={`skewY(-5)`}>
          <rect x="-20" y={120 + i * 24} width="760" height="10"
            fill={i % 2 === 0 ? '#1F2937' : '#374151'}
            opacity="0.6"
          />
        </g>
      ))}

      {/* Ore shoots */}
      <g filter="url(#ore-glow)">
        <ellipse cx="300" cy="165" rx="100" ry="18" fill="url(#ore-grad)" opacity="0.85" />
        <ellipse cx="190" cy="195" rx="75" ry="14" fill="url(#ore-grad)" opacity="0.75" />
      </g>

      {/* Ore shoot labels */}
      <text x="300" y="170" textAnchor="middle" fill="white" fontSize="9" fontFamily="var(--font-mono)" fontWeight="600">Ore Shoot A</text>
      <text x="190" y="199" textAnchor="middle" fill="white" fontSize="8" fontFamily="var(--font-mono)">Ore Shoot B</text>

      {/* Fault line */}
      <line x1="440" y1="70" x2="390" y2="250" stroke="#F97316" strokeWidth="1.5" strokeDasharray="6,4" opacity="0.7" />
      <text x="450" y="130" fill="#F97316" fontSize="8" fontFamily="var(--font-mono)">Normal Fault</text>

      {/* Fluid pathways */}
      {[0, 1, 2].map((i) => (
        <path key={i}
          d={`M ${240 + i * 40},245 Q ${245 + i * 40},180 ${255 + i * 40},130`}
          fill="none" stroke="#60A5FA" strokeWidth="1" strokeDasharray="4,3" opacity="0.5"
          markerEnd="url(#arrow)"
        />
      ))}
      <text x="250" y="260" fill="#60A5FA" fontSize="8" fontFamily="var(--font-mono)" opacity="0.7">Basinal Brine Migration</text>

      {/* Mine shaft */}
      <line x1="550" y1="38" x2="550" y2="235" stroke="#D1D5DB" strokeWidth="1.5" opacity="0.5" />
      <line x1="520" y1="155" x2="555" y2="155" stroke="#D1D5DB" strokeWidth="1" opacity="0.4" />
      <line x1="510" y1="195" x2="555" y2="195" stroke="#D1D5DB" strokeWidth="1" opacity="0.4" />
      {/* Headframe */}
      <polygon points="542,38 558,38 552,25" fill="none" stroke="#D1D5DB" strokeWidth="1" opacity="0.5" />

      {/* Alteration halo */}
      <ellipse cx="245" cy="180" rx="140" ry="55" fill="#FCD34D" opacity="0.04" stroke="#FCD34D" strokeWidth="1" strokeDasharray="5,4" />

      {/* Depth scale */}
      {[0, 100, 200, 300, 400].map((d, i) => (
        <g key={d}>
          <line x1="660" y1={38 + i * 48} x2="668" y2={38 + i * 48} stroke="#4B5563" strokeWidth="1" />
          <text x="672" y={41 + i * 48} fill="#6B7280" fontSize="8" fontFamily="var(--font-mono)">{d}m</text>
        </g>
      ))}

      {/* Surface label */}
      <rect x="2" y="1" width="95" height="16" rx="3" fill="#111827" opacity="0.7" />
      <text x="6" y="13" fill="#94A3B8" fontSize="8" fontFamily="var(--font-mono)">Surface Outcrop</text>

      {/* Oxide label */}
      <rect x="2" y="48" width="105" height="14" rx="3" fill="#111827" opacity="0.7" />
      <text x="6" y="59" fill="#D1D5DB" fontSize="8" fontFamily="var(--font-mono)">Oxide Zone (0–50m)</text>

      {/* Primary label */}
      <rect x="2" y="120" width="175" height="14" rx="3" fill="#111827" opacity="0.7" />
      <text x="6" y="131" fill="#D1D5DB" fontSize="8" fontFamily="var(--font-mono)">Primary Sulphide (150–487m)</text>
    </svg>
  );
}

// Tiny bar chart for production history
function ProductionChart() {
  const data = [12, 18, 24, 35, 42, 48, 45, 38, 30, 22, 15, 8];
  const years = [1930, 1933, 1936, 1939, 1942, 1945, 1948, 1951, 1954, 1957, 1960, 1963];
  const max = Math.max(...data);
  const w = 280, h = 120;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full">
      {data.map((v, i) => {
        const barH = (v / max) * (h - 30);
        const x = 8 + i * 22;
        return (
          <g key={i}>
            <rect x={x} y={h - 20 - barH} width="14" height={barH}
              fill={i === 5 ? '#F97316' : '#F59E0B'} rx="2" opacity="0.8"
            />
            {i % 3 === 0 && (
              <text x={x + 7} y={h - 4} textAnchor="middle" fill="#6B7280" fontSize="7" fontFamily="var(--font-mono)">
                {String(years[i]).slice(2)}
              </text>
            )}
          </g>
        );
      })}
      {/* Closure line */}
      <line x1="195" y1="10" x2="195" y2={h - 20} stroke="#EF4444" strokeWidth="1" strokeDasharray="3,2" opacity="0.6" />
      <text x="198" y="18" fill="#EF4444" fontSize="7" fontFamily="var(--font-mono)">Closure</text>
    </svg>
  );
}

const confidenceColor = {
  HIGH: 'bg-signal-low/20 text-signal-low',
  MEDIUM: 'bg-signal-medium/20 text-signal-medium',
  LOW: 'bg-geo-graphite text-geo-mist',
};

export default function MineDetailPage() {
  const isAuthenticated = useAuth();
  const router = useRouter();
  const params = useParams();
  const [activeTab, setActiveTab] = useState<CrossSectionTab>('cross-section');

  useEffect(() => {
    if (!isAuthenticated) router.replace('/');
  }, [isAuthenticated, router]);

  const mineId = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';

  const { data: apiMine, isLoading: mineLoading } = useQuery({
    queryKey: ['mine', mineId],
    queryFn: () => getMine(mineId),
    enabled: isAuthenticated && !!mineId,
  });

  const { data: docsResponse } = useQuery({
    queryKey: ['mine-docs', mineId],
    queryFn: () => getArchiveDocs({ mine_id: mineId, pageSize: 10 }),
    enabled: isAuthenticated && !!mineId,
  });

  if (!isAuthenticated) return null;
  if (mineLoading) return (
    <div className="flex items-center justify-center h-full">
      <p className="text-geo-mist text-sm">Loading mine data…</p>
    </div>
  );
  if (!apiMine) return (
    <div className="flex items-center justify-center h-full">
      <p className="text-geo-mist text-sm">Mine not found.</p>
    </div>
  );

  const mine = {
    name: apiMine.name,
    country: apiMine.country,
    region: '',
    commodity: [apiMine.commodity],
    commodityCode: apiMine.commodity.length <= 3 ? apiMine.commodity : apiMine.commodity.substring(0, 2).toUpperCase(),
    systemType: 'Sediment-hosted',
    operatingYears: apiMine.mining_period ?? '—',
    dpi: apiMine.dpi_score ?? 0,
  };

  const mineDocs = docsResponse?.data ?? [];

  const EXTENSION_TARGETS = [
    { name: 'NE Extension', dir: 'NE, 2.4km strike', depth: '80–180m', confidence: 88 },
    { name: 'Plunge Continuation', dir: 'Down-dip at 25°', depth: '200–350m', confidence: 71 },
    { name: 'SW Parallel', dir: 'SW, 1.8km', depth: '60–140m', confidence: 64 },
  ];

  const DOCS = mineDocs.length > 0
    ? mineDocs.map((d) => ({ title: d.title, source: d.author ?? '—', pages: d.page_count ?? 0 }))
    : [
        { title: 'Roan Survey 1934', source: 'GSK Archive', pages: 14 },
        { title: 'UMHK Technical Report', source: 'Colonial Archive', pages: 28 },
        { title: 'Geological Map Sheet', source: 'Dept Mines 1947', pages: 4 },
      ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 pt-4">
        <Breadcrumb
          items={[
            { label: 'Home', href: '/dashboard' },
            { label: 'Library', href: '/library' },
            { label: `${mine.region}, ${mine.country}` },
            { label: mine.name },
          ]}
        />
      </div>

      <div className="px-6 pb-8 max-w-[1200px] mx-auto">
        {/* Hero header */}
        <div className="flex items-start justify-between gap-6 py-4 mb-5 border-b border-geo-steel">
          <div>
            <h1 className="font-display font-bold text-2xl text-geo-white">{mine.name}</h1>
            <p className="text-sm text-geo-mist mt-1">{mine.region}, {mine.country}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <CommodityBadge code={mine.commodityCode} />
              <span className="text-xs bg-geo-graphite text-geo-cloud px-2.5 py-0.5 rounded font-medium">{mine.systemType}</span>
              <span className="text-xs bg-geo-graphite text-geo-cloud px-2.5 py-0.5 rounded">{mine.operatingYears}</span>
              <span className="text-xs bg-signal-low/15 text-signal-low px-2.5 py-0.5 rounded font-semibold">MSIM Complete ✓</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <DPIGauge value={mine.dpi} size={100} />
            <div className="flex flex-col gap-2">
              <button className="h-9 px-4 bg-geo-graphite border border-geo-steel rounded-lg text-xs text-geo-cloud hover:bg-geo-steel transition-colors whitespace-nowrap">
                📥 Download Card
              </button>
              <button className="h-9 px-4 bg-brand-primary hover:bg-brand-hover rounded-lg text-xs text-white transition-colors whitespace-nowrap">
                🎯 Add to Target Book
              </button>
            </div>
          </div>
        </div>

        {/* Cross-section viewer */}
        <div className="bg-geo-graphite rounded-xl border border-geo-steel overflow-hidden mb-6">
          {/* Tabs */}
          <div className="flex border-b border-geo-steel px-4">
            {[
              { id: 'cross-section', label: 'Cross Section' },
              { id: 'plan-view', label: 'Plan View' },
              { id: '3d', label: '3D Schematic' },
              { id: 'system-model', label: 'System Model' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as CrossSectionTab)}
                className={`px-4 py-3 text-xs font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === id
                    ? 'border-brand-primary text-geo-white'
                    : 'border-transparent text-geo-mist hover:text-geo-cloud'
                }`}
              >
                {label}
              </button>
            ))}
            <div className="flex-1" />
            <button className="my-2 px-3 py-1.5 bg-geo-slate border border-geo-steel rounded-lg text-[10px] text-geo-mist hover:text-geo-cloud transition-colors">
              Download SVG
            </button>
          </div>

          {/* Visualization */}
          <div className="h-[280px] p-2">
            {activeTab === 'cross-section' && <CrossSection />}
            {activeTab !== 'cross-section' && (
              <div className="h-full flex items-center justify-center">
                <p className="text-sm text-geo-mist">
                  {activeTab === 'plan-view' && '🗺️ Plan view — coming soon'}
                  {activeTab === '3d' && '🔭 3D schematic — coming soon'}
                  {activeTab === 'system-model' && '⚙️ System model — coming soon'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Convergence Score Card */}
        <div className="mb-6">
          <ConvergenceScoreCard mineId={id} mineName={mine?.name ?? 'Unknown Mine'} />
        </div>

        {/* 3-column grid */}
        <div className="grid grid-cols-3 gap-5 mb-6">
          {/* Production History */}
          <div className="bg-geo-slate border border-geo-steel rounded-xl p-5">
            <h3 className="font-display font-semibold text-sm text-geo-white mb-4">Production History</h3>
            <div className="h-32">
              <ProductionChart />
            </div>
            <div className="mt-3 border-t border-geo-steel pt-3">
              <div className="grid grid-cols-3 gap-0 text-[10px]">
                {['Year', 'Ore (kt)', 'Cu (t)'].map((h) => (
                  <span key={h} className="text-geo-mist font-semibold uppercase tracking-wide pb-1.5 border-b border-geo-steel">{h}</span>
                ))}
                {[
                  ['1930', '890', '33,820'],
                  ['1935', '1,240', '47,120'],
                  ['1940', '1,890', '71,820'],
                  ['1948', '2,340', '88,920'],
                  ['1955', '1,560', '59,280'],
                ].map((row, i) => (
                  <div key={i} className="contents">
                    {row.map((cell, j) => (
                      <span key={j} className={`font-mono py-1.5 text-[10px] ${i % 2 === 0 ? 'text-geo-cloud' : 'text-geo-mist'} ${j === 0 ? 'border-b border-geo-steel/30' : 'border-b border-geo-steel/30'}`}>
                        {cell}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Mineral System Card */}
          <div className="bg-geo-slate border border-geo-steel rounded-xl p-5">
            <h3 className="font-display font-semibold text-sm text-geo-white mb-4">Mineral System Card</h3>
            <div className="space-y-3">
              {MINERAL_SYSTEM_PARAMS.map((p) => (
                <div key={p.label} className="flex items-start gap-3">
                  <span className="text-base flex-shrink-0 mt-0.5">{p.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-geo-mist">{p.label}</p>
                    <p className="text-[11px] text-geo-cloud font-medium leading-snug">{p.value}</p>
                  </div>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${confidenceColor[p.confidence as keyof typeof confidenceColor]}`}>
                    {p.confidence}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Extension Targets */}
          <div className="bg-geo-slate border border-geo-steel rounded-xl p-5">
            <h3 className="font-display font-semibold text-sm text-geo-white mb-4">Modelled Extensions</h3>

            {/* Mini plan map */}
            <div className="h-28 bg-geo-graphite rounded-lg mb-4 overflow-hidden">
              <svg viewBox="0 0 200 110" className="w-full h-full">
                <rect width="200" height="110" fill="#111827" />
                {/* Historical mine outline */}
                <rect x="75" y="45" width="50" height="30" fill="none" stroke="#374151" strokeWidth="1.5" strokeDasharray="4,3" />
                {/* NE extension */}
                <polygon points="125,45 160,20 180,30 145,55" fill="none" stroke="#1D4ED8" strokeWidth="1.5" strokeDasharray="3,2" />
                {/* SW extension */}
                <polygon points="75,75 50,95 30,82 55,62" fill="none" stroke="#F59E0B" strokeWidth="1.5" strokeDasharray="3,2" />
                {/* Labels */}
                <text x="152" y="30" fill="#60A5FA" fontSize="7" fontFamily="var(--font-mono)">NE</text>
                <text x="32" y="92" fill="#F59E0B" fontSize="7" fontFamily="var(--font-mono)">SW</text>
                {/* Scale */}
                <line x1="10" y1="100" x2="50" y2="100" stroke="#374151" strokeWidth="1" />
                <text x="28" y="108" textAnchor="middle" fill="#6B7280" fontSize="6" fontFamily="var(--font-mono)">2km</text>
              </svg>
            </div>

            <div className="space-y-3">
              {EXTENSION_TARGETS.map((t, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded bg-brand-primary/20 border border-brand-primary/40 flex items-center justify-center flex-shrink-0">
                    <span className="font-mono text-[9px] font-bold text-brand-primary">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-geo-white font-medium">{t.name}</p>
                    <p className="text-[10px] text-geo-mist">{t.dir} · {t.depth}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1 bg-geo-graphite rounded-full overflow-hidden">
                        <div className="h-full bg-brand-primary rounded-full" style={{ width: `${t.confidence}%` }} />
                      </div>
                      <span className="font-mono text-[10px] text-geo-mist">{t.confidence}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/targets" className="block mt-3 text-[11px] text-brand-primary hover:underline">
              View in Target Book →
            </Link>
          </div>
        </div>

        {/* Document Vault */}
        <div className="mb-6">
          <h3 className="font-display font-semibold text-sm text-geo-white mb-3">Archive Documents</h3>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
            {DOCS.map((doc, i) => (
              <div key={i} className="flex-shrink-0 w-[148px] bg-geo-slate border border-geo-steel rounded-xl overflow-hidden hover:border-brand-primary transition-colors cursor-pointer group">
                <div className="h-16 bg-geo-graphite flex items-center justify-center">
                  <svg className="w-8 h-10" viewBox="0 0 32 40" fill="none">
                    <rect width="32" height="40" rx="3" fill="#7F1D1D" opacity="0.8" />
                    <text x="16" y="26" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">PDF</text>
                  </svg>
                </div>
                <div className="p-2.5">
                  <p className="text-[11px] text-geo-white font-medium leading-snug truncate group-hover:text-brand-primary transition-colors">{doc.title}</p>
                  <p className="text-[10px] text-geo-mist mt-0.5">{doc.source} · {doc.pages}p</p>
                </div>
              </div>
            ))}
            <div className="flex-shrink-0 w-[148px] bg-geo-graphite border border-geo-steel border-dashed rounded-xl flex items-center justify-center cursor-pointer hover:border-geo-mist transition-colors">
              <p className="text-[11px] text-geo-mist text-center">+9 more</p>
            </div>
          </div>
        </div>

        {/* Comparable Deposits */}
        <div>
          <h3 className="font-display font-semibold text-sm text-geo-white mb-1">Global Analogues</h3>
          <p className="text-[11px] text-geo-mist mb-3">Geological similarity scoring vs 500+ global deposits</p>
          <div className="bg-geo-slate border border-geo-steel rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-geo-steel">
                  {['Deposit', 'Country', 'Similarity', 'Type'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] text-geo-mist font-semibold uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'Zambian Copperbelt Analogues', country: '🇿🇲 Zambia', sim: 91, type: 'Sediment-hosted', highlight: true },
                  { name: 'Olympic Dam', country: '🇦🇺 Australia', sim: 82, type: 'IOCG', highlight: false },
                  { name: 'Kolwezi', country: '🇨🇩 DRC', sim: 78, type: 'Sediment-hosted', highlight: false },
                  { name: 'Redbed-hosted Analogue', country: '🌍 Global', sim: 71, type: 'Redbed Cu', highlight: false },
                ].map((row, i) => (
                  <tr key={i} className={`border-b border-geo-steel/50 last:border-0 hover:bg-geo-graphite/50 ${row.highlight ? 'bg-brand-primary/5' : ''}`}>
                    <td className="px-4 py-2.5 text-geo-white font-medium">{row.name}</td>
                    <td className="px-4 py-2.5 text-geo-mist">{row.country}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-geo-graphite rounded-full overflow-hidden">
                          <div className="h-full bg-signal-low rounded-full" style={{ width: `${row.sim}%` }} />
                        </div>
                        <span className="font-mono text-signal-low font-semibold">{row.sim}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-geo-mist">{row.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
