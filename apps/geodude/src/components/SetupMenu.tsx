import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { NavItem } from '../nav.config';

interface SetupMenuProps {
  items: NavItem[];
  isAdmin: boolean;
}

export function SetupMenu({ items, isAdmin }: SetupMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Filter items based on admin status
  const filteredItems = items.filter(item => (item.adminOnly ? isAdmin : true));

  // Compute active state for each item
  const itemsWithActive = filteredItems.map(item => ({
    ...item,
    active: item.match(location.pathname)
  }));

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
      buttonRef.current?.focus();
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        aria-label="Setup menu"
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        <Settings className="h-5 w-5" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop for mobile */}
          <div 
            className="fixed inset-0 z-40 md:hidden" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu */}
          <div 
            className="absolute right-0 mt-2 w-56 z-50 rounded-xl border border-slate-200 bg-white shadow-lg focus:outline-none"
            onKeyDown={handleKeyDown}
          >
            <div className="py-1">
              {itemsWithActive.map(item => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`block px-3 py-2 text-sm transition-colors ${
                    item.active 
                      ? "font-semibold text-slate-900 bg-slate-50" 
                      : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
