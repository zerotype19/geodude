import React from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import './index.css'
import AuditsIndex from './routes/audits/index.tsx'
import AuditDetail from './routes/audits/[id]/index.tsx'
import AuditPages from './routes/audits/[id]/pages/index.tsx'
import PageDetail from './routes/audits/[id]/pages/[pageId].tsx'
import ScoreGuide from './routes/ScoreGuide.tsx'
import HelpScoring from './routes/help/scoring.tsx'
import CitationsGuide from './routes/help/citations.tsx'

function Navigation() {
  const location = useLocation()
  
  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link to="/" className="text-xl font-bold text-gray-900">
                Optiview
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                to="/audits"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  location.pathname === '/' || location.pathname === '/audits'
                    ? 'border-blue-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                Audits
              </Link>
              <Link
                to="/score-guide"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  location.pathname === '/score-guide'
                    ? 'border-blue-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                Score Guide
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main>
          <Routes>
            <Route path="/" element={<AuditsIndex />} />
            <Route path="/audits" element={<AuditsIndex />} />
            <Route path="/audits/:id" element={<AuditDetail />} />
            <Route path="/audits/:id/pages" element={<AuditPages />} />
            <Route path="/audits/:id/pages/:pageId" element={<PageDetail />} />
            <Route path="/score-guide" element={<ScoreGuide />} />
            <Route path="/help/scoring" element={<HelpScoring />} />
            <Route path="/help/citations" element={<CitationsGuide />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
