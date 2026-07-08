'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

function DroneIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}

function SurveyIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
    </svg>
  );
}

function AnomalyIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}
function PartnersIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  );
}
function VaultIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

function MissionsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ScoutsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  { href: '/missions', label: 'Missions', icon: <MissionsIcon /> },
  { href: '/scouts', label: 'Scout Network', icon: <ScoutsIcon /> },
  { href: '/surveys', label: 'Survey Orders', icon: <SurveyIcon /> },
  { href: '/drones', label: 'Drone Fleet', icon: <DroneIcon /> },
  { href: '/map', label: '3D Seismic Map', icon: <MapIcon /> },
  { href: '/anomalies', label: 'Anomalies', icon: <AnomalyIcon /> },
  { href: '/reports', label: 'Scout Reports', icon: <ReportIcon /> },
  { href: '/partners', label: 'Partners', icon: <PartnersIcon /> },
  { href: '/vault', label: 'Data Vault', icon: <VaultIcon /> },
];

function NavButton({ item, isActive }: { item: NavItem; isActive: boolean }) {
  return (
    <div className="relative group">
      <Link
        href={item.href}
        className={`
          relative flex items-center justify-center w-12 h-12 rounded-xl mx-1 transition-all duration-150
          ${isActive
            ? 'bg-geo-graphite text-drone-primary'
            : 'text-geo-mist hover:bg-geo-graphite/60 hover:text-geo-cloud'}
        `}
      >
        {isActive && (
          <span className="absolute left-0 top-3 bottom-3 w-0.5 bg-drone-primary rounded-r-full" />
        )}
        {item.icon}
      </Link>
      {/* Tooltip */}
      <div className="absolute left-14 top-1/2 -translate-y-1/2 z-50 hidden group-hover:block pointer-events-none">
        <div className="bg-geo-graphite border border-geo-steel text-geo-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
          {item.label}
        </div>
        <div
          className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0"
          style={{ borderRight: '5px solid #374151', borderTop: '5px solid transparent', borderBottom: '5px solid transparent' }}
        />
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-16 bg-geo-slate border-r border-geo-steel flex flex-col z-40">
      {/* Logo */}
      <div className="flex items-center justify-center h-14 border-b border-geo-steel flex-shrink-0">
        <div className="w-8 h-8 bg-drone-primary rounded-lg flex items-center justify-center shadow-glow-drone">
          <DroneIcon />
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 flex flex-col gap-1 py-3">
        {NAV_ITEMS.map((item) => (
          <NavButton
            key={item.href}
            item={item}
            isActive={pathname === item.href || pathname.startsWith(item.href + '/')}
          />
        ))}
      </nav>

      {/* Divider */}
      <div className="h-px bg-geo-steel mx-3" />

      {/* User placeholder */}
      <div className="flex flex-col gap-1 py-3">
        <div className="relative group mx-1">
          <button className="flex items-center justify-center w-12 h-12 rounded-xl text-geo-mist hover:bg-geo-graphite/60 hover:text-geo-cloud transition-all duration-150">
            <div className="w-7 h-7 rounded-full bg-drone-primary flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">U</span>
            </div>
          </button>
          <div className="absolute left-14 bottom-0 z-50 hidden group-hover:block pointer-events-none">
            <div className="bg-geo-graphite border border-geo-steel text-geo-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
              Sign out
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
