import { memo } from 'react';
import { ScoreBreakdown } from '@/lib/api-client';

interface ConvergenceScoreBarProps {
  breakdown: ScoreBreakdown;
  totalScore: number;
  showLabels?: boolean;
  height?: 'sm' | 'md' | 'lg';
}

const SCORE_COLORS = {
  drone: 'bg-blue-500',
  archive: 'bg-amber-500',
  scout: 'bg-green-500',
  geology: 'bg-purple-500',
};

const SCORE_MAX = {
  drone: 40,
  archive: 30,
  scout: 20,
  geology: 10,
};

const SCORE_LABELS = {
  drone: 'Drone',
  archive: 'Archive',
  scout: 'Scout',
  geology: 'Geology',
};

const HEIGHT_CLASSES = {
  sm: 'h-2',
  md: 'h-4',
  lg: 'h-6',
};

export const ConvergenceScoreBar = memo(function ConvergenceScoreBar({
  breakdown,
  totalScore,
  showLabels = false,
  height = 'md',
}: ConvergenceScoreBarProps) {
  const heightClass = HEIGHT_CLASSES[height];

  // Calculate percentages out of 100 total
  const dronePercent = (breakdown.drone_score / 100) * 100;
  const archivePercent = (breakdown.archive_score / 100) * 100;
  const scoutPercent = (breakdown.scout_score / 100) * 100;
  const geologyPercent = (breakdown.geology_score / 100) * 100;

  return (
    <div>
      <div className={`w-full ${heightClass} bg-gray-800 rounded-full overflow-hidden flex`}>
        {breakdown.drone_score > 0 && (
          <div
            className={`${SCORE_COLORS.drone} flex items-center justify-center text-[10px] font-bold text-white`}
            style={{ width: `${dronePercent}%` }}
            title={`Drone: ${breakdown.drone_score}/${SCORE_MAX.drone}`}
          />
        )}
        {breakdown.archive_score > 0 && (
          <div
            className={`${SCORE_COLORS.archive} flex items-center justify-center text-[10px] font-bold text-white`}
            style={{ width: `${archivePercent}%` }}
            title={`Archive: ${breakdown.archive_score}/${SCORE_MAX.archive}`}
          />
        )}
        {breakdown.scout_score > 0 && (
          <div
            className={`${SCORE_COLORS.scout} flex items-center justify-center text-[10px] font-bold text-white`}
            style={{ width: `${scoutPercent}%` }}
            title={`Scout: ${breakdown.scout_score}/${SCORE_MAX.scout}`}
          />
        )}
        {breakdown.geology_score > 0 && (
          <div
            className={`${SCORE_COLORS.geology} flex items-center justify-center text-[10px] font-bold text-white`}
            style={{ width: `${geologyPercent}%` }}
            title={`Geology: ${breakdown.geology_score}/${SCORE_MAX.geology}`}
          />
        )}
      </div>

      {showLabels && (
        <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${SCORE_COLORS.drone}`} />
            <div>
              <div className="text-gray-400 text-[10px]">{SCORE_LABELS.drone}</div>
              <div className="font-mono font-semibold text-gray-200">
                {breakdown.drone_score}/{SCORE_MAX.drone}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${SCORE_COLORS.archive}`} />
            <div>
              <div className="text-gray-400 text-[10px]">{SCORE_LABELS.archive}</div>
              <div className="font-mono font-semibold text-gray-200">
                {breakdown.archive_score}/{SCORE_MAX.archive}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${SCORE_COLORS.scout}`} />
            <div>
              <div className="text-gray-400 text-[10px]">{SCORE_LABELS.scout}</div>
              <div className="font-mono font-semibold text-gray-200">
                {breakdown.scout_score}/{SCORE_MAX.scout}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${SCORE_COLORS.geology}`} />
            <div>
              <div className="text-gray-400 text-[10px]">{SCORE_LABELS.geology}</div>
              <div className="font-mono font-semibold text-gray-200">
                {breakdown.geology_score}/{SCORE_MAX.geology}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
