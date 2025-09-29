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
import DataPolicy from "./pages/DataPolicy";
import Docs from "./pages/Docs";
import Login from "./pages/Login";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Onboarding from "./pages/Onboarding";
import Funnels from "./pages/Funnels";
import Recommendations from "./pages/Recommendations";
import LandingGate from "./components/LandingGate";
import { useEffect } from "react";

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Landing Gate handles smart routing only for root path "/"
// All other routes go directly to their pages without redirect logic

// Public Route Component (redirects to home if already logged in)
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (user) {
    return <Navigate to="/events" replace />;
  }

  return <>{children}</>;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/onboarding" element={<Onboarding />} />

      {/* Smart landing only for root path - checks for data and redirects accordingly */}
      <Route path="/" element={<LandingGate />} />

      {/* Protected Routes - these load directly without redirect logic */}
      <Route path="/events" element={<ProtectedRoute><Events /></ProtectedRoute>} />
      <Route path="/content" element={<ProtectedRoute><Content /></ProtectedRoute>} />
      <Route path="/referrals" element={<ProtectedRoute><Referrals /></ProtectedRoute>} />
      <Route path="/conversions" element={<ProtectedRoute><Conversions /></ProtectedRoute>} />
      <Route path="/funnels" element={<ProtectedRoute><Funnels /></ProtectedRoute>} />
      <Route path="/journeys" element={<ProtectedRoute><Journeys /></ProtectedRoute>} />
      <Route path="/citations" element={<ProtectedRoute><Citations /></ProtectedRoute>} />
      <Route path="/recommendations" element={<ProtectedRoute><Recommendations /></ProtectedRoute>} />
      <Route path="/sources" element={<ProtectedRoute><Sources /></ProtectedRoute>} />
      <Route path="/install" element={<ProtectedRoute><Install /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/api-keys" element={<ProtectedRoute><ApiKeys /></ProtectedRoute>} />
      <Route path="/data-policy" element={<ProtectedRoute><DataPolicy /></ProtectedRoute>} />
      <Route path="/docs/*" element={<ProtectedRoute><Docs /></ProtectedRoute>} />

      {/* Public Routes */}
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/admin/health" element={<AdminHealth />} />

      {/* SPA fallback - any unmatched route goes to events */}
      <Route path="*" element={<ProtectedRoute><Events /></ProtectedRoute>} />
    </Routes>
  );
}

function App() {
  // NUCLEAR BUNDLE CHANGE: Force completely different content hash
  const buildTimestamp = "DEPLOYMENT_2025-08-19T02-27-00Z";
  const cacheBuster = Date.now(); // Add runtime cache buster
  const debugInfo = {
    timestamp: buildTimestamp,
    cacheBuster,
    buildId: Math.random().toString(36),
    forced: true
  };
  console.log("🚀 GEODUDE APP STARTING:", debugInfo);
  
  // Add cache-busting effect to prevent 308 redirects
  useEffect(() => {
    // Force a fresh navigation to clear any cached redirects
    if (window.location.pathname === '/') {
      console.log(`🔄 App: Cache busting root path [${cacheBuster}]`);
    }
  }, [cacheBuster]);
  
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
