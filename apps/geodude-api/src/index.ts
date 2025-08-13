import { verifyToken } from "@geodude/shared";
import { ensureUTMs } from "@geodude/shared";

type Env = {
  HMAC_KEY: string;
  INGEST_API_KEY: string;
  GEO_DB: D1Database;
  AI_CAPTURES: R2Bucket;
  DEST_MAP: KVNamespace;
  CANONICAL_BASE: string;
  RESEND_API_KEY?: string;
  APP_BASE_URL?: string;
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
      const response = new Response(null, { status: 204 });
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      response.headers.set('Access-Control-Allow-Origin', '*');
      return response;
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
          session_id: sid,
          org_id: (payload as any).org || "org_system",
          project_id: (payload as any).prj || "prj_system"
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
        const org = url.searchParams.get("org") || "org_system";
        const project = url.searchParams.get("project") || "prj_system";
        const prefix = `${org}:${project}:`;

        const list = await env.DEST_MAP.list({ prefix, limit: 1000 });
        const rows = await Promise.all(
          (list.keys || []).map(async k => {
            const pid = k.name.replace(prefix, ""); // Remove prefix for display
            return { pid, url: await env.DEST_MAP.get(k.name) };
          })
        );
        const response = Response.json({ items: rows, org, project });
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
        const body = await json<{ pid: string; url: string; org?: string; project?: string }>(req);
        if (!body?.pid || !body?.url) {
          const response = new Response("bad request", { status: 400 });
          return addCorsHeaders(response);
        }
        const org = body.org || "org_system";
        const project = body.project || "prj_system";
        const kvKey = `${org}:${project}:${body.pid}`;
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
        requireAdmin(req, env);
        const pid = url.searchParams.get("pid");
        const org = url.searchParams.get("org") || "org_system";
        const project = url.searchParams.get("project") || "prj_system";
        if (!pid) {
          const response = new Response("bad request", { status: 400 });
          return addCorsHeaders(response);
        }
        const kvKey = `${org}:${project}:${pid}`;
        await env.DEST_MAP.delete(kvKey);
        const response = Response.json({ ok: true, key: kvKey });
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
      return crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
        .then(k => crypto.subtle.sign("HMAC", k, new TextEncoder().encode(body)))
        .then(buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
    }

    if (url.pathname === "/ai/corpus.ndjson" && req.method === "GET") {
      const body = [
        JSON.stringify({ type: "entity", id: "site", canonical: "https://geodude.pages.dev" }),
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
        JSON.stringify({ type: "faq", q: "What is geodude?", a: "AI referral tracking and GEO toolkit.", canonical: "https://geodude.pages.dev" })
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
        requireAdmin(req, env);
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

        const tokenPayload: TokenV1 | TokenV2 = (body.org_id || body.project_id) ? {
          v: 2,
          org,
          prj,
          src: body.src,
          model: body.model ?? null,
          pid: body.pid,
          geo: body.geo ?? null,
          exp: Math.floor(Date.now() / 1000) + ttl * 60
        } : {
          v: 1,
          src: body.src,
          model: body.model ?? null,
          pid: body.pid,
          geo: body.geo ?? null,
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
          const baseUrl = env.APP_BASE_URL || "https://geodude.pages.dev";
          console.log(`Magic link for ${email}: ${baseUrl}/auth/magic?token=${token}`);
        }

        const response = Response.json({ ok: true, message: "Magic link sent" });
        return addCorsHeaders(response);
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
        response.headers.set("Set-Cookie", `geodude_ses=${sessionId}; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}; Path=/`);
        return addCorsHeaders(response);
      } catch (e: any) {
        const response = new Response(e.message || "error", { status: 500 });
        return addCorsHeaders(response);
      }
    }

    if (url.pathname === "/auth/logout" && req.method === "POST") {
      const response = Response.json({ ok: true });
      response.headers.set("Set-Cookie", "geodude_ses=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/");
      return addCorsHeaders(response);
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
          `SELECT user_id, expires_ts FROM session WHERE id = ?1 AND expires_ts > ?2`
        ).bind(sessionId, Date.now()).first<any>();

        if (!session) {
          const response = new Response("unauthorized", { status: 401 });
          return addCorsHeaders(response);
        }

        const user = await env.GEO_DB.prepare(
          `SELECT id, email, created_ts, last_login_ts FROM user WHERE id = ?1`
        ).bind(session.user_id).first<any>();

        if (!user) {
          const response = new Response("user not found", { status: 404 });
          return addCorsHeaders(response);
        }

        // Get user's orgs and projects
        const orgs = await env.GEO_DB.prepare(
          `SELECT o.id, o.name, om.role FROM organization o
           JOIN org_member om ON o.id = om.org_id
           WHERE om.user_id = ?1`
        ).bind(session.user_id).all<any>();

        const projects = await env.GEO_DB.prepare(
          `SELECT p.id, p.name, p.slug, p.domain FROM project p
           JOIN org_member om ON p.org_id = om.org_id
           WHERE om.user_id = ?1`
        ).bind(session.user_id).all<any>();

        const response = Response.json({
          user,
          orgs: orgs.results || [],
          projects: projects.results || []
        });
        return addCorsHeaders(response);
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
        return addCorsHeaders(response);
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

        // Verify user is member of org
        const membership = await env.GEO_DB.prepare(
          `SELECT user_id FROM org_member WHERE org_id = ?1 AND user_id = ?2`
        ).bind(body.org_id, req.headers.get("cookie")?.match(/geodude_ses=([^;]+)/)?.[1]).first<any>();

        if (!membership) {
          const response = new Response("unauthorized", { status: 401 });
          return addCorsHeaders(response);
        }

        // Create project
        const projectId = `prj_${crypto.randomUUID()}`;
        await env.GEO_DB.prepare(
          `INSERT INTO project (id, org_id, name, slug, domain, created_ts) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
        ).bind(projectId, body.org_id, body.name, body.slug, body.domain || null, Date.now()).run();

        const response = Response.json({ ok: true, project: { id: projectId, name: body.name, slug: body.slug } });
        return addCorsHeaders(response);
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
