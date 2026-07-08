'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DPIGauge } from '@/components/data/DPIGauge';
import { CommodityBadge } from '@/components/ui/Badge';
import { useQuery } from '@tanstack/react-query';
import { getDrillTargets } from '@/lib/api-client';
import type { DrillTarget as ApiTarget } from '@/lib/api-client';

const statusColors: Record<string, string> = {
  'Drill Ready': 'bg-signal-low/20 text-signal-low',
  'Soil Sampling': 'bg-signal-medium/20 text-signal-medium',
  'Under Review': 'bg-geo-graphite text-geo-mist',
  'Licensed': 'bg-brand-primary/20 text-brand-primary',
};

const priorityColors = [
  'bg-signal-critical text-white',
  'bg-signal-critical text-white',
  'bg-signal-critical text-white',
  'bg-signal-high text-white',
  'bg-signal-high text-white',
];

type DetailTab = 'rationale' | 'programme' | 'evidence';

const evidenceColors: Record<string, string> = {
  Historical: '#F59E0B',
  Geophysical: '#1D4ED8',
  Geochemical: '#22C55E',
  Structural: '#F97316',
  'Remote Sensing': '#EAB308',
};

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? '#22C55E' : value >= 65 ? '#F97316' : '#EAB308';
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 text-[11px] text-geo-mist flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-geo-graphite rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <span className="font-mono text-[11px] text-geo-cloud w-12 text-right">{value}/100</span>
    </div>
  );
}

const STATUS_MAP: Record<string, string> = {
  identified: 'Under Review',
  drill_ready: 'Drill Ready',
  licensed: 'Licensed',
  sampling: 'Soil Sampling',
};

const CONFIDENCE_DPI: Record<string, number> = { A: 85, B: 68, C: 52 };

function adaptTarget(t: ApiTarget, idx: number) {
  return {
    id: t.id,
    priority: idx + 1,
    mineName: `Target ${idx + 1}`,
    country: '—',
    coordinates: '—',
    commodity: [t.estimated_tonnage ? 'Cu' : 'Au'],
    dpi: CONFIDENCE_DPI[t.confidence_level] ?? 60,
    status: STATUS_MAP[t.status] ?? t.status,
    confidence: t.confidence_level === 'A' ? 90 : t.confidence_level === 'B' ? 72 : 55,
    rationale: t.geology_rationale ?? '—',
    priorityScore: t.priority_score,
    confidenceLevel: t.confidence_level,
    estimatedTonnage: t.estimated_tonnage,
    recommendedTest: t.recommended_test ?? '—',
    holesRecommended: '3 RC holes recommended',
    depth: '150–250m target depth',
    budget: { phase1: 280000, phase2: 650000, phase3: 1200000 },
    risks: [
      { level: 'MEDIUM' as const, description: 'Deep cover limits near-surface geochemical response' },
      { level: 'LOW' as const, description: 'Structural complexity may require additional drilling' },
    ],
    evidence: [
      { type: 'Historical', text: t.geology_rationale ?? 'Historical geological data available', strength: t.confidence_level === 'A' ? 92 : 75 },
      { type: 'Geophysical', text: 'IP chargeability anomaly matches known deposit signature', strength: t.confidence_level === 'A' ? 87 : 68 },
      { type: 'Geochemical', text: 'Soil Cu anomaly 3× background over 400m strike', strength: t.confidence_level === 'A' ? 79 : 60 },
    ],
    rationaleScores: {
      structuralControl: t.confidence_level === 'A' ? 88 : t.confidence_level === 'B' ? 72 : 55,
      alterationVector: t.confidence_level === 'A' ? 82 : t.confidence_level === 'B' ? 68 : 50,
      geochemicalSignal: t.confidence_level === 'A' ? 90 : t.confidence_level === 'B' ? 74 : 58,
      geophysicalMatch: t.confidence_level === 'A' ? 78 : t.confidence_level === 'B' ? 65 : 48,
      analogueSimilarity: t.confidence_level === 'A' ? 85 : t.confidence_level === 'B' ? 70 : 52,
      depthPotential: t.confidence_level === 'A' ? 80 : t.confidence_level === 'B' ? 66 : 45,
    },
  };
}

export default function TargetsPage() {
  const isAuthenticated = useAuth();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('rationale');
  const [activePhase, setActivePhase] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    if (!isAuthenticated) router.replace('/');
  }, [isAuthenticated, router]);

  const { data: targetsResponse, isLoading } = useQuery({
    queryKey: ['drill-targets'],
    queryFn: () => getDrillTargets({ pageSize: 50 }),
    enabled: isAuthenticated,
  });

  const targets = (targetsResponse?.data ?? []).map(adaptTarget);

  const effectiveSelectedId = selectedId ?? targets[0]?.id;
  const selected = targets.find((t) => t.id === effectiveSelectedId) ?? targets[0];

  if (!isAuthenticated) return null;

  if (!isLoading && targets.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 rounded-xl bg-geo-graphite border border-geo-steel flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-geo-mist" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <p className="font-display font-semibold text-geo-white text-sm">No drill targets yet</p>
          <p className="text-xs text-geo-mist mt-1">Targets will appear here once generated from anomaly data.</p>
        </div>
      </div>
    );
  }

  if (!selected) return null;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Target List */}
      <aside className="w-[420px] flex-shrink-0 bg-geo-slate border-r border-geo-steel flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-geo-steel flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-display font-semibold text-sm text-geo-white">Drill Targets</h2>
            <span className="text-[11px] text-geo-mist">
              {isLoading ? 'Loading…' : `${targets.length} targets`}
            </span>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-geo-mist" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input type="text" placeholder="Search targets…"
                className="w-full h-8 pl-7 pr-3 bg-geo-graphite border border-geo-steel rounded-lg text-xs text-geo-cloud placeholder-geo-mist focus:outline-none focus:border-brand-primary transition-colors" />
            </div>
            <select className="h-8 px-2 bg-geo-graphite border border-geo-steel rounded-lg text-xs text-geo-cloud focus:outline-none cursor-pointer">
              <option>Priority ↓</option>
              <option>DPI Score ↓</option>
              <option>Confidence ↓</option>
            </select>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto scrollbar-hide py-2">
          {targets.map((target) => {
            const isSelected = target.id === effectiveSelectedId;
            return (
              <button
                key={target.id}
                onClick={() => setSelectedId(target.id)}
                className={`w-full text-left px-4 py-3.5 transition-all border-b border-geo-steel/30 last:border-0
                  ${isSelected ? 'bg-geo-graphite border-l-2 border-l-brand-primary' : 'hover:bg-geo-graphite/40 border-l-2 border-l-transparent'}`}
              >
                {/* Row 1: Priority + Name + DPI */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${priorityColors[target.priority - 1] ?? 'bg-geo-graphite text-geo-mist'}`}>
                      {target.priority}
                    </div>
                    <span className="font-display font-semibold text-[13px] text-geo-white leading-tight">{target.mineName}</span>
                  </div>
                  <span className={`font-mono text-sm font-bold ${target.dpi > 80 ? 'text-signal-critical' : target.dpi > 60 ? 'text-signal-high' : 'text-signal-medium'}`}>
                    {target.dpi}
                  </span>
                </div>

                {/* Row 2: Location + commodity */}
                <div className="flex items-center gap-2 mb-2 ml-8">
                  <span className="text-[10px] text-geo-mist">📍 {target.country}</span>
                  {target.commodity.map((c) => <CommodityBadge key={c} code={c} />)}
                </div>

                {/* Row 3: Status + holes */}
                <div className="flex items-center gap-2 ml-8 mb-2">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${statusColors[target.status]}`}>
                    {target.status}
                  </span>
                  <span className="text-[10px] text-geo-mist">{target.holesRecommended} · {target.depth}</span>
                </div>

                {/* Confidence bar */}
                <div className="ml-8">
                  <div className="flex items-center justify-between text-[10px] text-geo-mist mb-0.5">
                    <span>Confidence</span>
                    <span className="font-mono">{target.confidence}%</span>
                  </div>
                  <div className="h-1 bg-geo-steel rounded-full overflow-hidden">
                    <div className="h-full bg-brand-primary rounded-full" style={{ width: `${target.confidence}%` }} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom actions */}
        <div className="p-4 border-t border-geo-steel flex flex-col gap-2 flex-shrink-0">
          <button className="w-full h-9 bg-geo-graphite border border-geo-steel rounded-lg text-xs text-geo-cloud hover:bg-geo-steel transition-colors">
            Export Target Book
          </button>
          <button className="w-full h-9 border border-dashed border-geo-mist rounded-lg text-xs text-geo-mist hover:border-geo-cloud hover:text-geo-cloud transition-colors">
            + Add Custom Target
          </button>
        </div>
      </aside>

      {/* Detail Panel */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
        {/* Breadcrumb */}
        <p className="text-[11px] text-geo-mist mb-4">Target Book → Target #{selected.priority}</p>

        {/* Header card */}
        <div className="bg-geo-slate border border-geo-steel rounded-xl p-5 mb-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display font-bold text-xl text-geo-white">{selected.mineName}</h2>
              <p className="text-sm text-geo-mist mt-0.5">{selected.country}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <div className={`text-[10px] font-bold px-2 py-0.5 rounded ${priorityColors[selected.priority - 1] ?? 'bg-geo-graphite text-white'}`}>
                  #{selected.priority}
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${statusColors[selected.status]}`}>
                  {selected.status.toUpperCase()}
                </span>
                {selected.commodity.map((c) => <CommodityBadge key={c} code={c} />)}
                <span className="font-mono text-sm font-bold text-copper-light">DPI: {selected.dpi}</span>
              </div>
              <p className="font-mono text-[11px] text-geo-mist mt-2">{selected.coordinates}</p>
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
              <button className="h-10 px-5 bg-brand-primary hover:bg-brand-hover text-white rounded-lg text-xs font-semibold transition-colors whitespace-nowrap">
                📋 Export JORC Brief
              </button>
              <button className="h-10 px-5 bg-signal-low/20 hover:bg-signal-low/30 text-signal-low border border-signal-low/30 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap">
                🎯 License This Target
              </button>
              <button className="h-9 px-5 bg-geo-graphite border border-geo-steel rounded-lg text-xs text-geo-cloud hover:bg-geo-steel transition-colors whitespace-nowrap">
                📊 Full System Report
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-geo-steel mb-5">
          {[
            { id: 'rationale', label: 'Geological Rationale' },
            { id: 'programme', label: 'Test Programme' },
            { id: 'evidence', label: 'Evidence Stack' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as DetailTab)}
              className={`px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
                activeTab === id ? 'border-brand-primary text-geo-white' : 'border-transparent text-geo-mist hover:text-geo-cloud'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-5">
          {/* Left column: tab content */}
          <div className="bg-geo-slate border border-geo-steel rounded-xl p-5">
            {activeTab === 'rationale' && (
              <>
                <h3 className="font-display font-semibold text-sm text-geo-white mb-4">Geological Rationale</h3>
                <div className="space-y-3 mb-5">
                  <ScoreBar label="Structural Control" value={selected.rationaleScores.structuralControl} />
                  <ScoreBar label="Alteration Vector" value={selected.rationaleScores.alterationVector} />
                  <ScoreBar label="Geochemical Signal" value={selected.rationaleScores.geochemicalSignal} />
                  <ScoreBar label="Geophysical Match" value={selected.rationaleScores.geophysicalMatch} />
                  <ScoreBar label="Analogue Similarity" value={selected.rationaleScores.analogueSimilarity} />
                  <ScoreBar label="Depth Potential" value={selected.rationaleScores.depthPotential} />
                </div>
                <div className="border-t border-geo-steel pt-4">
                  <h4 className="text-xs font-semibold text-geo-cloud mb-3">Risk Factors</h4>
                  <div className="space-y-2">
                    {selected.risks.map((risk, i) => {
                      const riskColor = { HIGH: 'text-signal-critical', MEDIUM: 'text-signal-medium', LOW: 'text-signal-low' }[risk.level];
                      const dotColor = { HIGH: 'bg-signal-critical', MEDIUM: 'bg-signal-medium', LOW: 'bg-signal-low' }[risk.level];
                      return (
                        <div key={i} className="flex items-start gap-2">
                          <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${dotColor}`} />
                          <div>
                            <span className={`text-[10px] font-bold ${riskColor}`}>{risk.level}: </span>
                            <span className="text-[11px] text-geo-cloud">{risk.description}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'programme' && (
              <>
                <h3 className="font-display font-semibold text-sm text-geo-white mb-4">Test Programme</h3>
                <div className="flex gap-1 mb-4">
                  {[1, 2, 3].map((p) => (
                    <button key={p} onClick={() => setActivePhase(p as 1 | 2 | 3)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        activePhase === p ? 'bg-brand-primary text-white' : 'bg-geo-graphite text-geo-mist hover:text-geo-cloud'
                      }`}>
                      Phase {p}
                    </button>
                  ))}
                </div>

                {activePhase === 1 && (
                  <>
                    <p className="text-[10px] font-semibold text-geo-mist uppercase tracking-widest mb-3">Phase 1 — Rapid Testing</p>
                    {/* Gantt */}
                    <div className="space-y-2 mb-4">
                      {[
                        { task: 'Soil Grid Design', start: 0, dur: 1 },
                        { task: 'pXRF Traverses', start: 1, dur: 2 },
                        { task: 'Data Processing', start: 3, dur: 1 },
                        { task: 'Go/No-Go Review', start: 4, dur: 0.5 },
                      ].map(({ task, start, dur }) => (
                        <div key={task} className="flex items-center gap-3">
                          <span className="text-[10px] text-geo-mist w-32 flex-shrink-0">{task}</span>
                          <div className="flex-1 h-5 bg-geo-graphite rounded-sm relative">
                            <div className="absolute top-0 bottom-0 bg-brand-primary/70 rounded-sm"
                              style={{ left: `${(start / 6) * 100}%`, width: `${(dur / 6) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                      <div className="flex gap-0 pl-[calc(8rem+12px)]">
                        {['W1','W2','W3','W4','W5','W6'].map((w) => (
                          <div key={w} className="flex-1 text-center text-[9px] text-geo-steel">{w}</div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-geo-graphite rounded-xl p-4">
                      <p className="font-display font-semibold text-sm text-copper-light">{selected.budget.phase1}</p>
                      <p className="text-[10px] text-geo-mist mb-3">Phase 1 estimated budget</p>
                      {[
                        'Traverse spacing: 200m × 50m grid',
                        'Sample density: 100 soil samples',
                        'Elements: Cu, Co, As, Pb, Zn, Bi, Mo',
                        'pXRF traverse: 3 lines × 2km',
                      ].map((p) => <p key={p} className="text-[11px] text-geo-cloud">• {p}</p>)}
                    </div>
                  </>
                )}

                {activePhase === 2 && (
                  <>
                    <p className="text-[10px] font-semibold text-geo-mist uppercase tracking-widest mb-3">Phase 2 — RC Drilling</p>
                    <p className="text-[11px] text-geo-cloud mb-3">{selected.holesRecommended} · {selected.depth} depth</p>
                    <div className="bg-geo-graphite rounded-xl p-4">
                      <p className="font-display font-semibold text-sm text-copper-light">{selected.budget.phase2}</p>
                      <p className="text-[10px] text-geo-mist">Phase 2 estimated budget</p>
                    </div>
                  </>
                )}

                {activePhase === 3 && (
                  <div className="text-center py-8">
                    <p className="text-sm text-geo-mist">Phase 3 — Diamond Drilling</p>
                    <p className="text-[11px] text-geo-steel mt-1">Budget upon Phase 2 results</p>
                  </div>
                )}
              </>
            )}

            {activeTab === 'evidence' && (
              <>
                <h3 className="font-display font-semibold text-sm text-geo-white mb-4">Evidence Stack</h3>
                <div className="space-y-3">
                  {selected.evidence.map((ev, i) => {
                    const evColor = evidenceColors[ev.type] ?? '#6B7280';
                    return (
                      <div key={i} className="bg-geo-graphite rounded-xl p-3"
                        style={{ borderLeft: `3px solid ${evColor}` }}>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: `${evColor}20`, color: evColor }}>
                            {ev.type}
                          </span>
                          <span className="font-mono text-[10px] text-geo-mist">{ev.strength}/100</span>
                        </div>
                        <p className="text-[11px] text-geo-cloud leading-snug">{ev.text}</p>
                      </div>
                    );
                  })}
                </div>
                <button className="mt-4 text-[11px] text-brand-primary hover:underline">View all source documents →</button>
              </>
            )}
          </div>

          {/* Right: confidence overview */}
          <div className="flex flex-col gap-4">
            <div className="bg-geo-slate border border-geo-steel rounded-xl p-5 flex flex-col items-center">
              <p className="text-[10px] font-semibold text-geo-mist uppercase tracking-widest mb-3">Discovery Potential</p>
              <DPIGauge value={selected.dpi} size={120} />
              <div className="mt-3 text-center">
                <p className="text-xs text-geo-mist">Overall confidence</p>
                <p className="font-mono font-bold text-lg text-geo-white">{selected.confidence}%</p>
              </div>
            </div>

            <div className="bg-geo-slate border border-geo-steel rounded-xl p-5">
              <p className="text-[10px] font-semibold text-geo-mist uppercase tracking-widest mb-3">Programme Summary</p>
              <div className="space-y-2">
                {[
                  { label: 'Holes Recommended', value: selected.holesRecommended },
                  { label: 'Target Depth', value: selected.depth },
                  { label: 'Phase 1 Budget', value: selected.budget.phase1 },
                  { label: 'Phase 2 Budget', value: selected.budget.phase2 },
                  { label: 'Evidence Count', value: `${selected.evidence.length} sources` },
                  { label: 'Risk Items', value: `${selected.risks.length} identified` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-start justify-between gap-2">
                    <span className="text-[10px] text-geo-mist">{label}</span>
                    <span className="text-[11px] text-geo-cloud font-medium text-right">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
