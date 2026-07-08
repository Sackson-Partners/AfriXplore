import { memo } from 'react';

interface CertifiedBadgeProps {
  certified: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES = {
  sm: 'text-[10px] px-2 py-0.5',
  md: 'text-xs px-2.5 py-1',
  lg: 'text-sm px-3 py-1.5',
};

export const CertifiedBadge = memo(function CertifiedBadge({ certified, size = 'md' }: CertifiedBadgeProps) {
  if (certified) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 bg-green-500/10 border border-green-500/30 text-green-400 rounded-full font-semibold uppercase tracking-wide ${SIZE_CLASSES[size]}`}
      >
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
        Certified
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center bg-gray-700/30 border border-gray-600/30 text-gray-400 rounded-full font-semibold uppercase tracking-wide ${SIZE_CLASSES[size]}`}
    >
      Pending
    </span>
  );
});
