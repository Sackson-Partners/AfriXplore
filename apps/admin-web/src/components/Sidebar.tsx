'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const DEV_MODE = !process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID;

// Load useMsal only in production to avoid crashing without MsalProvider.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const useMsal: () => { instance: { logoutPopup: () => Promise<void> } } = DEV_MODE
  ? () => ({ instance: { logoutPopup: async () => {} } })
  : (require('@azure/msal-react') as { useMsal: () => { instance: { logoutPopup: () => Promise<void> } } }).useMsal;

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '▣' },
  { href: '/mines', label: 'Mines', icon: '⛏' },
  { href: '/systems', label: 'Mineral Systems', icon: '◈' },
  { href: '/targets', label: 'MSIM Targets', icon: '◎' },
  { href: '/regions', label: 'Regions', icon: '⬡' },
  { href: '/records', label: 'Mining Records', icon: '≡' },
  { href: '/concessions', label: 'Concessions', icon: '⬜' },
  { href: '/ingestion', label: 'Ingestion', icon: '↑' },
  { href: '/subscribers', label: 'Subscribers', icon: '⊙' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { instance } = useMsal();

  function handleSignOut() {
    if (DEV_MODE) {
      sessionStorage.removeItem('ain_dev_authed');
      router.push('/');
    } else {
      void instance.logoutPopup();
    }
  }

  return (
    <aside className="w-56 bg-geo-slate border-r border-geo-steel flex flex-col h-screen sticky top-0 flex-shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-geo-steel">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-copper-light/20 border border-copper-light/40 flex items-center justify-center">
            <span className="text-[10px] font-bold text-copper-light">A</span>
          </div>
          <div>
            <p className="text-xs font-bold text-geo-white font-display tracking-wide">AIN Admin</p>
            <p className="text-[10px] text-copper-light uppercase tracking-widest font-semibold">Dev Mode</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                active
                  ? 'bg-brand-primary/15 text-geo-white border-l-2 border-brand-primary'
                  : 'text-geo-mist hover:bg-geo-graphite hover:text-geo-cloud border-l-2 border-transparent'
              }`}
            >
              <span className="text-base leading-none w-4 text-center opacity-70">{item.icon}</span>
              <span className={active ? 'font-medium' : ''}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="px-2 py-3 border-t border-geo-steel">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-geo-mist hover:text-signal-critical hover:bg-signal-critical/10 transition-all"
        >
          <span className="text-base leading-none w-4 text-center">⏻</span>
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
