import { useEffect, useState } from "react";
import { API_BASE, FETCH_OPTS } from "./config";

export type Me = {
  user?: { id: string; email: string };
  orgs?: { id: string; name: string }[];
  projects?: { id: string; org_id: string; name: string; slug: string }[];
  current?: { org_id: string; project_id: string } | null;
};

export function useAuth() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetch(`${API_BASE}/me`, FETCH_OPTS)
      .then(r => r.ok ? r.json() : null)
      .then(setMe)
      .finally(() => setLoading(false));
  }, []);
  
  return { 
    me, 
    loading, 
    refresh: async () => {
      const r = await fetch(`${API_BASE}/me`, FETCH_OPTS);
      setMe(r.ok ? await r.json() : null);
    }
  };
}
