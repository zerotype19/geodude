import { useEffect, useState } from "react";
import { API_BASE } from "./config";

type Overview = { clicks: number; conversions: number; crawler_visits: number; citations: number };

function useAdminToken() {
  const [t, setT] = useState<string | null>(() => sessionStorage.getItem("ADMIN_TOKEN"));
  return {
    token: t,
    set(v: string) { sessionStorage.setItem("ADMIN_TOKEN", v); setT(v); },
    clear() { sessionStorage.removeItem("ADMIN_TOKEN"); setT(null); }
  };
}

function KvAdmin() {
  const { token, set, clear } = useAdminToken();
  const [items, setItems] = useState<{ pid: string; url: string | null }[]>([]);
  const [pid, setPid] = useState("");
  const [url, setUrl] = useState("");

  async function reload() {
    if (!token) return;
    const r = await fetch(`${API_BASE}/admin/kv`, { headers: { authorization: `Bearer ${token}` } });
    if (r.ok) setItems((await r.json()).items || []);
  }

  useEffect(() => { reload(); }, [token]);

  async function upsert() {
    if (!token) return;
    await fetch(`${API_BASE}/admin/kv`, {
      method: "PUT",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ pid, url })
    });
    setPid(""); setUrl(""); await reload();
  }

  async function del(id: string) {
    if (!token) return;
    await fetch(`${API_BASE}/admin/kv?pid=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` }
    });
    await reload();
  }

  return (
    <section style={{ marginTop: 24 }}>
      <h2>KV Admin</h2>
      {!token ? (
        <div>
          <p>Paste admin token (INGEST_API_KEY):</p>
          <input onChange={e => set(e.target.value)} placeholder="Bearer token" />
        </div>
      ) : (
        <>
          <div style={{ margin: "12px 0" }}>
            <button onClick={clear}>Clear token</button>&nbsp;
            <button onClick={reload}>Reload</button>
          </div>
          <div>
            <input placeholder="pid" value={pid} onChange={e => setPid(e.target.value)} />
            <input placeholder="url" value={url} onChange={e => setUrl(e.target.value)} />
            <button onClick={upsert}>Save</button>
          </div>
          <ul>
            {items.map((it) => (
              <li key={it.pid}>
                <code>{it.pid}</code> → {it.url}
                <button onClick={() => del(it.pid)} style={{ marginLeft: 8 }}>Delete</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export default function App() {
  const [o, setO] = useState<Overview | null>(null);

  useEffect(() => {
    // Use environment variable from Cloudflare Pages, fallback to local dev
    const overviewUrl = API_BASE.endsWith('/')
      ? `${API_BASE}overview`
      : `${API_BASE}/overview`;

    fetch(overviewUrl)
      .then(r => r.json())
      .then(setO)
      .catch(() => setO(null));
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>geodude</h1>
      <p>Cloudflare Pages UI scaffold. Hooked to geodude-api.</p>
      <div style={{ marginTop: 16 }}>
        <h2>Overview</h2>
        {!o ? <p>Loading…</p> : (
          <ul>
            <li>Clicks: {o.clicks}</li>
            <li>Conversions: {o.conversions}</li>
            <li>Crawler Visits: {o.crawler_visits}</li>
            <li>Citations: {o.citations}</li>
          </ul>
        )}
      </div>
      <KvAdmin />
    </main>
  );
}
