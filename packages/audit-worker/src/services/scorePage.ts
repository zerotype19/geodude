import { runChecksOnHtml } from "../scoring/runner";
import { persistPageChecksToAnalysis } from "../scoring/persist";

const MAX_HTML_SIZE = 2 * 1024 * 1024; // 2MB hard cap
const MIN_RENDERED_SIZE = 5 * 1024;    // 5KB minimum for rendered HTML

export async function scoreAndPersistPage(
  db: D1Database, 
  page: { 
    id: string; 
    url: string; 
    html_rendered?: string | null; 
    html_static?: string | null 
  }, 
  site: { 
    domain: string; 
    homepageUrl: string; 
    targetLocale?: "en" | "en-US" 
  }
) {
  // Guardrail 1: Prefer rendered HTML, but fallback if too small (render gap)
  let html = page.html_rendered || "";
  if (html && html.length < MIN_RENDERED_SIZE && page.html_static) {
    console.log(`[SCORING] Render gap detected for ${page.url}, using static HTML`);
    html = page.html_static;
  } else if (!html) {
    html = page.html_static || "";
  }
  
  if (!html) {
    console.warn(`[SCORING] No HTML available for ${page.url}`);
    return;
  }
  
  // Guardrail 2: Cap huge HTML to prevent parsing issues
  if (html.length > MAX_HTML_SIZE) {
    console.warn(`[SCORING] HTML truncated for ${page.url} (${html.length} bytes)`);
    html = html.slice(0, MAX_HTML_SIZE);
  }
  
  // Guardrail 3: Ensure targetLocale defaults to en-US
  const normalizedSite = {
    ...site,
    targetLocale: site.targetLocale || "en-US" as "en-US"
  };
  
  try {
    const results = runChecksOnHtml({ url: page.url, html, site: normalizedSite });
    
    // Guardrail 4: Log any errors in check execution
    const errors = results.filter(r => r.status === "error");
    if (errors.length > 0) {
      console.error(`[SCORING] Errors in ${page.url}:`, errors.map(e => `${e.id}: ${e.details?.error}`).join(", "));
    }
    
    await persistPageChecksToAnalysis(db, page.id, results);
  } catch (error) {
    console.error(`[SCORING] Failed to score ${page.url}:`, error);
    throw error; // Re-throw for upstream handling
  }
}

