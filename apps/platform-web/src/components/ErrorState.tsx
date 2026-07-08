'use client';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  fullPage?: boolean;
}

export function ErrorState({
  message = 'Failed to load data',
  onRetry,
  fullPage = false
}: ErrorStateProps) {
  const content = (
    <div className="text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-red-900/20 border border-red-900/30 flex items-center justify-center">
        <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">Error Loading Data</h3>
      <p className="text-sm text-gray-400 mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-brand-primary hover:bg-brand-hover text-white text-sm rounded-lg transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-geo-obsidian">
        <div className="max-w-md">{content}</div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-12">
      {content}
    </div>
  );
}
