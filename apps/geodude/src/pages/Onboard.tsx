import { useState } from "react";
import { API_BASE, FETCH_OPTS } from "../config";
import { useNavigate } from "react-router-dom";

export default function Onboard() {
  const nav = useNavigate();
  const [orgName, setOrgName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Create organization
      const r1 = await fetch(`${API_BASE}/org`, {
        ...FETCH_OPTS, 
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: orgName })
      });
      
      if (!r1.ok) {
        throw new Error("Failed to create organization");
      }
      
      const org = await r1.json(); // { id, name }

      // Create project
      const r2 = await fetch(`${API_BASE}/project`, {
        ...FETCH_OPTS, 
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ 
          org_id: org.org.id, 
          name: projectName, 
          slug 
        })
      });
      
      if (!r2.ok) {
        throw new Error("Failed to create project");
      }

      const prj = await r2.json(); // { id, ... }

      // Set current context server-side
      await fetch(`${API_BASE}/me/set-current`, {
        ...FETCH_OPTS, 
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ 
          org_id: org.org.id, 
          project_id: prj.project.id 
        })
      });

      nav("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>Welcome to Geodude</h1>
      <p>Let's get you set up with your first organization and project.</p>
      
      <form onSubmit={submit} style={{ display: "grid", gap: 16, maxWidth: 480, marginTop: 24 }}>
        <div>
          <label htmlFor="orgName">Organization name</label>
          <input 
            id="orgName"
            placeholder="Your Company Inc." 
            value={orgName} 
            onChange={e => setOrgName(e.target.value)} 
            required 
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </div>
        
        <div>
          <label htmlFor="projectName">Project name</label>
          <input 
            id="projectName"
            placeholder="Main Website" 
            value={projectName} 
            onChange={e => setProjectName(e.target.value)} 
            required 
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </div>
        
        <div>
          <label htmlFor="slug">Project slug</label>
          <input 
            id="slug"
            placeholder="main-site" 
            value={slug} 
            onChange={e => setSlug(e.target.value)} 
            required 
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
          <small>This will be used in your tracking URLs (e.g., main-site)</small>
        </div>
        
        <button 
          type="submit" 
          disabled={loading}
          style={{ 
            padding: 12, 
            backgroundColor: "#0070f3", 
            color: "white", 
            border: "none", 
            borderRadius: 4,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? "Creating..." : "Create Organization & Project"}
        </button>
        
        {error && <p style={{ color: "red" }}>{error}</p>}
      </form>
    </main>
  );
}
