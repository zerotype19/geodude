import { useEffect, useState } from "react";
import { API_BASE, ENABLE_ADMIN, FETCH_OPTS } from "./config";
import { useAuth } from "./useAuth";
import OrgProjectBar from "./OrgProjectBar";
import TokenLab from "./TokenLab";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, LineChart, Line } from "recharts";

type Overview = { clicks: number; conversions: number; crawler_visits: number; citations: number };

function useAdminToken() {
  const [t, setT] = useState<string | null>(() => sessionStorage.getItem("ADMIN_TOKEN"));
  return {
    token: t,
    set(v: string) { sessionStorage.setItem("ADMIN_TOKEN", v); setT(v); },
    clear() { sessionStorage.removeItem("ADMIN_TOKEN"); setT(null); }
  };
}

function useFetch<T>(path: string, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => { fetch(`${API_BASE}${path}`).then(r => r.json()).then(setData as any).catch(() => setData(null)); }, deps);
  return data;
}

function Charts() {
  const bySrc = useFetch<{ rows: { src: string; cnt: number }[] }>(`/metrics/clicks_by_src`, []);
  const topPids = useFetch<{ rows: { pid: string; cnt: number }[] }>(`/metrics/top_pids?limit=10`, []);
  const ts = useFetch<{ rows: { ts: number; cnt: number }[] }>(`/metrics/clicks_timeseries`, []);
  return (
    <section style={{ marginTop: 24 }}>
      <h2>Analytics</h2>
      <div style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))" }}>
        <div style={{ height: 260 }}>
          <h3>Clicks by Source</h3>
          <ResponsiveContainer>
            <BarChart data={(bySrc?.rows || []).map(r => ({ name: r.src, cnt: r.cnt }))}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" /><YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="cnt" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ height: 260 }}>
          <h3>Top PIDs</h3>
          <ResponsiveContainer>
            <BarChart data={(topPids?.rows || []).map(r => ({ name: r.pid || "(none)", cnt: r.cnt }))}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" /><YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="cnt" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ height: 260 }}>
          <h3>Clicks Over Time</h3>
          <ResponsiveContainer>
            <LineChart data={ts?.rows || []}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="ts" tickFormatter={(v) => new Date(v).toLocaleDateString()} />
              <YAxis allowDecimals={false} />
              <Line type="monotone" dataKey="cnt" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
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
  const { me, loading } = useAuth();
  const [o, setO] = useState<Overview | null>(null);

  // ✅ IMPORTANT: All hooks must be called before any conditional returns
  useEffect(() => {
    // Only fetch overview when authenticated and onboarded
    if (me?.user && me?.current) {
      const overviewUrl = API_BASE.endsWith('/')
        ? `${API_BASE}overview`
        : `${API_BASE}/overview`;

      fetch(overviewUrl, FETCH_OPTS)
        .then(r => r.json())
        .then(setO)
        .catch(() => setO(null));
    }
  }, [me?.user, me?.current]);

  // Authentication gate - AFTER all hooks
  if (loading) return <main style={{ padding: 24 }}>Loading…</main>;
  if (!me?.user) return <main style={{ padding: 24 }}><a href="/login">Sign in</a></main>;
  if (!me.current) return <main style={{ padding: 24 }}><a href="/onboard">Start onboarding</a></main>;

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <OrgProjectBar onChanged={() => location.reload()} />
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
      <Charts />
      <KvAdmin />
      {ENABLE_ADMIN ? <TokenLab /> : null}
    </main>
  );
}
