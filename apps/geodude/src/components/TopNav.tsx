import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { NavItem } from '../nav.config';
import { NavTabs } from './NavTabs';
import { SetupMenu } from './SetupMenu';
import { UserMenu } from './UserMenu';
import ProjectSwitcher from './ProjectSwitcher';
import CreateProjectModal from './CreateProjectModal';

interface Project {
  id: string;
  name: string;
  org_id?: string;
}

interface User {
  email: string;
  is_admin?: number | boolean;
}

interface TopNavProps {
  project: Project | null;
  user: User | null;
  navItemsInsights: NavItem[];
  navItemsSetup: NavItem[];
  isAdmin: boolean;
  onProjectChange?: (project: Project) => void;
}

export default function TopNav({
  project,
  user,
  navItemsInsights,
  navItemsSetup,
  isAdmin
}: TopNavProps) {
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="mx-auto max-w-screen-2xl px-4">
          <div className="h-12 flex items-center gap-3">
            {/* Brand */}
            <a 
              href="/" 
              className="shrink-0 font-semibold text-slate-900 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
            >
              Optiview
            </a>

            {/* Divider */}
            <div className="h-6 w-px bg-slate-200" />

            {/* Project switcher (single place) */}
            <ProjectSwitcher 
              onCreateProject={() => setShowCreateProjectModal(true)}
            />

            {/* Primary nav – Insights tabs (hidden on mobile) */}
            <NavTabs items={navItemsInsights} />

            {/* Spacer */}
            <div className="flex-1" />

            {/* Setup dropdown (always visible; items filtered by isAdmin) */}
            <SetupMenu items={navItemsSetup} isAdmin={isAdmin} />

            {/* User menu (single place) */}
            <UserMenu user={user} />

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Toggle mobile menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white">
            <div className="mx-auto max-w-screen-2xl px-4 py-4">
              {/* Insights Section */}
              <div className="mb-6">
                <h3 className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Insights
                </h3>
                <nav className="mt-2 space-y-1">
                  {navItemsInsights.map(item => (
                    <a
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block rounded-md px-2 py-2 text-sm font-medium ${
                        item.match(window.location.pathname)
                          ? "bg-slate-900 text-white"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {item.label}
                    </a>
                  ))}
                </nav>
              </div>

              {/* Setup Section */}
              <div>
                <h3 className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Setup
                </h3>
                <nav className="mt-2 space-y-1">
                  {navItemsSetup
                    .filter(item => (item.adminOnly ? isAdmin : true))
                    .map(item => (
                      <a
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`block rounded-md px-2 py-2 text-sm font-medium ${
                          item.match(window.location.pathname)
                            ? "bg-slate-900 text-white"
                            : "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {item.label}
                      </a>
                    ))}
                </nav>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={showCreateProjectModal}
        onClose={() => setShowCreateProjectModal(false)}
      />
    </>
  );
}
