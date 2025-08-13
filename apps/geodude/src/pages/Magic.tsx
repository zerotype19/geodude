import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE, FETCH_OPTS } from "../config";

export default function Magic() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const token = sp.get("token");
  const [msg, setMsg] = useState("Verifying…");

  useEffect(() => {
    (async () => {
      if (!token) { 
        setMsg("Missing token"); 
        return; 
      }
      
      const r = await fetch(`${API_BASE}/auth/magic/verify`, {
        ...FETCH_OPTS,
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token })
      });
      
      if (r.ok) {
        setMsg("Signed in! Redirecting...");
        setTimeout(() => nav("/"), 400);
      } else {
        setMsg("Link invalid or expired.");
      }
    })();
  }, [token, nav]);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>Verifying Magic Link</h1>
      <p>{msg}</p>
    </main>
  );
}
