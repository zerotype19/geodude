export type MetricsEnv = { METRICS: KVNamespace; METRICS_OFF?: string };

const WINDOW_MINUTES = 5;
const MAX_LAT_SAMPLES_PER_MIN = 60; // ~ 1/sec cap per minute bucket

function minuteKey(d = new Date()) {
  const m = new Date(d);
  m.setSeconds(0, 0);
  const iso = m.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  return iso; 
}

function key(prefix: string, minuteIso: string) {
  return `${prefix}:${minuteIso}`; // e.g. metrics:req:2025-08-20T08:45
}

export async function recordRequestMetrics(
  env: MetricsEnv,
  status: number,
  durationMs: number
) {
  if (!env.METRICS || env.METRICS_OFF === "true") return;

  const minuteIso = minuteKey();

  // 1) request counts
  const reqKey = key("metrics:req", minuteIso);
  const errKey = key("metrics:err", minuteIso);

  // KV has no atomic increments; for our volume this read+write is fine.
  const [reqRaw, errRaw] = await Promise.all([
    env.METRICS.get(reqKey),
    status >= 500 ? env.METRICS.get(errKey) : Promise.resolve(null),
  ]);

  const reqCount = (reqRaw ? parseInt(reqRaw, 10) : 0) + 1;
  const errCount = status >= 500 ? (errRaw ? parseInt(errRaw, 10) : 0) + 1 : null;

  const putPromises: Promise<any>[] = [
    env.METRICS.put(reqKey, String(reqCount), { expirationTtl: WINDOW_MINUTES * 120 }),
  ];
  if (errCount !== null) {
    putPromises.push(env.METRICS.put(errKey, String(errCount), { expirationTtl: WINDOW_MINUTES * 120 }));
  }

  // 2) tiny latency reservoir per minute
  const latKey = key("metrics:lat", minuteIso); // JSON array of small sample
  const latRaw = await env.METRICS.get(latKey);
  let arr: number[] = [];
  if (latRaw) {
    try { arr = JSON.parse(latRaw); } catch {}
  }
  // keep to fixed size
  if (arr.length < MAX_LAT_SAMPLES_PER_MIN) {
    arr.push(durationMs);
  } else {
    // reservoir: replace a random element
    const idx = Math.floor(Math.random() * arr.length);
    arr[idx] = durationMs;
  }
  putPromises.push(env.METRICS.put(latKey, JSON.stringify(arr), { expirationTtl: WINDOW_MINUTES * 120 }));

  // 3) status breakdown (optional, for error breakdown widget)
  const scKey = key(`metrics:sc:${status}`, minuteIso);
  const scRaw = await env.METRICS.get(scKey);
  const scCount = (scRaw ? parseInt(scRaw, 10) : 0) + 1;
  putPromises.push(env.METRICS.put(scKey, String(scCount), { expirationTtl: WINDOW_MINUTES * 120 }));

  await Promise.all(putPromises);
}

// helper to aggregate last 5 minute buckets
export async function readWindow(env: MetricsEnv) {
  const now = new Date();
  const minutes: string[] = [];
  for (let i = WINDOW_MINUTES - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 60_000);
    minutes.push(minuteKey(d));
  }

  let totalReq = 0;
  let totalErr = 0;
  const latencies: number[] = [];
  const statusMap = new Map<number, number>();

  for (const min of minutes) {
    const [req, err] = await Promise.all([
      env.METRICS.get(key("metrics:req", min)),
      env.METRICS.get(key("metrics:err", min)),
    ]);

    totalReq += req ? parseInt(req, 10) : 0;
    totalErr += err ? parseInt(err, 10) : 0;

    // latency
    const latRaw = await env.METRICS.get(key("metrics:lat", min));
    if (latRaw) {
      try {
        const arr: number[] = JSON.parse(latRaw);
        latencies.push(...arr);
      } catch {}
    }

    // status breakdown: fetch a small set of common statuses only to keep calls light
    for (const sc of [200, 201, 204, 400, 401, 403, 404, 429, 500, 502, 503]) {
      const scRaw = await env.METRICS.get(key(`metrics:sc:${sc}`, min));
      if (scRaw) {
        statusMap.set(sc, (statusMap.get(sc) || 0) + parseInt(scRaw, 10));
      }
    }
  }

  latencies.sort((a, b) => a - b);
  const p = (q: number) => {
    if (latencies.length === 0) return 0;
    const idx = Math.min(latencies.length - 1, Math.floor(q * (latencies.length - 1)));
    return Math.round(latencies[idx]);
  };

  return {
    totalReq,
    totalErr,
    p50: p(0.5),
    p95: p(0.95),
    statusBreakdown: Array.from(statusMap.entries()).map(([status, count]) => ({ status, count })),
  };
}
