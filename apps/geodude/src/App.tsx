import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { useState, useEffect } from "react";
import { API_BASE, FETCH_OPTS } from "./config";
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

// Smart Default Route Component - redirects based on data availability
const SmartDefaultRoute = () => {
  const { user, project, loading } = useAuth();
  const [hasEvents, setHasEvents] = useState<boolean | null>(null);
  const [checkingEvents, setCheckingEvents] = useState(true);

  useEffect(() => {
    const checkForEvents = async () => {
      if (!project?.id || loading) return;
      
      try {
        setCheckingEvents(true);
        const response = await fetch(
          `${API_BASE}/api/events/has-any?project_id=${project.id}`,
          FETCH_OPTS
        );
        
        if (response.ok) {
          const data = await response.json();
          setHasEvents(data.hasAny || false);
        } else {
          // If API fails, default to events page
          setHasEvents(true);
        }
      } catch (error) {
        console.error('Failed to check events:', error);
        // If check fails, default to events page
        setHasEvents(true);
      } finally {
        setCheckingEvents(false);
      }
    };

    checkForEvents();
  }, [project?.id, loading]);

  if (loading || checkingEvents || hasEvents === null) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect based on events availability
  if (hasEvents) {
    return <Navigate to="/events" replace />;
  } else {
    return <Navigate to={`/install?project_id=${project?.id}`} replace />;
  }
};

// Public Route Component (redirects to home if already logged in)
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  
  if (user) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/onboarding" element={<Onboarding />} />
      
      {/* Protected Routes */}
      <Route path="/" element={<SmartDefaultRoute />} />
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
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
