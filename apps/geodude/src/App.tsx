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
import Funnels from "./pages/Funnels";
import Recommendations from "./pages/Recommendations";

// Ultra-simple route component - no loading states, no complex logic
function AppRoutes() {
  const { user } = useAuth();

  // If no user, show login
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/admin/health" element={<AdminHealth />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // If user exists, show all pages
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/events" replace />} />
      <Route path="/login" element={<Navigate to="/events" replace />} />
      <Route path="/events" element={<Events />} />
      <Route path="/content" element={<Content />} />
      <Route path="/referrals" element={<Referrals />} />
      <Route path="/conversions" element={<Conversions />} />
      <Route path="/funnels" element={<Funnels />} />
      <Route path="/journeys" element={<Journeys />} />
      <Route path="/citations" element={<Citations />} />
      <Route path="/recommendations" element={<Recommendations />} />
      <Route path="/sources" element={<Sources />} />
      <Route path="/install" element={<Install />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/api-keys" element={<ApiKeys />} />
      <Route path="/data-policy" element={<DataPolicy />} />
      <Route path="/docs/*" element={<Docs />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/admin/health" element={<AdminHealth />} />
      <Route path="*" element={<Navigate to="/events" replace />} />
    </Routes>
  );
}

function App() {
  console.log("🚀 GEODUDE APP STARTING - ULTRA SIMPLE ROUTING");
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;