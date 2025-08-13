import { useAuth } from "./useAuth";
import { API_BASE, FETCH_OPTS } from "./config";
import { useState } from "react";

export default function OrgProjectBar({ onChanged }: { onChanged?: () => void }) {
  const { me, refresh } = useAuth();
  const [org, setOrg] = useState(me?.current?.org_id || "");
  const [prj, setPrj] = useState(me?.current?.project_id || "");

  // Update local state when me changes
  useState(() => {
    if (me?.current) {
      setOrg(me.current.org_id);
      setPrj(me.current.project_id);
    }
  });

  async function setCurrent() {
    if (!org || !prj) return;
    
    const r = await fetch(`${API_BASE}/me/set-current`, {
      ...FETCH_OPTS, 
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ org_id: org, project_id: prj })
    });
    
    if (r.ok) {
      await refresh(); 
      onChanged?.();
    }
  }

  async function logout() {
    await fetch(`${API_BASE}/auth/logout`, {
      ...FETCH_OPTS,
      method: "POST"
    });
    location.reload();
  }

  if (!me?.user) return null;
  
  return (
    <div style={{ 
      display: "flex", 
      gap: 12, 
      alignItems: "center", 
      marginBottom: 24,
      padding: "16px 0",
      borderBottom: "1px solid #e1e5e9"
    }}>
      <span style={{ fontWeight: 500 }}>{me.user.email}</span>
      
      <select 
        value={org} 
        onChange={e => setOrg(e.target.value)}
        style={{ padding: "4px 8px", border: "1px solid #ccc", borderRadius: 4 }}
      >
        <option value="">Select Organization</option>
        {(me.orgs || []).map(o => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
      
      <select 
        value={prj} 
        onChange={e => setPrj(e.target.value)}
        style={{ padding: "4px 8px", border: "1px solid #ccc", borderRadius: 4 }}
        disabled={!org}
      >
        <option value="">Select Project</option>
        {(me.projects || [])
          .filter(p => p.org_id === org)
          .map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))
        }
      </select>
      
      <button 
        onClick={setCurrent}
        disabled={!org || !prj}
        style={{ 
          padding: "4px 12px", 
          backgroundColor: "#0070f3", 
          color: "white", 
          border: "none", 
          borderRadius: 4,
          cursor: org && prj ? "pointer" : "not-allowed",
          opacity: org && prj ? 1 : 0.5
        }}
      >
        Switch
      </button>
      
      <button 
        onClick={logout}
        style={{ 
          padding: "4px 12px", 
          backgroundColor: "#dc3545", 
          color: "white", 
          border: "none", 
          borderRadius: 4,
          cursor: "pointer"
        }}
      >
        Logout
      </button>
    </div>
  );
}
