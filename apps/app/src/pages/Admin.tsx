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
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1>Optiview — Admin Dashboard</h1>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
            Live operational metrics. Auto-refresh every 30 s.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            onClick={load}
            style={{
              padding: '8px 16px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500
            }}
          >
            Refresh
          </button>
          <a
            href="/admin/logout"
            style={{ color: '#3b82f6', textDecoration: 'none', fontSize: 14 }}
          >
            Logout
          </a>
        </div>
      </div>

      {error && (
        <div style={{
          padding: 16,
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          color: '#991b1b',
          borderRadius: 8,
          marginBottom: 16
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading…</div>
      ) : (
        data && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
              <StatCard title="Audits (7d)" value={data.audits_7d} />
              <StatCard title="Avg. Score (7d)" value={pct(data.avg_score_7d)} />
              <StatCard title="Domains (7d)" value={data.domains_7d} />
            </div>

            {/* AI Bot Access Summary */}
            {data.ai_access && (
              <div style={{ marginBottom: 16, fontSize: 13, color: '#64748b', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <span>AI bots allowed: {data.ai_access.allowed}/{data.ai_access.tested}</span>
                {data.ai_access.waf && <span>• WAF: {data.ai_access.waf}</span>}
              </div>
            )}

            {data.citations_budget && (
              <div className="card" style={{ marginTop: 24 }}>
                <h2 style={{ margin: '0 0 12px' }}>Citations Budget</h2>
                <div style={{ fontSize: 14, color: '#64748b', marginBottom: 12 }}>
                  {data.citations_budget.used}/{data.citations_budget.max} used —{" "}
                  {data.citations_budget.remaining} remaining
                </div>
                <div style={{ width: '100%', height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      background: '#10b981',
                      width: `${
                        (data.citations_budget.used / data.citations_budget.max) * 100
                      }%`,
                      transition: 'width 0.3s ease'
                    }}
                  ></div>
                </div>
              </div>
            )}

            <div style={{ marginTop: 40, fontSize: 12, color: '#94a3b8' }}>
              Last updated:{" "}
              {new Date(data.timestamp).toLocaleString(undefined, {
                dateStyle: "short",
                timeStyle: "medium",
              })}
            </div>
          </>
        )
      )}
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: any }) {
  return (
    <div className="card">
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#1e293b' }}>{value ?? "—"}</div>
    </div>
  );
}
