import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Sources from "./pages/Sources";
import Content from "./pages/Content";
import Events from "./pages/Events";
import Referrals from "./pages/Referrals";
import Conversions from "./pages/Conversions";
import Citations from "./pages/Citations";
import Journeys from "./pages/Journeys";
import Settings from "./pages/Settings";
import Install from "./pages/Install";
import AdminHealth from "./pages/AdminHealth";
import ApiKeys from "./pages/ApiKeys";

// Debug imports
console.log('🔍 Import debug - Install:', Install);
console.log('🔍 Import debug - ApiKeys:', ApiKeys);
import DataPolicy from "./pages/DataPolicy";
import Docs from "./pages/Docs";
import Login from "./pages/Login";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Funnels from "./pages/Funnels";
import Recommendations from "./pages/Recommendations";
import TestPage from "./pages/TestPage";

// Route logger component
function RouteLogger() {
  const location = window.location;
  console.log('📍 Current route:', location.pathname, location.search);
  
  // Track route changes
  React.useEffect(() => {
    const handleRouteChange = () => {
      console.log('🔄 Route changed to:', window.location.pathname);
    };
    
    // Listen for navigation events
    window.addEventListener('popstate', handleRouteChange);
    
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, []);
  
  return null;
}

// Debug wrapper for Install page
function DebugInstall() {
  console.log('🔧 DebugInstall wrapper called');
  return <Install />;
}

// Debug wrapper for ApiKeys page
function DebugApiKeys() {
  console.log('🔑 DebugApiKeys wrapper called');
  return <ApiKeys />;
}

// MINIMAL ROUTING - NO AUTH CHECKS, NO COMPLEX LOGIC
function AppRoutes() {
  console.log('🔍 AppRoutes: Rendering all routes without auth checks');
  console.log('🔍 AppRoutes: Current URL is:', window.location.href);
  console.log('🔍 AppRoutes: Current pathname is:', window.location.pathname);
  
  return (
    <>
      <RouteLogger />
      <Routes>
      <Route path="/" element={<div className="min-h-screen bg-yellow-100 flex items-center justify-center"><div className="text-center"><h1 className="text-4xl font-bold text-yellow-800">ROOT PAGE</h1><p className="text-xl text-yellow-600 mt-4">You are on the root page</p></div></div>} />
      <Route path="/login" element={<Login />} />
      <Route path="/events" element={<Events />} />
      <Route path="/content" element={<Content />} />
      <Route path="/referrals" element={<Referrals />} />
      <Route path="/conversions" element={<Conversions />} />
      <Route path="/funnels" element={<Funnels />} />
      <Route path="/journeys" element={<Journeys />} />
      <Route path="/citations" element={<Citations />} />
      <Route path="/recommendations" element={<Recommendations />} />
      <Route path="/sources" element={<Sources />} />
      <Route path="/install" element={<DebugInstall />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/api-keys" element={<DebugApiKeys />} />
      <Route path="/test" element={<TestPage />} />
      <Route path="/debug123" element={<div className="min-h-screen bg-orange-100 flex items-center justify-center"><div className="text-center"><h1 className="text-4xl font-bold text-orange-800">DEBUG ROUTE WORKS!</h1><p className="text-xl text-orange-600 mt-4">This is a completely new route</p></div></div>} />
      <Route path="/data-policy" element={<DataPolicy />} />
      <Route path="/docs/*" element={<Docs />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/admin/health" element={<AdminHealth />} />
      <Route path="*" element={<Navigate to="/events" replace />} />
      </Routes>
    </>
  );
}

// Add a simple wrapper to catch any errors
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  try {
    return <>{children}</>;
  } catch (error) {
    console.error('❌ Error in routing:', error);
    return (
      <div className="min-h-screen bg-red-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-red-800">ROUTING ERROR</h1>
          <p className="text-xl text-red-600 mt-4">Error: {String(error)}</p>
        </div>
      </div>
    );
  }
}

function App() {
  console.log("🚀 GEODUDE APP STARTING - MINIMAL ROUTING (NO AUTH CHECKS)");
  
  // Add URL change listener
  React.useEffect(() => {
    const handleUrlChange = () => {
      console.log('🔗 URL changed to:', window.location.pathname);
    };
    
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);
  
  // TEMPORARILY REMOVE AuthProvider to test if it's causing redirects
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}

export default App;