'use client';

interface LoadingSkeletonProps {
  variant?: 'card' | 'table' | 'list' | 'chart';
  count?: number;
}

export function LoadingSkeleton({ variant = 'card', count = 3 }: LoadingSkeletonProps) {
  if (variant === 'card') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 animate-pulse">
            <div className="h-4 bg-gray-800 rounded w-3/4 mb-3" />
            <div className="h-3 bg-gray-800 rounded w-1/2 mb-4" />
            <div className="space-y-2">
              <div className="h-2 bg-gray-800 rounded w-full" />
              <div className="h-2 bg-gray-800 rounded w-5/6" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 bg-gray-900 border border-gray-800 rounded-lg animate-pulse">
            <div className="w-10 h-10 bg-gray-800 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-gray-800 rounded w-1/3" />
              <div className="h-2 bg-gray-800 rounded w-1/2" />
            </div>
            <div className="w-20 h-8 bg-gray-800 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="h-12 bg-gray-900 border border-gray-800 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (variant === 'chart') {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 animate-pulse">
        <div className="h-4 bg-gray-800 rounded w-1/4 mb-4" />
        <div className="h-64 bg-gray-800 rounded" />
      </div>
    );
  }

  return null;
}
