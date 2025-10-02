import React, { useState } from 'react';
import { Menu, X, User, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ProjectSwitcher from './ProjectSwitcher';
import PropertySwitcher from './PropertySwitcher';

export default function SimpleTopNav() {
  const { user, project } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigate = (page: string) => {
    window.history.pushState({}, '', `/${page}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const logout = () => {
    // Simple logout - just redirect to login
    window.location.href = '/login';
  };

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="mx-auto max-w-screen-2xl px-4">
        <div className="h-12 flex items-center gap-3 min-w-0">
          {/* Brand */}
          <a 
            href="/" 
            className="shrink-0 font-semibold text-slate-900 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
          >
            Optiview
          </a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1 min-w-0 flex-1">
            <button
              onClick={() => navigate('events')}
              className="px-3 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
            >
              Events
            </button>
            <button
              onClick={() => navigate('content')}
              className="px-3 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
            >
              Content
            </button>
            <button
              onClick={() => navigate('install')}
              className="px-3 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
            >
              Install
            </button>
            <button
              onClick={() => navigate('api-keys')}
              className="px-3 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
            >
              API Keys
            </button>
            <button
              onClick={() => navigate('settings')}
              className="px-3 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
            >
              Settings
            </button>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Project and Property Switchers */}
            <div className="hidden lg:flex items-center gap-2">
              <ProjectSwitcher />
              <PropertySwitcher onCreateProperty={() => console.log('Create property modal coming soon')} />
            </div>

            {/* User menu */}
            <div className="relative">
              <button
                onClick={logout}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
              >
                <User className="h-4 w-4" />
                {user?.email}
              </button>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 py-2">
            <div className="space-y-1">
              <button
                onClick={() => {
                  navigate('events');
                  setMobileMenuOpen(false);
                }}
                className="block w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md"
              >
                Events
              </button>
              <button
                onClick={() => {
                  navigate('content');
                  setMobileMenuOpen(false);
                }}
                className="block w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md"
              >
                Content
              </button>
              <button
                onClick={() => {
                  navigate('install');
                  setMobileMenuOpen(false);
                }}
                className="block w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md"
              >
                Install
              </button>
              <button
                onClick={() => {
                  navigate('api-keys');
                  setMobileMenuOpen(false);
                }}
                className="block w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md"
              >
                API Keys
              </button>
              <button
                onClick={() => {
                  navigate('settings');
                  setMobileMenuOpen(false);
                }}
                className="block w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md"
              >
                Settings
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
