'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMsal } from '@azure/msal-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/mines', label: 'Mines' },
  { href: '/systems', label: 'Mineral Systems' },
  { href: '/targets', label: 'MSIM Targets' },
  { href: '/subscribers', label: 'Subscribers' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { instance } = useMsal();

  return (
    <aside className="w-56 bg-gray-900 text-white flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-gray-700">
        <h1 className="font-bold text-sm text-amber-400 uppercase tracking-wider">AIN Admin</h1>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`block px-3 py-2 rounded-md text-sm transition-colors ${
              pathname === item.href
                ? 'bg-amber-500 text-gray-900 font-medium'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-gray-700">
        <button
          onClick={() => { void instance.logoutPopup(); }}
          className="w-full text-left px-3 py-2 rounded-md text-sm text-gray-400 hover:text-white hover:bg-gray-700"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
