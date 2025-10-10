import { useEffect, useState } from "react";

export default function Admin() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/admin/api/metrics");
      if (!res.ok) throw new Error(`${res.statusText}`);
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  // API returns 0-100 already, just clamp and format
  const pct = (v: any) => {
    const num = typeof v === "string" ? parseFloat(v) : (v ?? 0);
    const clamped = Math.max(0, Math.min(100, Math.round(num)));
    return `${clamped}%`;
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-50 px-6 py-10">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold">Optiview — Admin Dashboard</h1>
          <div className="space-x-3">
            <button
              onClick={load}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm"
            >
              Refresh
            </button>
            <a
              href="/admin/logout"
              className="text-sm text-gray-400 hover:text-gray-200"
            >
              Logout
            </a>
          </div>
        </header>

        <p className="text-gray-400 text-sm">
          Live operational metrics. Auto-refresh every 30 s.
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-400 text-red-300 p-4 rounded-lg">
            Error: {error}
          </div>
        )}

        {loading ? (
          <div className="text-gray-400">Loading…</div>
        ) : (
          data && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard title="Audits (7d)" value={data.audits_7d} />
                <StatCard title="Avg. Score (7d)" value={pct(data.avg_score_7d)} />
                <StatCard title="Domains (7d)" value={data.domains_7d} />
              </div>

              {/* AI Bot Access Summary */}
              {data.ai_access && (
                <div className="mt-3 text-xs text-zinc-400 flex flex-wrap gap-2">
                  <span>AI bots allowed: {data.ai_access.allowed}/{data.ai_access.tested}</span>
                  {data.ai_access.waf && <span>• WAF: {data.ai_access.waf}</span>}
                </div>
              )}

              {data.citations_budget && (
                <div className="mt-6 bg-gray-900 p-6 rounded-xl border border-gray-800">
                  <h2 className="font-medium text-gray-300 mb-3">
                    Citations Budget
                  </h2>
                  <div className="text-sm text-gray-400 mb-2">
                    {data.citations_budget.used}/{data.citations_budget.max} used —{" "}
                    {data.citations_budget.remaining} remaining
                  </div>
                  <div className="w-full h-2 bg-gray-800 rounded">
                    <div
                      className={`h-2 rounded bg-emerald-500`}
                      style={{
                        width: `${
                          (data.citations_budget.used / data.citations_budget.max) *
                          100
                        }%`,
                      }}
                    ></div>
                  </div>
                </div>
              )}

              <footer className="mt-10 text-xs text-gray-500">
                Last updated:{" "}
                {new Date(data.timestamp).toLocaleString(undefined, {
                  dateStyle: "short",
                  timeStyle: "medium",
                })}
              </footer>
            </>
          )
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: any }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="text-gray-400 text-sm">{title}</div>
      <div className="text-2xl font-semibold text-white mt-2">{value ?? "—"}</div>
    </div>
  );
}
