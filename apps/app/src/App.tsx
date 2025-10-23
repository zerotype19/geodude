import React, { useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import SignInModal from './components/SignInModal.tsx'
import AuditsIndex from './routes/audits/index.tsx'
import NewAudit from './routes/audits/new.tsx'
import AuditDetail from './routes/audits/[id]/index.tsx'
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

function Navigation() {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [signInModalOpen, setSignInModalOpen] = useState(false)
  const { me, isAuthed, logout } = useAuth()
  
  // Check if user is an admin (from backend session)
  const isAdmin = me?.isAdmin === true
  
  return (
    <nav className="bg-surface-1 border-b border-border shadow-sm relative">
      <div className="page-max container-px">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link 
              to="/" 
              className="text-xl font-black tracking-tight text-brand"
            >
              OPTIVIEW.AI
            </Link>
          </div>
          
          {/* Hamburger menu button */}
          <div className="flex items-center relative">
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
            
            {/* Dropdown menu - positioned below hamburger */}
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
          </Routes>
        </main>
        <FooterLegal />
      </div>
    </BrowserRouter>
  )
}

export default App
