import { useEffect, useState } from "react";
import { API_BASE, FETCH_OPTS } from "../config";
import Shell from "../components/Shell";
import { Card } from "../components/ui/Card";

type Cit = { 
  id: number; 
  ts: number; 
  surface: string; 
  query: string; 
  url: string; 
  rank: number; 
  confidence: number; 
  model_variant?: string; 
  persona?: string 
};

export default function Citations() {
  const [items, setItems] = useState<Cit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/citations/recent?limit=100`, FETCH_OPTS)
      .then(r => r.json())
      .then(d => {
        setItems(d.items || []);
        setLoading(false);
      })
      .catch(() => {
        setItems([]);
        setLoading(false);
      });
  }, []);

  return (
    <Shell>
      <Card title="Recent AI Citations">
        {loading ? (
          <div className="text-center py-8 text-slate-500">Loading citations...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-slate-500">No citations found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Engine</th>
                  <th className="py-2 pr-4">Query</th>
                  <th className="py-2 pr-4">URL</th>
                  <th className="py-2 pr-4">Rank</th>
                </tr>
              </thead>
              <tbody>
                {items.map(r => (
                  <tr key={r.id} className="border-t">
                    <td className="py-2 pr-4">{new Date(r.ts).toLocaleString()}</td>
                    <td className="py-2 pr-4">{r.surface}</td>
                    <td className="py-2 pr-4">{r.query}</td>
                    <td className="py-2 pr-4 truncate max-w-[420px]">
                      <a 
                        href={r.url} 
                        className="text-blue-600 hover:underline" 
                        target="_blank" 
                        rel="noreferrer"
                      >
                        {r.url}
                      </a>
                    </td>
                    <td className="py-2 pr-4">{r.rank ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Shell>
  );
}
