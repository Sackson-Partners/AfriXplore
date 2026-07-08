'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { ALERTS } from '@/lib/mock-data';
import { SearchPanel } from './SearchPanel';

const PAGE_META: Record<string, { title: string; breadcrumb: string[] }> = {
  '/dashboard': { title: 'Discovery Intelligence', breadcrumb: ['Discovery', 'Dashboard'] },
  '/library': { title: 'Mine Target Library', breadcrumb: ['Intelligence', 'Library'] },
  '/convergence': { title: 'Convergence Dashboard', breadcrumb: ['Intelligence', 'Convergence'] },
  '/convergence-events': { title: 'Score Change Events', breadcrumb: ['Intelligence', 'Events'] },
  '/mines': { title: 'Mine Details', breadcrumb: ['Intelligence', 'Mines'] },
  '/targets': { title: 'Target Book', breadcrumb: ['Intelligence', 'Drill Targets'] },
  '/territory': { title: 'Territory Management', breadcrumb: ['Platform', 'Territory'] },
  '/api-portal': { title: 'API Portal', breadcrumb: ['Developer', 'API'] },
};

function BellIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

interface TopBarProps {
  onMenuClick?: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const pathname = usePathname();
  const [showAlerts, setShowAlerts] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Global keyboard shortcut (Cmd+K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Find matching page meta (check for dynamic routes like /mines/[id])
  const basePath = '/' + (pathname.split('/')[1] ?? '');
  const meta = PAGE_META[basePath] ?? {
    title: 'MSIM Platform',
    breadcrumb: ['Platform'],
  };

  const unreadCount = ALERTS.filter((a) => a.unread).length;

  return (
    <header className="flex items-center justify-between h-14 px-3 md:px-5 border-b border-geo-steel bg-geo-slate flex-shrink-0 relative z-30">
      {/* Left: mobile menu + breadcrumb + title */}
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 text-geo-mist hover:text-geo-cloud transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        {/* Breadcrumb - hidden on mobile */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-geo-mist">
          <Link href="/dashboard" className="hover:text-geo-cloud transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
          </Link>
          {meta.breadcrumb.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span>/</span>
              <span className={i === meta.breadcrumb.length - 1 ? 'text-geo-cloud font-medium' : ''}>
                {crumb}
              </span>
            </span>
          ))}
        </div>
        <div className="hidden md:block h-4 w-px bg-geo-steel" />
        <h1 className="font-display font-semibold text-geo-white text-sm truncate">{meta.title}</h1>
      </div>

      {/* Right: search + actions */}
      <div className="flex items-center gap-2">
        {/* Search trigger */}
        <button
          onClick={() => setShowSearch(true)}
          className="relative flex items-center gap-2 h-8 pl-3 pr-2 w-48 md:w-64 bg-geo-graphite border border-geo-steel rounded-full text-xs text-geo-mist hover:border-geo-mist transition-all cursor-pointer"
        >
          <SearchIcon />
          <span className="hidden sm:inline truncate">Search mines, targets…</span>
          <span className="sm:hidden">Search…</span>
          <kbd className="hidden md:inline ml-auto px-1.5 py-0.5 text-[10px] bg-geo-steel rounded border border-geo-mist/20">⌘K</kbd>
        </button>

        {/* Alert bell */}
        <div className="relative">
          <button
            onClick={() => setShowAlerts(!showAlerts)}
            className="relative flex items-center justify-center w-8 h-8 rounded-lg text-geo-mist hover:bg-geo-graphite hover:text-geo-cloud transition-all"
          >
            <BellIcon />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-3 h-3 bg-signal-critical rounded-full text-[8px] font-bold text-white flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Alert dropdown */}
          {showAlerts && (
            <div className="absolute right-0 top-10 w-80 bg-geo-graphite border border-geo-steel rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in-up">
              <div className="px-4 py-3 border-b border-geo-steel flex items-center justify-between">
                <span className="text-xs font-semibold text-geo-white uppercase tracking-widest">Alerts</span>
                <span className="text-[10px] bg-signal-critical/20 text-signal-critical px-2 py-0.5 rounded font-medium">
                  {unreadCount} NEW
                </span>
              </div>
              <div className="divide-y divide-geo-steel/50 max-h-72 overflow-y-auto">
                {ALERTS.slice(0, 4).map((alert) => {
                  const colors = {
                    critical: '#EF4444', high: '#F97316', medium: '#EAB308', low: '#22C55E',
                  };
                  return (
                    <div key={alert.id} className="px-3 py-2.5 hover:bg-geo-steel/20 cursor-pointer"
                      style={{ borderLeft: `2px solid ${colors[alert.severity]}` }}>
                      <p className={`text-[11px] leading-snug ${alert.unread ? 'font-semibold text-geo-white' : 'text-geo-cloud'}`}>
                        {alert.title}
                      </p>
                      <p className="text-[10px] text-geo-mist mt-0.5">{alert.timestamp}</p>
                    </div>
                  );
                })}
              </div>
              <div className="px-4 py-2.5 border-t border-geo-steel">
                <Link
                  href="/dashboard"
                  className="text-[11px] text-brand-primary hover:underline font-medium"
                  onClick={() => setShowAlerts(false)}
                >
                  View all alerts →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Territory selector - hidden on mobile */}
        <button className="hidden md:flex items-center gap-1.5 h-8 px-3 bg-geo-graphite border border-geo-steel rounded-lg text-xs text-geo-cloud hover:border-geo-mist transition-colors">
          <span>🇿🇲</span>
          <span>Zambia</span>
          <svg className="w-3 h-3 text-geo-mist" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Avatar - hidden on mobile in favor of menu */}
        <div className="hidden lg:flex w-8 h-8 rounded-full bg-brand-primary items-center justify-center">
          <span className="text-[10px] font-bold text-white">U</span>
        </div>
      </div>

      {/* Search Modal */}
      <SearchPanel isOpen={showSearch} onClose={() => setShowSearch(false)} />
    </header>
  );
}
