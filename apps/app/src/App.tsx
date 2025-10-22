import React, { useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import './index.css'
import { useAuth } from './hooks/useAuth'
import SignInModal from './components/SignInModal.tsx'
import AuditsIndex from './routes/audits/index.tsx'
import NewAudit from './routes/audits/new.tsx'
import AuditDetail from './routes/audits/[id]/index.tsx'
import AuditPages from './routes/audits/[id]/pages/index.tsx'
import PageDetail from './routes/audits/[id]/pages/[pageId].tsx'
import ScoreGuideIndex from './routes/score-guide/index.tsx'
import ScoreGuideDetail from './routes/score-guide/$slug.tsx'
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
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link 
              to="/" 
              className="text-xl font-black tracking-tight"
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}
            >
              OPTIVIEW.AI
            </Link>
          </div>
          
          {/* Hamburger menu button (all screen sizes) */}
          <div className="flex items-center">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              aria-expanded={menuOpen}
            >
              <span className="sr-only">Open menu</span>
              {/* Hamburger icon */}
              {!menuOpen ? (
                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              ) : (
                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Slide-out menu (all screen sizes) */}
              {menuOpen && (
                <div className="border-t border-gray-200">
                  <div className="pt-2 pb-3 space-y-1">
                    <Link
                      to="/audits"
                      onClick={() => setMenuOpen(false)}
                      className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                        location.pathname === '/' || location.pathname === '/audits'
                          ? 'bg-blue-50 border-blue-500 text-blue-700'
                          : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
                      }`}
                    >
                      My Audits
                    </Link>
                    <Link
                      to="/score-guide"
                      onClick={() => setMenuOpen(false)}
                      className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                        location.pathname.startsWith('/score-guide')
                          ? 'bg-blue-50 border-blue-500 text-blue-700'
                          : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
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
                            ? 'bg-blue-50 border-blue-500 text-blue-700'
                            : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
                        }`}
                      >
                        Admin
                      </Link>
                    )}
                  </div>
          {/* Auth section */}
          <div className="pt-4 pb-3 border-t border-gray-200">
            {isAuthed && me ? (
              <div className="space-y-1">
                <div className="px-4 text-sm text-gray-600">
                  {me.email}
                </div>
                <button
                  onClick={() => {
                    logout();
                    setMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-50"
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
                className="block w-full text-left px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-50"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Sign In Modal */}
      <SignInModal isOpen={signInModalOpen} onClose={() => setSignInModalOpen(false)} />
    </nav>
  )
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Navigation />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<AuditsIndex />} />
            <Route path="/audits" element={<AuditsIndex />} />
            <Route path="/audits/new" element={<NewAudit />} />
            <Route path="/audits/:id" element={<AuditDetail />} />
            <Route path="/audits/:id/pages" element={<AuditPages />} />
            <Route path="/audits/:id/pages/:pageId" element={<PageDetail />} />
            <Route path="/score-guide" element={<ScoreGuideIndex />} />
            <Route path="/score-guide/:slug" element={<ScoreGuideDetail />} />
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
