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

        // minimally write to D1 synchronously (Queues later)
        await insertClick(env.GEO_DB, {
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
        });

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
