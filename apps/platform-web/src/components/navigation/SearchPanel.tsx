'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { globalSearch, SearchResult } from '@/lib/search';
import Link from 'next/link';

interface SearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

function SearchIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

function getTypeIcon(type: SearchResult['type']) {
  switch (type) {
    case 'mine':
      return '⛏️';
    case 'convergence':
      return '⚡';
    case 'target':
      return '🎯';
    case 'document':
      return '📄';
    default:
      return '•';
  }
}

function getTypeLabel(type: SearchResult['type']) {
  switch (type) {
    case 'mine':
      return 'Mine';
    case 'convergence':
      return 'Convergence';
    case 'target':
      return 'Target';
    case 'document':
      return 'Document';
    default:
      return '';
  }
}

export function SearchPanel({ isOpen, onClose, initialQuery = '' }: SearchPanelProps) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (query.trim().length >= 2) {
        setIsSearching(true);
        try {
          const response = await globalSearch(query);
          setResults(response.results);
        } catch (error) {
          console.error('Search error:', error);
          setResults([]);
        } finally {
          setIsSearching(false);
        }
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      router.push(results[selectedIndex].url);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Search Modal */}
      <div className="fixed inset-x-0 top-20 z-50 flex justify-center px-4">
        <div className="w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
            <span className="text-gray-400">
              <SearchIcon />
            </span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search mines, targets, coordinates…"
              className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none text-sm"
            />
            <kbd className="px-2 py-1 text-xs text-gray-500 bg-gray-800 rounded border border-gray-700">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-96 overflow-y-auto">
            {isSearching ? (
              <div className="p-8 text-center">
                <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-400 mt-2">Searching...</p>
              </div>
            ) : results.length > 0 ? (
              <div className="py-2">
                {results.map((result, index) => (
                  <Link
                    key={result.id}
                    href={result.url}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition-colors ${
                      index === selectedIndex ? 'bg-gray-800' : ''
                    }`}
                  >
                    <span className="text-2xl">{getTypeIcon(result.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-white truncate">
                          {result.title}
                        </h3>
                        <span className="text-xs text-gray-500 px-1.5 py-0.5 bg-gray-800 rounded">
                          {getTypeLabel(result.type)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 truncate">{result.subtitle}</p>
                      {result.metadata && (
                        <p className="text-xs text-gray-500 mt-0.5">{result.metadata}</p>
                      )}
                    </div>
                    {result.score !== undefined && (
                      <div className="text-right">
                        <div className="text-lg font-mono font-bold text-blue-400">
                          {result.score.toFixed(0)}
                        </div>
                        <div className="text-xs text-gray-500">score</div>
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            ) : query.trim().length >= 2 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-gray-400">No results found for "{query}"</p>
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="text-sm text-gray-500">Type at least 2 characters to search</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-gray-800 bg-gray-900/50">
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700">↑</kbd>
                <kbd className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700">↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700">↵</kbd>
                select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700">ESC</kbd>
                close
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
