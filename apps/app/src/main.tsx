import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AuditsIndex from './routes/audits/index.tsx'
import AuditDetail from './routes/audits/[id]/index.tsx'
import AuditPages from './routes/audits/[id]/pages/index.tsx'
import PageDetail from './routes/audits/[id]/pages/[pageId].tsx'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AuditsIndex />} />
        <Route path="/audits" element={<AuditsIndex />} />
        <Route path="/audits/:id" element={<AuditDetail />} />
        <Route path="/audits/:id/pages" element={<AuditPages />} />
        <Route path="/audits/:id/pages/:pageId" element={<PageDetail />} />
      </Routes>
    </BrowserRouter>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
