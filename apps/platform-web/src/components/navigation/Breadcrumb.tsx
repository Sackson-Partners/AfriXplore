'use client';

import Link from 'next/link';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

function ChevronRightIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-2 text-xs mb-4">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <div key={index} className="flex items-center gap-2">
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="text-gray-400 hover:text-gray-200 transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'text-white font-medium' : 'text-gray-400'}>
                {item.label}
              </span>
            )}
            {!isLast && (
              <span className="text-gray-600">
                <ChevronRightIcon />
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
