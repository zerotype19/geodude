import { detectBot } from "./detect";

export type RawHit = {
  domain?: string; host?: string; hostname?: string;
  path?: string; uri?: string; url?: string;
  user_agent?: string; ua?: string;
  status?: number; code?: number;
  ts?: number; timestamp?: string | number;
  ip?: string; ip_hash?: string;
  headers?: any; extra?: any;
};

export function normalizeHit(raw: RawHit, source: string = "api.ingest"): {
  ok: boolean;
  reason?: string;
  record?: {
    id: string;
    domain: string;
    path: string;
    bot: string;
    ua: string;
    status: number | null;
    ts: number;
    source: string;
    ip_hash?: string | null;
    extra_json?: string | null;
  };
} {
  const ua = (raw.user_agent ?? raw.ua ?? "").toString();
  if (!ua) return { ok: false, reason: "missing UA" };
  
  const bot = detectBot(ua);
  if (!bot) return { ok: false, reason: "not ai bot" };

  // Extract domain from various possible fields
  let domain = "";
  if (raw.domain) {
    domain = raw.domain.toString().toLowerCase();
  } else if (raw.host) {
    domain = raw.host.toString().toLowerCase();
  } else if (raw.hostname) {
    domain = raw.hostname.toString().toLowerCase();
  } else if (raw.url) {
    try {
      domain = new URL(raw.url.toString()).hostname.toLowerCase();
    } catch {}
  }
  
  if (!domain) return { ok: false, reason: "missing domain" };

  // Extract path from various possible fields
  let path = "/";
  if (raw.path) {
    path = raw.path.toString();
  } else if (raw.uri) {
    path = raw.uri.toString();
  } else if (raw.url) {
    try {
      path = new URL(raw.url.toString()).pathname;
    } catch {}
  }
  
  // Normalize path (strip trailing slash except for root)
  path = path.replace(/\/+$/, '') || '/';

  const status = raw.status ?? raw.code ?? null;
  
  // Parse timestamp
  let ts = Date.now();
  if (typeof raw.ts === "number") {
    ts = raw.ts;
  } else if (raw.timestamp) {
    const parsed = new Date(raw.timestamp.toString()).getTime();
    if (!isNaN(parsed)) {
      ts = parsed;
    }
  }

  const id = `${domain}:${path}:${bot.key}:${ts}`;
  const extra_json = JSON.stringify(raw.extra ?? raw.headers ?? {});
  const ip_hash = raw.ip_hash ? raw.ip_hash.toString() : undefined;

  return {
    ok: true,
    record: { 
      id, 
      domain, 
      path, 
      bot: bot.key, 
      ua, 
      status, 
      ts, 
      source, 
      ip_hash, 
      extra_json 
    }
  };
}

