import { Routes, Route, Link } from "react-router-dom";
import Dashboard from "./routes/Dashboard";
import PublicAudit from "./routes/PublicAudit";

export default function App() {
  return (
    <>
      <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <h1 style={{margin:0, fontSize:22}}>Optiview — Dashboard</h1>
        <nav style={{display:"flex",gap:12}}>
          <Link to="/">Run Audit</Link>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<Dashboard/>} />
        <Route path="/a/:id" element={<PublicAudit/>} />
      </Routes>
      <footer style={{marginTop:24, opacity:.7}}>
        <a href="https://optiview.ai">optiview.ai</a> • <a href="https://optiview.ai/docs/audit.html">docs</a>
      </footer>
    </>
  );
}
