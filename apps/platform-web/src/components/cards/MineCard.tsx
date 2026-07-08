'use client';

import Link from 'next/link';
import { DPIGauge } from '@/components/data/DPIGauge';
import { CommodityBadge } from '@/components/ui/Badge';
import type { Mine } from '@/lib/mock-data';

interface MineCardProps {
  mine: Mine;
}

export function MineCard({ mine }: MineCardProps) {
  return (
    <Link
      href={`/mines/${mine.id}`}
      className="group block bg-geo-slate border border-geo-steel rounded-xl overflow-hidden shadow-md
        hover:border-brand-primary hover:shadow-glow-brand hover:-translate-y-0.5
        transition-all duration-200"
    >
      {/* Header */}
      <div className="flex items-start justify-between p-4 pb-2">
        <div className="flex flex-wrap gap-1.5">
          {mine.commodity.map((c) => {
            // Map commodity name to code
            const codeMap: Record<string, string> = {
              Copper: 'Cu', Gold: 'Au', Tin: 'Sn', Nickel: 'Ni', Cobalt: 'Co',
            };
            return <CommodityBadge key={c} code={codeMap[c] ?? c} />;
          })}
        </div>
        <DPIGauge value={mine.dpi} size={56} showLabel={false} />
      </div>

      {/* Mine identity */}
      <div className="px-4 pb-2">
        <h3 className="font-display font-semibold text-sm text-geo-white group-hover:text-brand-hover transition-colors leading-snug">
          {mine.name}
        </h3>
        <p className="text-[11px] text-geo-mist mt-0.5">{mine.region}, {mine.country}</p>
      </div>

      {/* Metadata grid */}
      <div className="px-4 grid grid-cols-2 gap-x-3 gap-y-1.5 py-2 border-t border-geo-steel/50">
        {[
          { label: 'Operating Years', value: mine.operatingYears },
          { label: 'Peak Grade', value: mine.peakGrade },
          { label: 'System Type', value: mine.systemType },
          { label: 'Depth Reached', value: mine.depthReached },
          { label: 'Records', value: `${mine.records} documents` },
          { label: 'MSIM Status', value: mine.msimStatus },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-[10px] text-geo-steel uppercase tracking-wide">{label}</p>
            <p className="text-[11px] text-geo-cloud font-medium leading-snug">{value}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 flex items-center justify-between border-t border-geo-steel/50">
        <span className="text-[11px] text-signal-low">
          {mine.comparableMatch.similarity}% similar to {mine.comparableMatch.name}
        </span>
        <span className="text-[11px] text-brand-hover font-medium group-hover:underline">
          View System →
        </span>
      </div>
    </Link>
  );
}
