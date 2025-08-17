import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, LineChart, PlusSquare, Settings, User, Users, Building2, ChevronDown, LogOut } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

interface ShellProps {
  children: ReactNode;
}

export default function Shell({ children }: ShellProps) {
  const location = useLocation();
  const { user, organization, project, logout, listOrganizations, listProjects, switchContext } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [availableOrgs, setAvailableOrgs] = useState<Array<{ id: string, name: string }>>([]);
  const [availableProjects, setAvailableProjects] = useState<Array<{ id: string, name: string, org_id: string }>>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);

  // Load available organizations and projects when org menu opens
  useEffect(() => {
    if (orgMenuOpen && availableOrgs.length === 0) {
      loadAvailableContexts();
    }
  }, [orgMenuOpen]);

  const loadAvailableContexts = async () => {
    setLoadingOrgs(true);
    try {
      const [orgs, projects] = await Promise.all([
        listOrganizations(),
        listProjects()
      ]);
      setAvailableOrgs(orgs);
      setAvailableProjects(projects);
    } catch (error) {
      console.error('Failed to load available contexts:', error);
    } finally {
      setLoadingOrgs(false);
    }
  };

  const handleContextSwitch = async (orgId: string, projectId: string) => {
    try {
      await switchContext(orgId, projectId);
      setOrgMenuOpen(false);
    } catch (error) {
      console.error('Failed to switch context:', error);
    }
  };

  const navigation = [
    { name: "Events", href: "/events" },
    { name: "Sources", href: "/sources" },
    { name: "Content", href: "/content" },
    { name: "Citations", href: "/citations" },
    { name: "Journeys", href: "/journeys" },
    { name: "Funnels", href: "/funnels" },
    { name: "Recommendations", href: "/recommendations" },
    { name: "Install", href: "/install" },
    { name: "API Keys", href: "/api-keys" },
    { name: "Data Policy", href: "/data-policy" },
    { name: "Settings", href: "/settings" },
    // Only show Health for admin users
    ...(user?.is_admin ? [{ name: "Health", href: "/admin/health" }] : []),
  ];

  const handleLogout = () => {
    logout();
    setUserMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link to="/" className="text-xl font-bold text-blue-600">
                  Optiview
                </Link>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${isActive
                        ? "border-blue-500 text-gray-900"
                        : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                        }`}
                    >
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:items-center">
              <div className="ml-3 relative">
                {/* Organization/Project Selector */}
                <div className="relative mr-4">
                  <button
                    onClick={() => setOrgMenuOpen(!orgMenuOpen)}
                    className="flex items-center space-x-2 text-sm text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md px-3 py-2 border border-gray-300"
                  >
                    <Building2 className="h-4 w-4" />
                    <span className="max-w-32 truncate">
                      {organization?.name || 'Loading...'}
                    </span>
                    <span className="text-gray-400">/</span>
                    <span className="max-w-32 truncate">
                      {project?.name || 'Loading...'}
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </button>

                  {orgMenuOpen && (
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                      <div className="py-2">
                        <div className="px-4 py-2 border-b border-gray-100">
                          <h3 className="text-sm font-medium text-gray-900">Current Selection</h3>
                          <p className="text-sm text-gray-500 mt-1">
                            <span className="font-medium">{organization?.name}</span> / {project?.name}
                          </p>
                        </div>

                        {loadingOrgs ? (
                          <div className="px-4 py-2">
                            <p className="text-sm text-gray-500">Loading available contexts...</p>
                          </div>
                        ) : (
                          <div className="max-h-64 overflow-y-auto">
                            {availableOrgs.map((org) => {
                              const orgProjects = availableProjects.filter(p => p.org_id === org.id);
                              return (
                                <div key={org.id} className="border-b border-gray-100 last:border-b-0">
                                  <div className="px-4 py-2 bg-gray-50">
                                    <h4 className="text-sm font-medium text-gray-900">{org.name}</h4>
                                  </div>
                                  {orgProjects.map((proj) => (
                                    <button
                                      key={proj.id}
                                      onClick={() => handleContextSwitch(org.id, proj.id)}
                                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${org.id === organization?.id && proj.id === project?.id
                                          ? 'bg-blue-50 text-blue-700'
                                          : 'text-gray-700'
                                        }`}
                                    >
                                      <span className="ml-4">{proj.name}</span>
                                      {org.id === organization?.id && proj.id === project?.id && (
                                        <span className="ml-2 text-blue-600">✓</span>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {availableOrgs.length === 0 && !loadingOrgs && (
                          <div className="px-4 py-2">
                            <p className="text-xs text-gray-500">No other organizations available</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* User Menu */}
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center space-x-2 text-sm text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md px-3 py-2 border border-gray-300"
                  >
                    <User className="h-4 w-4" />
                    <span className="max-w-32 truncate">
                      {user?.email || 'Loading...'}
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                      <div className="py-2">
                        <div className="px-4 py-2 border-b border-gray-100">
                          <p className="text-sm font-medium text-gray-900">{user?.email}</p>
                          <p className="text-xs text-gray-500">
                            {organization?.name} / {project?.name}
                          </p>
                        </div>
                        <button
                          onClick={handleLogout}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                        >
                          <LogOut className="h-4 w-4" />
                          <span>Sign out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile menu button */}
            <div className="flex items-center sm:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                aria-expanded="false"
              >
                <span className="sr-only">Open main menu</span>
                {mobileMenuOpen ? (
                  <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile navigation */}
      <div className={`sm:hidden ${mobileMenuOpen ? 'block' : 'hidden'}`}>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-75 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />

        {/* Mobile menu panel */}
        <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out">
          <div className="pt-2 pb-3 space-y-1 bg-white border-b border-gray-200 shadow-lg h-full overflow-y-auto">
            {/* Header with close button */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Menu</h3>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Current Context Display */}
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <Building2 className="h-4 w-4 text-gray-500" />
                <div className="text-sm">
                  <p className="font-medium text-gray-900">
                    {organization?.name || 'Loading...'}
                  </p>
                  <p className="text-gray-500">
                    {project?.name || 'Loading...'}
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation Links */}
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block pl-4 pr-4 py-3 border-l-4 text-base font-medium ${isActive
                      ? "bg-blue-50 border-blue-500 text-blue-700"
                      : "border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800"
                    }`}
                >
                  {item.name}
                </Link>
              );
            })}

            {/* User Info and Actions */}
            <div className="border-t border-gray-200 pt-4 pb-3 mt-auto">
              <div className="px-4 py-2">
                <p className="text-sm font-medium text-gray-900">{user?.email}</p>
                <p className="text-xs text-gray-500">Signed in</p>
              </div>
              <button
                onClick={() => {
                  handleLogout();
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-4 py-3 text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-800 flex items-center space-x-2"
              >
                <LogOut className="h-5 w-5" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Breadcrumbs */}
        <div className="px-4 sm:px-0 mb-4">
          <nav className="flex" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2">
              <li>
                <Link to="/" className="text-gray-400 hover:text-gray-500">
                  <span className="sr-only">Home</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                  </svg>
                </Link>
              </li>
              {organization && (
                <>
                  <li>
                    <svg className="h-5 w-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </li>
                  <li>
                    <span className="text-sm font-medium text-gray-500">
                      {organization.name}
                    </span>
                  </li>
                </>
              )}
              {project && (
                <>
                  <li>
                    <svg className="h-5 w-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </li>
                  <li>
                    <span className="text-sm font-medium text-gray-500">
                      {project.name}
                    </span>
                  </li>
                </>
              )}
              {location.pathname !== "/" && (
                <>
                  <li>
                    <svg className="h-5 w-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </li>
                  <li>
                    <span className="text-sm font-medium text-gray-500 capitalize">
                      {location.pathname.split('/').filter(Boolean).join(' / ')}
                    </span>
                  </li>
                </>
              )}
            </ol>
          </nav>
        </div>

        <div className="px-4 py-6 sm:px-0">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              © 2024 {organization?.name || 'Optiview'}. All rights reserved.
            </div>
            <div className="flex space-x-6">
              <Link
                to="/docs"
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Documentation
              </Link>
              <Link
                to="/privacy"
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Privacy
              </Link>
              <Link
                to="/terms"
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Terms
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
