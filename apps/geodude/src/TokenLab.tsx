import { useEffect, useState } from "react";
import { API_BASE } from "./config";

export default function TokenLab() {
    const [token, setToken] = useState<string>("");
    const [url, setUrl] = useState<string>("");
    const [msg, setMsg] = useState<string>("");

    const [src, setSrc] = useState("chatgpt");
    const [model, setModel] = useState("");
    const [pid, setPid] = useState("");
    const [geo, setGeo] = useState("");
    const [ttl, setTtl] = useState(60);
    const [admin, setAdmin] = useState<string>(() => sessionStorage.getItem("ADMIN_TOKEN") || "");

    useEffect(() => { if (admin) sessionStorage.setItem("ADMIN_TOKEN", admin); }, [admin]);

    async function gen() {
        setMsg("");
        const r = await fetch(`${API_BASE}/admin/token`, {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${admin}` },
            body: JSON.stringify({ src, model: model || undefined, pid, geo: geo || undefined, ttl_minutes: ttl })
        });
        if (!r.ok) { setMsg("error generating token"); return; }
        const j = await r.json();
        setToken(j.token);
        setUrl(j.redirectUrl);
    }

    return (
        <section style={{ marginTop: 24 }}>
            <h2>Token Lab</h2>
            <div style={{ display: "grid", gap: 8, maxWidth: 560 }}>
                <input placeholder="Admin token (once)" value={admin} onChange={e => setAdmin(e.target.value)} />
                <div>
                    <label>src: </label>
                    <select value={src} onChange={e => setSrc(e.target.value)}>
                        <option>chatgpt</option><option>perplexity</option><option>copilot</option>
                        <option>gemini</option><option>meta</option><option>other</option>
                    </select>
                </div>
                <input placeholder="model (optional)" value={model} onChange={e => setModel(e.target.value)} />
                <input placeholder="pid (slug, e.g. pricing_faq_us)" value={pid} onChange={e => setPid(e.target.value)} />
                <input placeholder="geo (optional, e.g. us)" value={geo} onChange={e => setGeo(e.target.value)} />
                <input type="number" min={5} max={10080} value={ttl} onChange={e => setTtl(parseInt(e.target.value, 10) || 60)} />
                <button onClick={gen}>Generate token</button>
                {msg && <p>{msg}</p>}
                {token && (
                    <>
                        <p><b>Token:</b> <code style={{ wordBreak: "break-all" }}>{token}</code></p>
                        <p><b>Redirect URL:</b> <a href={url} target="_blank" rel="noreferrer">{url}</a></p>
                    </>
                )}
            </div>
        </section>
    );
}
