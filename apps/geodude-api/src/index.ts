import { verifyToken } from "@geodude/shared";
import { ensureUTMs } from "@geodude/shared";

type Env = {
  HMAC_KEY: string;
  INGEST_API_KEY: string;
  GEO_DB: D1Database;
  AI_CAPTURES: R2Bucket;
  DEST_MAP: KVNamespace;
  CANONICAL_BASE: string;
};

// Helper function to add CORS headers
function addCorsHeaders(response: Response): Response {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return response;
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(req.url);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return addCorsHeaders(new Response(null, { status: 204 }));
    }

    // 1) Health
    if (url.pathname === "/health") {
      const response = new Response("ok", { status: 200 });
      return addCorsHeaders(response);
    }

    // 2) Tokenized redirector: /r/:token
    if (url.pathname.startsWith("/r/")) {
      const token = url.pathname.split("/").pop()!;
      try {
        const payload = await verifyToken(token, env.HMAC_KEY);
        const destUrl = await resolveDest(payload, env); // throws if unknown

        // session + ai_ref cookies
        const headers = new Headers();
        const sid = getOrSetSession(req, headers);
        headers.append("Set-Cookie", `ai_ref=1; Path=/; Max-Age=${14 * 86400}; SameSite=Lax`);

        // append UTMs
        const dest = new URL(destUrl);
        ensureUTMs(dest, String(payload["src"] ?? "unknown"), payload["pid"] as string | undefined);

        // background click logging (faster redirects)
        ctx.waitUntil(insertClick(env.GEO_DB, {
          ts: Date.now(),
          src: String(payload["src"] ?? null),
          model: (payload["model"] as string) ?? null,
          pid: (payload["pid"] as string) ?? null,
          geo: (payload["geo"] as string) ?? null,
          ua: req.headers.get("user-agent"),
          ip: req.headers.get("cf-connecting-ip"),
          asn: (req as any).cf?.asn ? String((req as any).cf.asn) : null,
          dest: dest.toString(),
          session_id: sid
        }));

        // Create redirect response with headers
        const resp = new Response(null, {
          status: 302,
          headers: {
            "Location": dest.toString(),
            ...Object.fromEntries(headers.entries())
          }
        });
        return addCorsHeaders(resp);
      } catch (e: any) {
        const response = new Response(`bad token or dest: ${e?.message ?? ""}`, { status: 400 });
        return addCorsHeaders(response);
      }
    }

    // 3) Event ingest: POST /v1/events  (direct-to-D1 MVP)
    if (url.pathname === "/v1/events" && req.method === "POST") {
      if (req.headers.get("authorization") !== `Bearer ${env.INGEST_API_KEY}`) {
        const response = new Response("unauthorized", { status: 401 });
        return addCorsHeaders(response);
      }
      const batch = await req.json().catch(() => null);
      if (!Array.isArray(batch)) {
        const response = new Response("expected array", { status: 400 });
        return addCorsHeaders(response);
      }

      let inserted = 0;
      try {
        for (const ev of batch) {
          if (!ev?.type || !ev?.payload) continue;
          switch (ev.type) {
            case "conversion":
              await env.GEO_DB
                .prepare(
                  `INSERT INTO conversion_event (ts, session_id, type, value_cents, meta)
                   VALUES (?1, ?2, ?3, ?4, ?5)`
                )
                .bind(
                  ev.payload.ts ?? Date.now(),
                  ev.payload.session_id ?? null,
                  ev.payload.type ?? "custom",
                  ev.payload.value_cents ?? null,
                  ev.payload.meta ? JSON.stringify(ev.payload.meta) : null
                )
                .run();
              inserted++;
              break;
            case "crawler":
              await env.GEO_DB
                .prepare(
                  `INSERT INTO crawler_visit (ts, ua, ip, asn, family, hit_type, path, status)
                   VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
                )
                .bind(
                  ev.payload.ts ?? Date.now(),
                  ev.payload.ua ?? null,
                  ev.payload.ip ?? null,
                  ev.payload.asn ?? null,
                  ev.payload.family ?? "unknown",
                  ev.payload.hit_type ?? "unknown",
                  ev.payload.path ?? null,
                  ev.payload.status ?? null
                )
                .run();
              inserted++;
              break;
            default:
              // ignore unknown types for now
              break;
          }
        }
      } catch (e) {
        const response = new Response("db error", { status: 500 });
        return addCorsHeaders(response);
      }
      const response = Response.json({ ok: true, inserted });
      return addCorsHeaders(response);
    }

    // 0) Overview metrics (simple counts for dashboard smoke test)
    if (url.pathname === "/overview" && req.method === "GET") {
      const q = (sql: string) => env.GEO_DB.prepare(sql).first<any>();
      const [clicks, convs, crawls, cites] = await Promise.all([
        q("SELECT COUNT(*) AS c FROM edge_click_event"),
        q("SELECT COUNT(*) AS c FROM conversion_event"),
        q("SELECT COUNT(*) AS c FROM crawler_visit"),
        q("SELECT COUNT(*) AS c FROM ai_citation_event")
      ]);
      const response = Response.json({
        clicks: clicks?.c ?? 0,
        conversions: convs?.c ?? 0,
        crawler_visits: crawls?.c ?? 0,
        citations: cites?.c ?? 0
      });
      return addCorsHeaders(response);
    }

    // KV Admin API endpoints
    function requireAdmin(req: Request, env: Env) {
      const auth = req.headers.get("authorization") || "";
      if (auth !== `Bearer ${env.INGEST_API_KEY}`) throw new Error("unauthorized");
    }

    async function json<T>(req: Request) { return await req.json() as T; }

    // List mappings
    if (url.pathname === "/admin/kv" && req.method === "GET") {
      try {
        requireAdmin(req, env);
        const list = await env.DEST_MAP.list({ limit: 1000 });
        const rows = await Promise.all(
          (list.keys || []).map(async k => ({ pid: k.name, url: await env.DEST_MAP.get(k.name) }))
        );
        const response = Response.json({ items: rows });
        return addCorsHeaders(response);
      } catch (e: any) {
        const response = new Response(e.message || "error", { status: e.message === "unauthorized" ? 401 : 500 });
        return addCorsHeaders(response);
      }
    }

    // Upsert mapping
    if (url.pathname === "/admin/kv" && req.method === "PUT") {
      try {
        requireAdmin(req, env);
        const body = await json<{ pid: string; url: string }>(req);
        if (!body?.pid || !body?.url) {
          const response = new Response("bad request", { status: 400 });
          return addCorsHeaders(response);
        }
        await env.DEST_MAP.put(body.pid, body.url);
        const response = Response.json({ ok: true });
        return addCorsHeaders(response);
      } catch (e: any) {
        const response = new Response(e.message || "error", { status: e.message === "unauthorized" ? 401 : 500 });
        return addCorsHeaders(response);
      }
    }

            // Delete mapping
        if (url.pathname === "/admin/kv" && req.method === "DELETE") {
          try {
            requireAdmin(req, env);
            const pid = url.searchParams.get("pid");
            if (!pid) {
              const response = new Response("bad request", { status: 400 });
              return addCorsHeaders(response);
            }
            await env.DEST_MAP.delete(pid);
            const response = Response.json({ ok: true });
            return addCorsHeaders(response);
          } catch (e: any) {
            const response = new Response(e.message || "error", { status: e.message === "unauthorized" ? 500 : 500 });
            return addCorsHeaders(response);
          }
        }

        // AI Citation Ingest: NDJSON lines of {"capture":{...}} and {"citation":{...}}
        if (url.pathname === "/ingest/ai-citations" && req.method === "POST") {
          if (req.headers.get("authorization") !== `Bearer ${env.INGEST_API_KEY}`) {
            const response = new Response("unauthorized", { status: 401 });
            return addCorsHeaders(response);
          }
          const reader = req.body?.getReader();
          if (!reader) {
            const response = new Response("no body", { status: 400 });
            return addCorsHeaders(response);
          }

          const decoder = new TextDecoder();
          let buf = ""; 
          let inserted = 0;
          const captures: any[] = []; 
          const cites: any[] = [];

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            let i;
            while ((i = buf.indexOf("\n")) >= 0) {
              const line = buf.slice(0, i).trim(); 
              buf = buf.slice(i + 1);
              if (!line) continue;
              const obj = JSON.parse(line);
              if (obj.capture) captures.push(obj.capture);
              if (obj.citation) cites.push(obj.citation);
            }
          }

          const stmts: D1PreparedStatement[] = [];
          for (const c of captures) {
            stmts.push(
              env.GEO_DB.prepare(
                `INSERT OR REPLACE INTO ai_surface_capture
                 (id, ts, surface, model_variant, persona, geo, query_text, dom_url, screenshot_url)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
              ).bind(
                c.id, c.ts, c.surface, c.model_variant ?? null, c.persona ?? null, c.geo ?? null,
                c.query_text ?? null, c.dom_url ?? null, c.screenshot_url ?? null
              )
            );
          }
          for (const x of cites) {
            stmts.push(
              env.GEO_DB.prepare(
                `INSERT INTO ai_citation_event
                 (capture_id, ts, surface, query, url, rank, confidence)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
              ).bind(
                x.capture_id, x.ts, x.surface, x.query, x.url, x.rank ?? null, x.confidence ?? null
              )
            );
          }
          if (stmts.length) {
            const CHUNK = 50;
            for (let k = 0; k < stmts.length; k += CHUNK) {
              await env.GEO_DB.batch(stmts.slice(k, k + CHUNK));
            }
            inserted = stmts.length;
          }
          const response = Response.json({ inserted, captures: captures.length, citations: cites.length });
          return addCorsHeaders(response);
        }

        // Public AI feeds (signed NDJSON)
        function sign(body: string, key: string) {
          // simple HMAC-SHA256 base64url
          return crypto.subtle.importKey("raw", new TextEncoder().encode(key), {name:"HMAC", hash:"SHA-256"}, false, ["sign"])
            .then(k => crypto.subtle.sign("HMAC", k, new TextEncoder().encode(body)))
            .then(buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,""));
        }

        if (url.pathname === "/ai/corpus.ndjson" && req.method === "GET") {
          const body = [
            JSON.stringify({ type:"entity", id:"site", canonical:"https://geodude.pages.dev" }),
            JSON.stringify({ type:"fact", entity:"site", property:"product", value:"geodude" })
          ].join("\n") + "\n";
          const h = new Headers({ "content-type":"application/x-ndjson" });
          h.set("X-AI-Signature", await sign(body, env.AI_FEED_SIGNING_KEY));
          const response = new Response(body, { headers: h });
          return addCorsHeaders(response);
        }

        if (url.pathname === "/ai/faqs.ndjson" && req.method === "GET") {
          const body = [
            JSON.stringify({ type:"faq", q:"What is geodude?", a:"AI referral tracking and GEO toolkit.", canonical:"https://geodude.pages.dev" })
          ].join("\n") + "\n";
          const h = new Headers({ "content-type":"application/x-ndjson" });
          h.set("X-AI-Signature", await sign(body, env.AI_FEED_SIGNING_KEY));
          const response = new Response(body, { headers: h });
          return addCorsHeaders(response);
        }

    const response = new Response("not found", { status: 404 });
    return addCorsHeaders(response);
  }
};

function getOrSetSession(req: Request, headers: Headers) {
  const cookies = req.headers.get("cookie") || "";
  const m = cookies.match(/sid=([A-Za-z0-9_-]+)/);
  const sid = m?.[1] ?? crypto.randomUUID();
  if (!m) headers.append("Set-Cookie", `sid=${sid}; Path=/; Max-Age=${30 * 86400}; SameSite=Lax`);
  return sid;
}

function requireCanonicalBase(env: { CANONICAL_BASE?: string }) {
  const base = env.CANONICAL_BASE?.trim();
  if (!base) throw new Error("CANONICAL_BASE is not configured");
  return new URL("/", base).toString();
}

async function resolveDest(payload: Record<string, unknown>, env: Env): Promise<string> {
  // Rule: if pid exists and a KV mapping exists, use it; else fall back to CANONICAL_BASE
  const pid = (payload["pid"] as string) || "";
  if (pid) {
    const mapped = await env.DEST_MAP.get(pid);
    if (mapped) return mapped;
  }
  const base = requireCanonicalBase(env); // throws if missing
  return new URL("/", base).toString();
}

async function insertClick(db: D1Database, row: any) {
  await db
    .prepare(
      `INSERT INTO edge_click_event
       (ts, src, model, pid, geo, ua, ip, asn, dest, session_id)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
    )
    .bind(
      row.ts,
      row.src,
      row.model,
      row.pid,
      row.geo,
      row.ua,
      row.ip,
      row.asn,
      row.dest,
      row.session_id
    )
    .run();
}
