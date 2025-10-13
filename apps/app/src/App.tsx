import { Routes, Route, Link, useLocation } from "react-router-dom";
import Dashboard from "./routes/Dashboard";
import PublicAudit from "./routes/PublicAudit";
import Onboard from "./routes/Onboard";
import Admin from "./pages/Admin";
import PageReport from "./pages/PageReport";
import Footer from "./components/Footer";
import VisibilityPage from "./views/visibility/VisibilityPage";

export default function App() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");

  // Admin route renders without wrapper (full-screen dark theme)
  if (isAdminRoute) {
    return (
      <Routes>
        <Route path="/admin" element={<Admin/>} />
      </Routes>
    );
  }

  // All other routes get the standard wrapper
  return (
    <>
      <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <h1 style={{margin:0, fontSize:22}}>Optiview — Dashboard</h1>
        <nav style={{display:"flex",gap:12}}>
          <a href="https://app.optiview.ai" target="_blank" rel="noopener noreferrer">Dashboard</a>
          {import.meta.env.VITE_FEATURE_PHASE5_ANALYTICS === "true" && (
            <Link to="/insights/visibility" className="text-blue-600 hover:underline">
              Visibility
            </Link>
          )}
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<Dashboard/>} />
        <Route path="/onboard" element={<Onboard/>} />
        <Route path="/a/:id" element={<PublicAudit/>} />
        <Route path="/a/:auditId/p/:encoded" element={<PageReport/>} />
        {import.meta.env.VITE_FEATURE_PHASE5_ANALYTICS === "true" && (
          <Route path="/insights/visibility" element={<VisibilityPage/>} />
        )}
      </Routes>
      <Footer />
    </>
  );
}
