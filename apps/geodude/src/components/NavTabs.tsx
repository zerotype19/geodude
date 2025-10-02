import React from 'react';
// Removed React Router dependency
import { NavItem } from '../nav.config';

interface NavTabsProps {
  items: NavItem[];
}

export function NavTabs({ items }: NavTabsProps) {
  // Get current path from window.location (no React Router)
  const location = { pathname: window.location.pathname };

  // Compute active state for each item
  const tabsWithActive = items.map(item => ({
    ...item,
    active: item.match(location.pathname)
  }));

  return (
    <nav
      className="hidden md:block max-w-[56vw] overflow-x-auto overscroll-x-contain"
      aria-label="Primary"
    >
      <ul className="flex items-center gap-2 whitespace-nowrap pr-2">
        {tabsWithActive.map(item => (
          <li key={item.href}>
            <a
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={`inline-flex h-9 items-center rounded-md px-3 text-sm font-medium transition-colors ${
                item.active
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
