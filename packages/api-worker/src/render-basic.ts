/**
 * Basic Fetch Only Renderer
 * No headless browser - just basic HTTP fetch with timeout
 */

export interface RenderResult {
  ok: boolean;
  status: number;
  contentType: string;
  html: string;
  loadTimeMs: number;
}

export async function renderPage(url: string, env: any): Promise<RenderResult> {
  const t0 = Date.now();

  // basic fetch only (no headless attempts)
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort('timeout'), Number(env.FETCH_TIMEOUT_MS ?? 5000));
  
  try {
    const res = await fetch(url, { 
      signal: ctrl.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36 OptiviewAudit/1.0'
      }
    });
    
    const status = res.status;
    const ct = res.headers.get('content-type') || '';
    const buf = await res.arrayBuffer();            // consume body to avoid CF deadlocks
    
    return {
      ok: status >= 200 && status < 300,
      status, 
      contentType: ct,
      html: new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(buf)),
      loadTimeMs: Date.now() - t0,
    };
  } catch (e) {
    return { 
      ok: false, 
      status: 0, 
      contentType: '', 
      html: '', 
      loadTimeMs: Date.now() - t0 
    };
  } finally {
    clearTimeout(to);
  }
}
