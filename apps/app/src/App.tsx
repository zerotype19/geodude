import React, { useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import SignInModal from './components/SignInModal.tsx'
import AuditsIndex from './routes/audits/index.tsx'
import NewAudit from './routes/audits/new.tsx'
import AuditDetail from './routes/audits/[id]/index.tsx'
import AuditReport from './routes/audits/[id]/report.tsx'
import PageDetail from './routes/audits/[id]/pages/[pageId].tsx'
import CategoryDetail from './routes/audits/[id]/category/[category].tsx'
import PublicAudit from './routes/public/[id].tsx'
import ScoreGuideIndex from './routes/score-guide/index.tsx'
import CriterionDetail from './routes/score-guide/[criterionId].tsx'
import AdminPage from './routes/admin.tsx'
import ClassifierCompare from './routes/admin/classifier-compare.tsx'
import HealthDashboard from './routes/admin/health.tsx'
import PromptsCompare from './routes/admin/prompts-compare.tsx'
import UsersPage from './routes/admin/users.tsx'
import FooterLegal from './components/FooterLegal.tsx'
import CheckEmail from './routes/auth/CheckEmail.tsx'
import Callback from './routes/auth/Callback.tsx'
import AuthError from './routes/auth/Error.tsx'
import Terms from './routes/Terms.tsx'
import Privacy from './routes/Privacy.tsx'

function Navigation() {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [signInModalOpen, setSignInModalOpen] = useState(false)
  
  // Skip auth check for public routes
  const isPublicRoute = location.pathname.startsWith('/public/')
  const { me, isAuthed, logout } = useAuth({ skip: isPublicRoute })
  
  // Check if user is an admin (from backend session)
  const isAdmin = me?.isAdmin === true
  
  // Hide navigation for public routes
  if (isPublicRoute) {
    return null
  }
  
  return (
    <nav className="bg-surface-1 border-b border-border shadow-sm relative">
      <div className="page-max container-px">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link
              to="/"
              className="text-xl font-black tracking-tight text-brand uppercase"
            >
              OPTIVIEW.AI
            </Link>
          </div>
          
          {/* Desktop navigation links */}
          <div className="hidden md:flex items-center space-x-6">
            <Link
              to="/audits"
              className={`text-sm font-medium transition-colors ${
                location.pathname === '/' || location.pathname === '/audits'
                  ? 'text-brand'
                  : 'muted hover:text-brand'
              }`}
            >
              My Audits
            </Link>
            <Link
              to="/score-guide"
              className={`text-sm font-medium transition-colors ${
                location.pathname.startsWith('/score-guide')
                  ? 'text-brand'
                  : 'muted hover:text-brand'
              }`}
            >
              Score Guide
            </Link>
            {isAdmin && (
              <Link
                to="/admin"
                className={`text-sm font-medium transition-colors ${
                  location.pathname.startsWith('/admin')
                    ? 'text-brand'
                    : 'muted hover:text-brand'
                }`}
              >
                Admin
              </Link>
            )}
            <div className="border-l border-border h-6"></div>
            {isAuthed && me ? (
              <div className="flex items-center space-x-4">
                <span className="text-sm subtle">{me.email}</span>
                <button
                  onClick={logout}
                  className="text-sm font-medium muted hover:text-brand transition-colors"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button
                onClick={() => setSignInModalOpen(true)}
                className="btn-primary text-sm"
              >
                Sign In
              </button>
            )}
          </div>
          
          {/* Mobile hamburger menu button */}
          <div className="md:hidden flex items-center relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="btn-ghost p-2"
              aria-expanded={menuOpen}
            >
              <span className="sr-only">Open menu</span>
              {!menuOpen ? (
                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              ) : (
                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </button>
            
            {/* Mobile dropdown menu - positioned below hamburger */}
            {menuOpen && (
              <div className="absolute top-full right-0 mt-2 w-72 card shadow-lg z-50">
          <div className="pt-2 pb-3 space-y-1">
            <Link
              to="/audits"
              onClick={() => setMenuOpen(false)}
              className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                location.pathname === '/' || location.pathname === '/audits'
                  ? 'bg-brand-soft border-brand text-brand'
                  : 'border-transparent muted hover:bg-surface-2 hover:border-border'
              }`}
            >
              My Audits
            </Link>
            <Link
              to="/score-guide"
              onClick={() => setMenuOpen(false)}
              className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                location.pathname.startsWith('/score-guide')
                  ? 'bg-brand-soft border-brand text-brand'
                  : 'border-transparent muted hover:bg-surface-2 hover:border-border'
              }`}
            >
              Score Guide
            </Link>
            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => setMenuOpen(false)}
                className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                  location.pathname.startsWith('/admin')
                    ? 'bg-brand-soft border-brand text-brand'
                    : 'border-transparent muted hover:bg-surface-2 hover:border-border'
                }`}
              >
                Admin
              </Link>
            )}
          </div>
          {/* Auth section */}
          <div className="pt-4 pb-3 border-t border-border">
            {isAuthed && me ? (
              <div className="space-y-1">
                <div className="px-4 text-sm subtle">
                  {me.email}
                </div>
                <button
                  onClick={() => {
                    logout();
                    setMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-base font-medium muted hover:bg-surface-2"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setSignInModalOpen(true);
                }}
                className="block w-full text-left px-4 py-2 text-base font-medium muted hover:bg-surface-2"
              >
                Sign In
              </button>
            )}
          </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Sign In Modal */}
      <SignInModal isOpen={signInModalOpen} onClose={() => setSignInModalOpen(false)} />
    </nav>
  )
}

function AppFooter() {
  const location = useLocation()
  const isPublicRoute = location.pathname.startsWith('/public/')
  
  // Hide footer for public routes
  if (isPublicRoute) {
    return null
  }
  
  return <FooterLegal />
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-surface-1 flex flex-col">
        <Navigation />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<AuditsIndex />} />
            <Route path="/audits" element={<AuditsIndex />} />
            <Route path="/audits/new" element={<NewAudit />} />
            <Route path="/audits/:id" element={<AuditDetail />} />
            <Route path="/audits/:id/report" element={<AuditReport />} />
            <Route path="/audits/:id/category/:category" element={<CategoryDetail />} />
            <Route path="/audits/:id/pages/:pageId" element={<PageDetail />} />
            <Route path="/public/:id" element={<PublicAudit />} />
            <Route path="/score-guide" element={<ScoreGuideIndex />} />
            <Route path="/score-guide/:criterionId" element={<CriterionDetail />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/classifier-compare" element={<ClassifierCompare />} />
            <Route path="/admin/health" element={<HealthDashboard />} />
            <Route path="/admin/prompts-compare" element={<PromptsCompare />} />
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/auth/check-email" element={<CheckEmail />} />
            <Route path="/auth/callback" element={<Callback />} />
            <Route path="/auth/error" element={<AuthError />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
          </Routes>
        </main>
        <AppFooter />
      </div>
    </BrowserRouter>
  )
}

export default App
