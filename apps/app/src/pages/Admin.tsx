import { useEffect, useState } from "react";

type Metrics = {
  audits_7d: number;
  avg_score_7d: string | number;
  domains_7d: number;
  timestamp?: string;
  citations_budget?: { used: number; remaining: number; max: number; date: string };
};

export default function Admin() {
  const [data, setData] = useState<Metrics | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/admin/api/metrics", { headers: { accept: "application/json" } });
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      const j: Metrics = await r.json();
      setData(j);
    } catch (e: any) {
      setErr(e.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000); // refresh every 30s
    return () => clearInterval(id);
  }, []);

  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const avg = (v: any) => {
    const n = typeof v === "string" ? parseFloat(v) : Number(v);
    if (isFinite(n)) return pct(n);
    return v ?? "—";
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Optiview Admin</h1>
          <p className="text-sm text-gray-500 mt-1">Live operational metrics. Auto-refreshes every 30s.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
          <a
            href="/admin/logout"
            className="px-4 py-2 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
          >
            Logout
          </a>
        </div>
      </div>

      {err && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-700 mb-6">
          <strong>Error:</strong> {err}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card title="Audits (7d)" value={data.audits_7d} />
            <Card title="Avg. Score (7d)" value={avg(data.avg_score_7d)} />
            <Card title="Domains (7d)" value={data.domains_7d} />
          </div>

          {data.citations_budget && (
            <div className="rounded-xl border p-6 mb-6">
              <h2 className="font-medium mb-3">Citations Budget (Today)</h2>
              <div className="mb-2 text-sm text-gray-600">
                {data.citations_budget.used}/{data.citations_budget.max} used — remaining{" "}
                {data.citations_budget.remaining}
              </div>
              <div className="w-full h-2 rounded bg-gray-200 overflow-hidden">
                <div
                  className={`h-2 ${
                    data.citations_budget.remaining < 20
                      ? "bg-red-500"
                      : data.citations_budget.remaining < 50
                      ? "bg-yellow-500"
                      : "bg-emerald-500"
                  }`}
                  style={{
                    width: `${Math.min(
                      100,
                      (data.citations_budget.used / Math.max(1, data.citations_budget.max)) * 100
                    ).toFixed(2)}%`,
                  }}
                />
              </div>
              <div className="mt-2 text-xs text-gray-500">as of {data.citations_budget.date}</div>
            </div>
          )}

          {data.timestamp && (
            <div className="text-xs text-gray-400">Last updated: {new Date(data.timestamp).toLocaleString()}</div>
          )}
        </>
      )}

      {loading && !data && (
        <div className="rounded-xl border p-6 text-center text-gray-500">
          Loading metrics...
        </div>
      )}
    </div>
  );
}

function Card({ title, value }: { title: string; value: any }) {
  return (
    <div className="rounded-xl border p-6 hover:border-gray-300 transition-colors">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="mt-2 text-3xl font-semibold">{value ?? "—"}</div>
    </div>
  );
}

