'use client';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const getPageNumbers = () => {
    const delta = 2;
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];

    for (
      let i = Math.max(2, currentPage - delta);
      i <= Math.min(totalPages - 1, currentPage + delta);
      i++
    ) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-t border-gray-800">
      {/* Left: Items info */}
      <div className="text-xs text-gray-400">
        Showing <span className="font-medium text-gray-300">{startItem}</span> to{' '}
        <span className="font-medium text-gray-300">{endItem}</span> of{' '}
        <span className="font-medium text-gray-300">{totalItems}</span> results
      </div>

      {/* Center: Page numbers */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-2 py-1 text-xs text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {getPageNumbers().map((pageNum, index) =>
          pageNum === '...' ? (
            <span key={`dots-${index}`} className="px-2 py-1 text-xs text-gray-600">
              …
            </span>
          ) : (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum as number)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                currentPage === pageNum
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {pageNum}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-2 py-1 text-xs text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Right: Page size selector */}
      {onPageSizeChange && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Per page:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-gray-300 focus:outline-none focus:border-blue-600"
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      )}
    </div>
  );
}
