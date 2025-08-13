import { verifyToken } from "@geodude/shared";
import { ensureUTMs } from "@geodude/shared";

// Session and auth helpers
function getCookie(req: Request, name: string) {
  const m = (req.headers.get("cookie") || "").match(new RegExp(`${name}=([^;]+)`));
  return m?.[1] || null;
}

// API key utilities
function b64url(buf: ArrayBuffer) {
  const uint8Array = new Uint8Array(buf);
  const b = String.fromCharCode(...Array.from(uint8Array));
  return btoa(b).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}

async function sha256b64url(s: string) {
  const d = new TextEncoder().encode(s);
  const h = await crypto.subtle.digest("SHA-256", d);
  return b64url(h);
}

function rawKey(): string {
  const a = new Uint8Array(24); 
  crypto.getRandomValues(a);
  return "ok_" + b64url(a.buffer); // ok_ = optiview key
}

function authzBearer(req: Request) {
  const a = req.headers.get("authorization") || "";
  const m = a.match(/^Bearer\s+(.+)$/i); 
  return m?.[1] || null;
}

async function sessionUserId(env: Env, req: Request) {
  const sid = getCookie(req, "geodude_ses");
  if (!sid) return null;
  // session must not be expired
  const row = await env.GEO_DB.prepare(
    "SELECT user_id FROM session WHERE id=?1 AND expires_ts > ?2"
  ).bind(sid, Date.now()).first<any>();
  return row?.user_id ?? null;
}

async function requireOrgMember(env: Env, req: Request, org_id: string) {
  const uid = await sessionUserId(env, req);
  if (!uid) throw new Response("unauthorized", { status: 401 });
  const ok = await env.GEO_DB.prepare(
    "SELECT 1 FROM org_member WHERE org_id=?1 AND user_id=?2 LIMIT 1"
  ).bind(org_id, uid).first<any>();
  if (!ok) throw new Response("forbidden", { status: 403 });
  return { user_id: uid };
}

type Env = {
  HMAC_KEY: string;
  INGEST_API_KEY: string;
  GEO_DB: D1Database;
  AI_CAPTURES: R2Bucket;
  DEST_MAP: KVNamespace;
  CANONICAL_BASE: string;
  RESEND_API_KEY?: string;
  APP_BASE_URL?: string;
  AI_FEED_SIGNING_KEY: string;
};

// Helper function to add CORS headers with credentials support
function cors(origin: string | null, allowed: string[]) {
  const h = new Headers();
  if (origin && allowed.some(a => origin.endsWith(a))) {
    h.set("Access-Control-Allow-Origin", origin); // echo exact origin
    h.set("Vary", "Origin");
    h.set("Access-Control-Allow-Credentials", "true");
  }
  h.set("Access-Control-Allow-Headers", "content-type, authorization");
  h.set("Access-Control-Allow-Methods", "GET, POST, DELETE, PUT, OPTIONS");
  h.set("Access-Control-Max-Age", "86400");
  return h;
}

// Universal CORS function for all responses (replaces addCorsHeaders)
function addCorsForCredentials(response: Response, req: Request): Response {
  const origin = req.headers.get("origin");
  const allowed = ["optiview.ai"];
  if (origin && allowed.some(a => origin.endsWith(a))) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }
  return response;
}

function addCorsHeaders(response: Response): Response {
  // This function is deprecated - use cors() instead for credentialed requests
  // Since we're using credentials, we need to handle CORS properly
  // For now, we'll use a global approach that works with credentials
  response.headers.set('Access-Control-Allow-Origin', 'https://optiview.ai');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return response;
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const rid = crypto.randomUUID();
    
    function attach(obsResp: Response) { 
      obsResp.headers.set("x-request-id", rid); 
      return obsResp; 
    }
    
    function log(event: string, extra: Record<string, any> = {}) {
      console.log(JSON.stringify({ rid, event, ...extra }));
    }
    
    log("request_start", { 
      method: req.method, 
      path: req.url, 
      userAgent: req.headers.get("user-agent")?.substring(0, 100) 
    });
    
    const url = new URL(req.url);

    // Health check endpoints
    if (url.pathname === "/health" && req.method === "GET") {
      return new Response("OK", { status: 200 });
    }

    if (url.pathname === "/ready" && req.method === "GET") {
      try {
        // Basic DB connectivity check
        await env.GEO_DB.prepare("SELECT 1").first();
        return new Response("OK", { status: 200 });
      } catch (e) {
        return new Response("Service Unavailable", { status: 503 });
      }
    }

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      const origin = req.headers.get("origin");
      const allowed = [
        "optiview.ai",
        // add any preview hostnames if you use branch previews
        // "staging.optiview.ai"  // if you add staging environments
      ];
      return new Response(null, { status: 204, headers: cors(origin, allowed) });
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
        const clickData = {
          ts: Date.now(),
          src: String(payload["src"] ?? null),
          model: (payload["model"] as string) ?? null,
          pid: (payload["pid"] as string) ?? null,
          geo: (payload["geo"] as string) ?? null,
          ua: req.headers.get("user-agent"),
          ip: req.headers.get("cf-connecting-ip"),
          asn: (req as any).cf?.asn ? String((req as any).cf.asn) : null,
          dest: dest.toString(),
          session_id: sid,
          org_id: (payload as any).org || "org_system",
          project_id: (payload as any).prj || "prj_system"
        };
        ctx.waitUntil(insertClick(env.GEO_DB, clickData));

        // Create redirect response with headers
        const resp = new Response(null, {
          status: 302,
          headers: {
            "Location": dest.toString(),
            ...Object.fromEntries(headers.entries())
          }
        });
        
        log("redirect", { pid: payload.pid, dest: dest.toString(), src: payload.src, model: payload.model });
        return attach(addCorsHeaders(resp));
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
      const { from, to } = parseWindow(url);
      const q = (sql: string) => env.GEO_DB.prepare(sql).bind(from, to).first<any>();
      const [clicks, convs, crawls, cites] = await Promise.all([
        q("SELECT COUNT(*) AS c FROM edge_click_event WHERE ts BETWEEN ?1 AND ?2"),
        q("SELECT COUNT(*) AS c FROM conversion_event WHERE ts BETWEEN ?1 AND ?2"),
        q("SELECT COUNT(*) AS c FROM crawler_visit WHERE ts BETWEEN ?1 AND ?2"),
        q("SELECT COUNT(*) AS c FROM ai_citation_event WHERE ts BETWEEN ?1 AND ?2")
      ]);
      const response = Response.json({
        clicks: clicks?.c ?? 0,
        conversions: convs?.c ?? 0,
        crawler_visits: crawls?.c ?? 0,
        citations: cites?.c ?? 0
      });
      
      log("overview", { clicks: clicks?.c ?? 0, conversions: convs?.c ?? 0, crawler_visits: crawls?.c ?? 0, citations: cites?.c ?? 0 });
      return attach(addCorsHeaders(response));
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
        // 1) try admin key
        const auth = req.headers.get("authorization") || "";
        const isAdminKey = auth === `Bearer ${env.INGEST_API_KEY}`;

        const org_id = url.searchParams.get("org_id") || "org_system";
        const project_id = url.searchParams.get("project_id") || "prj_system";

        if (!isAdminKey) {
          // 2) fallback to session-based auth
          await requireOrgMember(env, req, org_id);
        }

        const prefix = `${org_id}:${project_id}:`;

        const list = await env.DEST_MAP.list({ prefix, limit: 1000 });
        const rows = await Promise.all(
          (list.keys || []).map(async k => {
            const pid = k.name.replace(prefix, ""); // Remove prefix for display
            return { pid, url: await env.DEST_MAP.get(k.name) };
          })
        );
        const response = Response.json({ items: rows, org_id, project_id });
        return addCorsHeaders(response);
      } catch (e: any) {
        const response = new Response(e.message || "error", { status: e.message === "unauthorized" ? 401 : 500 });
        return addCorsHeaders(response);
      }
    }

    // Upsert mapping (namespaced)
    if (url.pathname === "/admin/kv" && req.method === "PUT") {
      try {
        // 1) try admin key
        const auth = req.headers.get("authorization") || "";
        const isAdminKey = auth === `Bearer ${env.INGEST_API_KEY}`;

        const body = await json<{ pid: string; url: string; org_id?: string; project_id?: string }>(req);
        if (!body?.pid || !body?.url) {
          const response = new Response("bad request", { status: 400 });
          return addCorsHeaders(response);
        }

        let org_id = body.org_id, project_id = body.project_id;

        if (!isAdminKey) {
          // 2) fallback to session-based auth: must also pass org_id/project_id
          if (!org_id || !project_id) {
            const response = new Response("missing org/project", { status: 400 });
            return addCorsHeaders(response);
          }
          await requireOrgMember(env, req, org_id);
        }

        const kvKey = `${org_id}:${project_id}:${body.pid}`;
        await env.DEST_MAP.put(kvKey, body.url);
        const response = Response.json({ ok: true, key: kvKey });
        return addCorsHeaders(response);
      } catch (e: any) {
        const response = new Response(e.message || "error", { status: e.message === "unauthorized" ? 401 : 500 });
        return addCorsHeaders(response);
      }
    }

    // Delete mapping
    if (url.pathname === "/admin/kv" && req.method === "DELETE") {
      try {
        // 1) try admin key
        const auth = req.headers.get("authorization") || "";
        const isAdminKey = auth === `Bearer ${env.INGEST_API_KEY}`;

        const pid = url.searchParams.get("pid");
        const org_id = url.searchParams.get("org_id") || "org_system";
        const project_id = url.searchParams.get("project_id") || "prj_system";
        
        if (!pid) {
          const response = new Response("bad request", { status: 400 });
          return addCorsHeaders(response);
        }

        if (!isAdminKey) {
          // 2) fallback to session-based auth
          await requireOrgMember(env, req, org_id);
        }

        const kvKey = `${org_id}:${project_id}:${pid}`;
        await env.DEST_MAP.delete(kvKey);
        const response = Response.json({ ok: true, key: kvKey });
        return addCorsHeaders(response);
      } catch (e: any) {
        const response = new Response(e.message || "error", { status: e.message === "unauthorized" ? 401 : 500 });
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
      return crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
        .then(k => crypto.subtle.sign("HMAC", k, new TextEncoder().encode(body)))
        .then(buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
    }

    if (url.pathname === "/ai/corpus.ndjson" && req.method === "GET") {
      const body = [
        JSON.stringify({ type: "entity", id: "site", canonical: "https://optiview.ai" }),
        JSON.stringify({ type: "fact", entity: "site", property: "product", value: "geodude" })
      ].join("\n") + "\n";
      const h = new Headers({ "content-type": "application/x-ndjson" });
      const signature = await sign(body, env.AI_FEED_SIGNING_KEY);
      h.set("X-AI-Signature", signature);
      const response = new Response(body, { headers: h });
      return addCorsHeaders(response);
    }

    if (url.pathname === "/ai/faqs.ndjson" && req.method === "GET") {
      const body = [
        JSON.stringify({ type: "faq", q: "What is geodude?", a: "AI referral tracking and GEO toolkit.", canonical: "https://optiview.ai" })
      ].join("\n") + "\n";
      const h = new Headers({ "content-type": "application/x-ndjson" });
      const signature = await sign(body, env.AI_FEED_SIGNING_KEY);
      h.set("X-AI-Signature", signature);
      const response = new Response(body, { headers: h });
      return addCorsHeaders(response);
    }

    // Admin token generator (server-side signing)
    type TokenReq = {
      src: "chatgpt" | "perplexity" | "copilot" | "gemini" | "meta" | "other";
      model?: string;         // e.g. gpt-5-browser
      pid: string;            // slug: [a-z0-9_-]{1,64}
      geo?: string;           // e.g. us
      ttl_minutes?: number;   // default 60
      org_id?: string;        // e.g. org_system (defaults to system)
      project_id?: string;    // e.g. prj_system (defaults to system)
    };

    // Token payload types for multi-tenancy
    type TokenV1 = {
      v: 1;
      src: string;
      model?: string;
      pid: string;
      geo?: string;
      exp: number;
    };

    type TokenV2 = {
      v: 2;
      org: string;        // e.g., "org_system" for now
      prj: string;        // e.g., "prj_system"
      src: string;
      model?: string;
      pid: string;
      geo?: string;
      exp: number;
    };

    function validPid(pid: string) {
      return /^[a-z0-9_-]{1,64}$/.test(pid);
    }

    async function hmacSign(payload: object, secret: string) {
      const b64 = btoa(JSON.stringify(payload));
      const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(b64));
      const sig = btoa(String.fromCharCode(...new Uint8Array(mac))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      return `${b64}.${sig}`;
    }

    if (url.pathname === "/admin/token" && req.method === "POST") {
      try {
        // 1) try admin key
        const auth = req.headers.get("authorization") || "";
        const isAdminKey = auth === `Bearer ${env.INGEST_API_KEY}`;

        const body = await req.json() as TokenReq;
        if (!body?.src || !body?.pid) {
          const response = new Response("bad request", { status: 400 });
          return addCorsHeaders(response);
        }
        if (!validPid(body.pid)) {
          const response = new Response("invalid pid", { status: 400 });
          return addCorsHeaders(response);
        }

        const ttl = Math.min(Math.max(body.ttl_minutes ?? 60, 5), 7 * 24 * 60); // 5 min – 7 days

        // Build v2 payload when org/prj provided; else emit v1 for back-compat
        const org = body.org_id || "org_system";
        const prj = body.project_id || "prj_system";

        if (!isAdminKey) {
          // 2) fallback to session-based auth: must also pass org_id/project_id
          if (!org || !prj) {
            const response = new Response("missing org/project", { status: 400 });
            return addCorsHeaders(response);
          }
          await requireOrgMember(env, req, org);
        }

        const tokenPayload: TokenV1 | TokenV2 = (body.org_id || body.project_id) ? {
          v: 2,
          org,
          prj,
          src: body.src,
          model: body.model || undefined,
          pid: body.pid,
          geo: body.geo || undefined,
          exp: Math.floor(Date.now() / 1000) + ttl * 60
        } : {
          v: 1,
          src: body.src,
          model: body.model || undefined,
          pid: body.pid,
          geo: body.geo || undefined,
          exp: Math.floor(Date.now() / 1000) + ttl * 60
        };
        const token = await hmacSign(tokenPayload, env.HMAC_KEY);
        const base = new URL(req.url);
        const redirectUrl = `${base.origin}/r/${token}`;

        const response = Response.json({ token, redirectUrl, payload: tokenPayload });
        return addCorsHeaders(response);
      } catch (e: any) {
        const response = new Response(e.message || "error", { status: e.message === "unauthorized" ? 401 : 500 });
        return addCorsHeaders(response);
      }
    }

    // Analytics APIs (filters + charts)
    function parseWindow(u: URL) {
      const now = Date.now();
      const from = Number(u.searchParams.get("from") ?? (now - 7 * 24 * 3600 * 1000)); // 7d default
      const to = Number(u.searchParams.get("to") ?? now);
      return { from, to };
    }

    // aggregate: clicks by src
    if (url.pathname === "/metrics/clicks_by_src" && req.method === "GET") {
      const { from, to } = parseWindow(url);
      const rows = await env.GEO_DB.prepare(
        `SELECT COALESCE(src,'unknown') AS src, COUNT(*) AS cnt
             FROM edge_click_event WHERE ts BETWEEN ?1 AND ?2
             GROUP BY src ORDER BY cnt DESC`
      ).bind(from, to).all<any>();
      const response = Response.json({ rows: rows.results ?? [] });
      return addCorsHeaders(response);
    }

    // aggregate: top pids
    if (url.pathname === "/metrics/top_pids" && req.method === "GET") {
      const { from, to } = parseWindow(url);
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 100);
      const rows = await env.GEO_DB.prepare(
        `SELECT COALESCE(pid,'') AS pid, COUNT(*) AS cnt
             FROM edge_click_event WHERE ts BETWEEN ?1 AND ?2
             GROUP BY pid ORDER BY cnt DESC LIMIT ?3`
      ).bind(from, to, limit).all<any>();
      const response = Response.json({ rows: rows.results ?? [] });
      return addCorsHeaders(response);
    }

    // timeseries (daily buckets)
    if (url.pathname === "/metrics/clicks_timeseries" && req.method === "GET") {
      const { from, to } = parseWindow(url);
      const rows = await env.GEO_DB.prepare(
        `SELECT CAST((ts/86400000) AS INTEGER) AS day, COUNT(*) AS cnt
             FROM edge_click_event WHERE ts BETWEEN ?1 AND ?2
             GROUP BY day ORDER BY day ASC`
      ).bind(from, to).all<any>();
      const response = Response.json({ rows: rows.results?.map(r => ({ day: r.day, ts: r.day * 86400000, cnt: r.cnt })) ?? [] });
      return addCorsHeaders(response);
    }

    // Citations API - recent AI citations
    if (url.pathname === "/citations/recent" && req.method === "GET") {
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);
      // TODO: Filter by current org/project when session context is available
      const rows = await env.GEO_DB.prepare(`
        SELECT c.id, c.ts, c.surface, c.query, c.url, c.rank, c.confidence,
               cap.model_variant, cap.persona
        FROM ai_citation_event c
        LEFT JOIN ai_surface_capture cap ON cap.id = c.capture_id
        ORDER BY c.ts DESC
        LIMIT ?1
      `).bind(limit).all<any>();

      const response = Response.json({ items: rows.results ?? [] });
      return addCorsForCredentials(response, req);
    }

    // Tokenless shortlinks for creators - /p/:pid
    if (url.pathname.startsWith("/p/") && req.method === "GET") {
      const pid = url.pathname.split("/").pop()!;
      // TODO: Namespace by org/project when multi-tenant scoping is implemented
      const mapped = await env.DEST_MAP.get(pid);
      if (!mapped) return new Response("Unknown PID", { status: 404 });

      const dest = new URL(mapped);
      if (!dest.searchParams.has("utm_source")) {
        dest.searchParams.set("utm_source", "ai_unknown");
        dest.searchParams.set("utm_medium", "ai_recommendation");
        dest.searchParams.set("utm_campaign", pid);
      }
      return Response.redirect(dest.toString(), 302);
    }

    // API Key Management (session required)
    // POST /keys  { project_id, name }
    if (url.pathname === "/keys" && req.method === "POST") {
      try {
        const { project_id, name } = await req.json() as any;
        if (!project_id || !name) {
          const response = new Response("bad request", { status: 400 });
          return addCorsHeaders(response);
        }
        
        // look up org of project
        const prj = await env.GEO_DB.prepare(
          "SELECT org_id FROM project WHERE id=?1"
        ).bind(project_id).first<any>();
        if (!prj) {
          const response = new Response("not found", { status: 404 });
          return addCorsHeaders(response);
        }
        
        await requireOrgMember(env, req, prj.org_id);

        const raw = rawKey();
        const hash = await sha256b64url(raw);
        const id = "key_" + crypto.randomUUID();
        
        await env.GEO_DB.prepare(
          "INSERT INTO api_key(id, project_id, name, hash, created_ts) VALUES (?1, ?2, ?3, ?4, ?5)"
        ).bind(id, project_id, name, hash, Date.now()).run();
        
        const response = Response.json({ id, name, project_id, raw }, { status: 201 }); // show raw once
        return addCorsHeaders(response);
      } catch (e: any) {
        const response = new Response(e.message || "error", { status: 500 });
        return addCorsHeaders(response);
      }
    }

    // GET /keys?project_id=...
    if (url.pathname === "/keys" && req.method === "GET") {
      try {
        const project_id = url.searchParams.get("project_id") || "";
        const prj = await env.GEO_DB.prepare("SELECT org_id FROM project WHERE id=?1").bind(project_id).first<any>();
        if (!prj) {
          const response = new Response("not found", { status: 404 });
          return addCorsHeaders(response);
        }
        
        await requireOrgMember(env, req, prj.org_id);

        const rows = await env.GEO_DB.prepare(
          "SELECT id, name, created_ts, last_used_ts, revoked_ts FROM api_key WHERE project_id=?1 ORDER BY created_ts DESC"
        ).bind(project_id).all<any>();
        
        const response = Response.json({ items: rows.results ?? [] });
        return addCorsHeaders(response);
      } catch (e: any) {
        const response = new Response(e.message || "error", { status: 500 });
        return addCorsHeaders(response);
      }
    }

    // DELETE /keys/:id
    if (url.pathname.startsWith("/keys/") && req.method === "DELETE") {
      try {
        const id = url.pathname.split("/").pop()!;
        const keyRow = await env.GEO_DB.prepare(
          "SELECT project_id FROM api_key WHERE id=?1"
        ).bind(id).first<any>();
        if (!keyRow) {
          const response = new Response("not found", { status: 404 });
          return addCorsHeaders(response);
        }
        
        const prj = await env.GEO_DB.prepare(
          "SELECT org_id FROM project WHERE id=?1"
        ).bind(keyRow.project_id).first<any>();
        
        await requireOrgMember(env, req, prj.org_id);
        
        await env.GEO_DB.prepare("UPDATE api_key SET revoked_ts=?1 WHERE id=?2").bind(Date.now(), id).run();
        
        const response = Response.json({ ok: true });
        return addCorsHeaders(response);
      } catch (e: any) {
        const response = new Response(e.message || "error", { status: 500 });
        return addCorsHeaders(response);
      }
    }

    // Public ingestion (no session; auth via raw project key)
    // POST /collect/conversion    Authorization: Bearer <RAW_KEY>
    if (url.pathname === "/collect/conversion" && req.method === "POST") {
      try {
        const raw = authzBearer(req);
        if (!raw) {
          const response = new Response("missing auth", { status: 401 });
          return addCorsHeaders(response);
        }
        
        const hash = await sha256b64url(raw);
        const key = await env.GEO_DB.prepare(
          "SELECT project_id, revoked_ts FROM api_key WHERE hash=?1 LIMIT 1"
        ).bind(hash).first<any>();
        
        if (!key || key.revoked_ts) {
          const response = new Response("forbidden", { status: 403 });
          return addCorsHeaders(response);
        }

        const body = await req.json().catch(() => ({})) as any;
        const { type, value_cents, meta } = body || {};
        if (!type) {
          const response = new Response("bad request", { status: 400 });
          return addCorsHeaders(response);
        }

        const prj = await env.GEO_DB.prepare(
          "SELECT org_id FROM project WHERE id=?1"
        ).bind(key.project_id).first<any>();

        await env.GEO_DB.prepare(
          `INSERT INTO conversion_event(ts, session_id, type, value_cents, meta, org_id, project_id)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
        ).bind(Date.now(), (body as any).session_id ?? null, String(type), Number(value_cents ?? 0), JSON.stringify(meta ?? {}), prj.org_id, key.project_id).run();

        await env.GEO_DB.prepare("UPDATE api_key SET last_used_ts=?1 WHERE hash=?2").bind(Date.now(), hash).run();
        
        const response = Response.json({ ok: true });
        return addCorsHeaders(response);
      } catch (e: any) {
        const response = new Response(e.message || "error", { status: 500 });
        return addCorsHeaders(response);
      }
    }

    // CSV exports (easy BI pulls)
    function csv(rows: any[]) {
      if (!rows.length) return "id,ts\n";
      const cols = Object.keys(rows[0]);
      const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      return cols.join(",") + "\n" + rows.map(r => cols.map(c => esc(r[c])).join(",")).join("\n") + "\n";
    }

    if (url.pathname === "/export/clicks.csv" && req.method === "GET") {
      const { from, to } = parseWindow(url);
      const rows = await env.GEO_DB.prepare(
        `SELECT id, ts, src, pid, dest, session_id FROM edge_click_event
             WHERE ts BETWEEN ?1 AND ?2 ORDER BY ts DESC LIMIT 10000`
      ).bind(from, to).all<any>();
      const response = new Response(csv(rows.results || []), { headers: { "content-type": "text/csv" } });
      return addCorsHeaders(response);
    }

    if (url.pathname === "/export/conversions.csv" && req.method === "GET") {
      const { from, to } = parseWindow(url);
      const rows = await env.GEO_DB.prepare(
        `SELECT id, ts, session_id, type, value_cents, meta FROM conversion_event
             WHERE ts BETWEEN ?1 AND ?2 ORDER BY ts DESC LIMIT 10000`
      ).bind(from, to).all<any>();
      const response = new Response(csv(rows.results || []), { headers: { "content-type": "text/csv" } });
      return addCorsHeaders(response);
    }

    // Authentication endpoints
    if (url.pathname === "/auth/magic/start" && req.method === "POST") {
      try {
        const body = await json<{ email: string }>(req);
        if (!body?.email) {
          const response = new Response("email required", { status: 400 });
          return addCorsHeaders(response);
        }

        const email = body.email.toLowerCase().trim();
        if (!email.includes("@")) {
          const response = new Response("invalid email", { status: 400 });
          return addCorsHeaders(response);
        }

        // Generate magic link token
        const token = crypto.randomUUID();
        const expires = Date.now() + 10 * 60 * 1000; // 10 minutes

        // Store magic link
        await env.GEO_DB.prepare(
          `INSERT OR REPLACE INTO magic_link (token, email, created_ts, expires_ts)
           VALUES (?1, ?2, ?3, ?4)`
        ).bind(token, email, Date.now(), expires).run();

        // Send email if RESEND_API_KEY is configured
        if (env.RESEND_API_KEY) {
          // TODO: Implement email sending with Resend
          console.log("Magic link email would be sent:", { email, token });
        } else {
          // Dev mode: log the link
          const baseUrl = env.APP_BASE_URL || "https://optiview.ai";
          console.log(`Magic link for ${email}: ${baseUrl}/auth/magic?token=${token}`);
        }

        const response = Response.json({ ok: true, message: "Magic link sent" });
        const origin = req.headers.get("origin");
        const allowed = ["optiview.ai"];
        if (origin && allowed.some(a => origin.endsWith(a))) {
          response.headers.set("Access-Control-Allow-Origin", origin);
          response.headers.set("Vary", "Origin");
          response.headers.set("Access-Control-Allow-Credentials", "true");
        }
        return response;
      } catch (e: any) {
        const response = new Response(e.message || "error", { status: 500 });
        return addCorsHeaders(response);
      }
    }

    if (url.pathname === "/auth/magic/verify" && req.method === "POST") {
      try {
        const body = await json<{ token: string }>(req);
        if (!body?.token) {
          const response = new Response("token required", { status: 400 });
          return addCorsHeaders(response);
        }

        // Verify magic link
        const magicLink = await env.GEO_DB.prepare(
          `SELECT email, expires_ts FROM magic_link WHERE token = ?1 AND used_ts IS NULL AND expires_ts > ?2`
        ).bind(body.token, Date.now()).first<any>();

        if (!magicLink) {
          const response = new Response("invalid or expired token", { status: 400 });
          return addCorsHeaders(response);
        }

        // Mark token as used
        await env.GEO_DB.prepare(
          `UPDATE magic_link SET used_ts = ?1 WHERE token = ?2`
        ).bind(Date.now(), body.token).run();

        // Upsert user
        let userId = await env.GEO_DB.prepare(
          `SELECT id FROM user WHERE email = ?1`
        ).bind(magicLink.email).first<any>();

        if (!userId) {
          userId = `usr_${crypto.randomUUID()}`;
          await env.GEO_DB.prepare(
            `INSERT INTO user (id, email, created_ts) VALUES (?1, ?2, ?3)`
          ).bind(userId, magicLink.email, Date.now()).run();
        } else {
          userId = userId.id;
        }

        // Create session
        const sessionId = `ses_${crypto.randomUUID()}`;
        const expires = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days

        await env.GEO_DB.prepare(
          `INSERT INTO session (id, user_id, created_ts, expires_ts) VALUES (?1, ?2, ?3, ?4)`
        ).bind(sessionId, userId, Date.now(), expires).run();

        // Update user last login
        await env.GEO_DB.prepare(
          `UPDATE user SET last_login_ts = ?1 WHERE id = ?2`
        ).bind(Date.now(), userId).run();

        const response = Response.json({ ok: true, user: { id: userId, email: magicLink.email } });
        const cookieAttrs = [
          "Path=/",
          "Max-Age=" + (30 * 24 * 60 * 60),
          "HttpOnly",
          "Secure",
          "SameSite=Lax",
          "Domain=.optiview.ai"
        ].join("; ");
        response.headers.set("Set-Cookie", `geodude_ses=${sessionId}; ${cookieAttrs}`);
        const origin = req.headers.get("origin");
        const allowed = ["optiview.ai"];
        if (origin && allowed.some(a => origin.endsWith(a))) {
          response.headers.set("Access-Control-Allow-Origin", origin);
          response.headers.set("Vary", "Origin");
          response.headers.set("Access-Control-Allow-Credentials", "true");
        }
        return response;
      } catch (e: any) {
        const response = new Response(e.message || "error", { status: 500 });
        return addCorsHeaders(response);
      }
    }

    if (url.pathname === "/auth/logout" && req.method === "POST") {
      const response = Response.json({ ok: true });
      const cookieAttrs = [
        "Path=/",
        "Max-Age=0",
        "HttpOnly",
        "Secure",
        "SameSite=Lax",
        "Domain=.optiview.ai"
      ].join("; ");
      response.headers.set("Set-Cookie", `geodude_ses=; ${cookieAttrs}`);
      const origin = req.headers.get("origin");
      const allowed = ["optiview.ai"];
      if (origin && allowed.some(a => origin.endsWith(a))) {
        response.headers.set("Access-Control-Allow-Origin", origin);
        response.headers.set("Vary", "Origin");
        response.headers.set("Access-Control-Allow-Credentials", "true");
      }
      return response;
    }

    // User management endpoints
    if (url.pathname === "/me" && req.method === "GET") {
      try {
        const sessionId = req.headers.get("cookie")?.match(/geodude_ses=([^;]+)/)?.[1];
        if (!sessionId) {
          const response = new Response("unauthorized", { status: 401 });
          return addCorsHeaders(response);
        }

        // Get session and user
        const session = await env.GEO_DB.prepare(
          `SELECT user_id, expires_ts, current_org_id, current_project_id FROM session WHERE id = ?1 AND expires_ts > ?2`
        ).bind(sessionId, Date.now()).first<any>();

        if (!session) {
          const response = new Response("unauthorized", { status: 401 });
          return addCorsForCredentials(response, req);
        }

        const user = await env.GEO_DB.prepare(
          `SELECT id, email, created_ts, last_login_ts FROM user WHERE id = ?1`
        ).bind(session.user_id).first<any>();

        if (!user) {
          const response = new Response("user not found", { status: 404 });
          return addCorsForCredentials(response, req);
        }

        // Get user's orgs and projects
        const orgs = await env.GEO_DB.prepare(
          `SELECT o.id, o.name, om.role FROM organization o
           JOIN org_member om ON o.id = om.org_id
           WHERE om.user_id = ?1`
        ).bind(session.user_id).all<any>();

        const projects = await env.GEO_DB.prepare(
          `SELECT p.id, p.name, p.slug, p.domain, p.org_id FROM project p
           JOIN org_member om ON p.org_id = om.org_id
           WHERE om.user_id = ?1`
        ).bind(session.user_id).all<any>();

        const response = Response.json({
          user,
          orgs: orgs.results || [],
          projects: projects.results || [],
          current: session.current_org_id && session.current_project_id ? {
            org_id: session.current_org_id,
            project_id: session.current_project_id
          } : null
        });
        const origin = req.headers.get("origin");
        const allowed = ["optiview.ai"];
        if (origin && allowed.some(a => origin.endsWith(a))) {
          response.headers.set("Access-Control-Allow-Origin", origin);
          response.headers.set("Vary", "Origin");
          response.headers.set("Access-Control-Allow-Credentials", "true");
        }
        return response;
      } catch (e: any) {
        const response = new Response(e.message || "error", { status: 500 });
        return addCorsHeaders(response);
      }
    }

    // Organization management
    if (url.pathname === "/org" && req.method === "POST") {
      try {
        const sessionId = req.headers.get("cookie")?.match(/geodude_ses=([^;]+)/)?.[1];
        if (!sessionId) {
          const response = new Response("unauthorized", { status: 401 });
          return addCorsHeaders(response);
        }

        const body = await json<{ name: string }>(req);
        if (!body?.name) {
          const response = new Response("name required", { status: 400 });
          return addCorsHeaders(response);
        }

        // Get user from session
        const session = await env.GEO_DB.prepare(
          `SELECT user_id FROM session WHERE id = ?1 AND expires_ts > ?2`
        ).bind(sessionId, Date.now()).first<any>();

        if (!session) {
          const response = new Response("unauthorized", { status: 401 });
          return addCorsHeaders(response);
        }

        // Create organization
        const orgId = `org_${crypto.randomUUID()}`;
        await env.GEO_DB.prepare(
          `INSERT INTO organization (id, name, created_ts) VALUES (?1, ?2, ?3)`
        ).bind(orgId, body.name, Date.now()).run();

        // Add user as admin
        await env.GEO_DB.prepare(
          `INSERT INTO org_member (org_id, user_id, role) VALUES (?1, ?2, ?3)`
        ).bind(orgId, session.user_id, "admin").run();

        const response = Response.json({ ok: true, org: { id: orgId, name: body.name } });
        const origin = req.headers.get("origin");
        const allowed = ["optiview.ai"];
        if (origin && allowed.some(a => origin.endsWith(a))) {
          response.headers.set("Access-Control-Allow-Origin", origin);
          response.headers.set("Vary", "Origin");
          response.headers.set("Access-Control-Allow-Credentials", "true");
        }
        return response;
      } catch (e: any) {
        const response = new Response(e.message || "error", { status: 500 });
        return addCorsHeaders(response);
      }
    }

    // Project management
    if (url.pathname === "/project" && req.method === "POST") {
      try {
        const sessionId = req.headers.get("cookie")?.match(/geodude_ses=([^;]+)/)?.[1];
        if (!sessionId) {
          const response = new Response("unauthorized", { status: 401 });
          return addCorsHeaders(response);
        }

        const body = await json<{ org_id: string; name: string; slug: string; domain?: string }>(req);
        if (!body?.org_id || !body?.name || !body?.slug) {
          const response = new Response("org_id, name, and slug required", { status: 400 });
          return addCorsHeaders(response);
        }

        // Get user from session first
        const session = await env.GEO_DB.prepare(
          `SELECT user_id FROM session WHERE id = ?1 AND expires_ts > ?2`
        ).bind(sessionId, Date.now()).first<any>();

        if (!session) {
          const response = new Response("unauthorized", { status: 401 });
          return addCorsForCredentials(response, req);
        }

        // Verify user is member of org
        const membership = await env.GEO_DB.prepare(
          `SELECT user_id FROM org_member WHERE org_id = ?1 AND user_id = ?2`
        ).bind(body.org_id, session.user_id).first<any>();

        if (!membership) {
          const response = new Response("unauthorized", { status: 401 });
          return addCorsForCredentials(response, req);
        }

        // Create project
        const projectId = `prj_${crypto.randomUUID()}`;
        await env.GEO_DB.prepare(
          `INSERT INTO project (id, org_id, name, slug, domain, created_ts) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
        ).bind(projectId, body.org_id, body.name, body.slug, body.domain || null, Date.now()).run();

        const response = Response.json({ ok: true, project: { id: projectId, name: body.name, slug: body.slug } });
        const origin = req.headers.get("origin");
        const allowed = ["optiview.ai"];
        if (origin && allowed.some(a => origin.endsWith(a))) {
          response.headers.set("Access-Control-Allow-Origin", origin);
          response.headers.set("Vary", "Origin");
          response.headers.set("Access-Control-Allow-Credentials", "true");
        }
        return response;
      } catch (e: any) {
        const response = new Response(e.message || "error", { status: 500 });
        return addCorsForCredentials(response, req);
      }
    }

    // Set current org/project context
    if (url.pathname === "/me/set-current" && req.method === "POST") {
      try {
        const sessionId = req.headers.get("cookie")?.match(/geodude_ses=([^;]+)/)?.[1];
        if (!sessionId) {
          const response = new Response("unauthorized", { status: 401 });
          return addCorsHeaders(response);
        }

        const body = await json<{ org_id: string; project_id: string }>(req);
        if (!body?.org_id || !body?.project_id) {
          const response = new Response("org_id and project_id required", { status: 400 });
          return addCorsHeaders(response);
        }

        // Verify user is member of org
        const session = await env.GEO_DB.prepare(
          `SELECT user_id FROM session WHERE id = ?1 AND expires_ts > ?2`
        ).bind(sessionId, Date.now()).first<any>();

        if (!session) {
          const response = new Response("unauthorized", { status: 401 });
          return addCorsHeaders(response);
        }

        const membership = await env.GEO_DB.prepare(
          `SELECT user_id FROM org_member WHERE org_id = ?1 AND user_id = ?2`
        ).bind(body.org_id, session.user_id).first<any>();

        if (!membership) {
          const response = new Response("unauthorized", { status: 401 });
          return addCorsHeaders(response);
        }

        // Store current context in session (we'll add a current_context column)
        // For now, we'll use a simple approach and store it in the session table
        // In production, you might want a separate table for this
        await env.GEO_DB.prepare(
          `UPDATE session SET current_org_id = ?1, current_project_id = ?2 WHERE id = ?3`
        ).bind(body.org_id, body.project_id, sessionId).run();

        const response = Response.json({ ok: true });
        const origin = req.headers.get("origin");
        const allowed = ["optiview.ai"];
        if (origin && allowed.some(a => origin.endsWith(a))) {
          response.headers.set("Access-Control-Allow-Origin", origin);
          response.headers.set("Vary", "Origin");
          response.headers.set("Access-Control-Allow-Credentials", "true");
        }
        return response;
      } catch (e: any) {
        const response = new Response(e.message || "error", { status: 500 });
        return addCorsHeaders(response);
      }
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
    // Extract org/project from token or fallback to system IDs
    const org = (payload as any).org || "org_system";
    const prj = (payload as any).prj || "prj_system";
    const kvKey = `${org}:${prj}:${pid}`; // namespaced
    const mapped = await env.DEST_MAP.get(kvKey);
    if (mapped) return mapped;
  }
  const base = requireCanonicalBase(env); // throws if missing
  return new URL("/", base).toString();
}

async function insertClick(db: D1Database, row: any) {
  await db
    .prepare(
      `INSERT INTO edge_click_event
       (ts, src, model, pid, geo, ua, ip, asn, dest, session_id, org_id, project_id)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`
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
      row.session_id,
      row.org_id || "org_system",
      row.project_id || "prj_system"
    )
    .run();
}
