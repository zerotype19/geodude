import { useEffect, useState } from "react";

type Overview = { clicks: number; conversions: number; crawler_visits: number; citations: number };

export default function App() {
  const [o, setO] = useState<Overview | null>(null);

  useEffect(() => {
    // Use environment variable from Cloudflare Pages, fallback to local dev
    const apiUrl = import.meta.env.VITE_API_URL || "http://127.0.0.1:8787";
    
    // Ensure no double slashes by properly constructing the URL
    const overviewUrl = apiUrl.endsWith('/') 
      ? `${apiUrl}overview` 
      : `${apiUrl}/overview`;
    
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
    </main>
  );
}
