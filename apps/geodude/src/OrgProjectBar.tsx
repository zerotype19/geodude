import { useAuth } from "./useAuth";
import { API_BASE, FETCH_OPTS } from "./config";
import { useState, useEffect } from "react";

export default function OrgProjectBar({ onChanged }: { onChanged?: () => void }) {
  const { me, refresh } = useAuth();
  const [org, setOrg] = useState(me?.current?.org_id || "");
  const [prj, setPrj] = useState(me?.current?.project_id || "");

  // Update local state when me changes
  useEffect(() => {
    if (me?.current) {
      setOrg(me.current.org_id);
      setPrj(me.current.project_id);
    }
  }, [me]);

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
    <div className="flex gap-3 items-center mb-6 py-4 border-b border-gray-200">
      <span className="font-medium text-slate-700">{me.user.email}</span>
      
      <select 
        value={org} 
        onChange={e => setOrg(e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">Select Organization</option>
        {(me.orgs || []).map(o => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
      
      <select 
        value={prj} 
        onChange={e => setPrj(e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
        className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
      >
        Switch
      </button>
      
      <button 
        onClick={logout}
        className="px-3 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
      >
        Logout
      </button>
    </div>
  );
}
