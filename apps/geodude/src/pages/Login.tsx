import { useState } from "react";
import { API_BASE, FETCH_OPTS } from "../config";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState("");

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const r = await fetch(`${API_BASE}/auth/magic/start`, {
      ...FETCH_OPTS,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, redirect: `${location.origin}/auth/magic` })
    });
    if (r.ok) { 
      setSent(true); 
    } else {
      setMsg("Failed to send magic link");
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>Sign in to Geodude</h1>
      {sent ? (
        <div>
          <p>Check your email for a magic link.</p>
          <p><small>In development mode, check the Worker logs for the magic link URL.</small></p>
        </div>
      ) : (
        <form onSubmit={start} style={{ display: "grid", gap: 16, maxWidth: 400 }}>
          <div>
            <label htmlFor="email">Email address</label>
            <input 
              id="email"
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="you@example.com" 
              required 
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </div>
          <button type="submit" style={{ padding: 12, backgroundColor: "#0070f3", color: "white", border: "none", borderRadius: 4 }}>
            Send magic link
          </button>
          {msg && <p style={{ color: "red" }}>{msg}</p>}
        </form>
      )}
    </main>
  );
}
