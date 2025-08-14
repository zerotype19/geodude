import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Sources from "./pages/Sources";
import Content from "./pages/Content";
import Events from "./pages/Events";
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
import MagicLink from "./pages/MagicLink";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/auth/magic" element={<MagicLink />} />
        <Route path="/" element={<Events />} />
        <Route path="/sources" element={<Sources />} />
        <Route path="/content" element={<Content />} />
        <Route path="/events" element={<Events />} />
        <Route path="/install" element={<Install />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin/health" element={<AdminHealth />} />
        <Route path="/api-keys" element={<ApiKeys />} />
        <Route path="/data-policy" element={<DataPolicy />} />
        <Route path="/docs/*" element={<Docs />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
      </Routes>
    </Router>
  );
}

export default App;
