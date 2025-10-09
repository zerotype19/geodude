// Protects /admin and /admin/* and proxies /admin/api/* to the API with server-side auth
export const onRequest: PagesFunction<{ ADMIN_BASIC_AUTH: string }> = async (ctx) => {
  const { request, env, next } = ctx;
  const url = new URL(request.url);

  // 1) Check Basic Auth on the incoming request (browser prompts)
  const auth = request.headers.get("authorization") || "";
  const ok = (() => {
    if (!auth.startsWith("Basic ")) return false;
    try {
      const [, b64] = auth.split(" ");
      const creds = atob(b64);
      return creds === env.ADMIN_BASIC_AUTH; // "user:pass"
    } catch {
      return false;
    }
  })();
  if (!ok) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Optiview Admin"' },
    });
  }

  // 2) If the admin page calls /admin/api/*, proxy to the API with the same creds (kept server-side)
  if (url.pathname.startsWith("/admin/api/")) {
    const upstream = new URL(url.pathname.replace("/admin/api", "/v1/admin"), "https://api.optiview.ai");
    // forward query string if present
    upstream.search = url.search;

    const res = await fetch(upstream.toString(), {
      method: request.method,
      headers: {
        "authorization": "Basic " + btoa(env.ADMIN_BASIC_AUTH),
        "accept": "application/json",
        "content-type": "application/json",
      },
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.clone().arrayBuffer(),
    });

    // pass through JSON as-is
    return new Response(res.body, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") || "application/json",
        "cache-control": "no-store",
      },
    });
  }

  // 3) Otherwise, serve the SPA asset (React handles /admin route)
  return next();
};

