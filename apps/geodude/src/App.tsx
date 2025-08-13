import { useEffect, useState } from "react";
import { API_BASE, FETCH_OPTS } from "./config";
import { useAuth } from "./useAuth";
import OrgProjectBar from "./OrgProjectBar";
import Shell from "./components/Shell";
import { Card } from "./components/ui/Card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, LineChart, Line } from "recharts";

type Overview = { clicks: number; conversions: number; crawler_visits: number; citations: number };



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
    <div className="grid gap-6 mb-8">
      <div className="grid gap-6 md:grid-cols-3">
        <Card title="Clicks by Source">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={(bySrc?.rows || []).map(r => ({ name: r.src, cnt: r.cnt }))}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" /><YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="cnt" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Top PIDs">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={(topPids?.rows || []).map(r => ({ name: r.pid || "(none)", cnt: r.cnt }))}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" /><YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="cnt" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Clicks Over Time">
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={ts?.rows || []}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="ts" tickFormatter={(v) => new Date(v).toLocaleDateString()} />
                <YAxis allowDecimals={false} />
                <Line type="monotone" dataKey="cnt" stroke="#8b5cf6" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
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
    <Shell>
      <OrgProjectBar onChanged={() => location.reload()} />
      <h1 className="text-3xl font-bold mb-4">Optiview Dashboard</h1>
      <p className="text-slate-600 mb-6">AI Referral Intelligence Platform</p>

      <div className="grid gap-6 mb-8">
        <Card title="Overview">
          {!o ? (
            <p className="text-slate-500">Loading…</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{o.clicks}</div>
                <div className="text-sm text-slate-500">Clicks</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{o.conversions}</div>
                <div className="text-sm text-slate-500">Conversions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{o.crawler_visits}</div>
                <div className="text-sm text-slate-500">Crawler Visits</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{o.citations}</div>
                <div className="text-sm text-slate-500">Citations</div>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Charts />
    </Shell>
  );
}
