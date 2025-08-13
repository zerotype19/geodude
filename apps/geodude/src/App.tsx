import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Sources from "./pages/Sources";
import Content from "./pages/Content";
import Events from "./pages/Events";
import Settings from "./pages/Settings";
import Install from "./pages/Install";
import AdminHealth from "./pages/AdminHealth";
import ApiKeys from "./pages/ApiKeys";
import DataPolicy from "./pages/DataPolicy";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Events />} />
        <Route path="/sources" element={<Sources />} />
        <Route path="/content" element={<Content />} />
        <Route path="/events" element={<Events />} />
        <Route path="/install" element={<Install />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin/health" element={<AdminHealth />} />
        <Route path="/api-keys" element={<ApiKeys />} />
        <Route path="/data-policy" element={<DataPolicy />} />
      </Routes>
    </Router>
  );
}

export default App;
