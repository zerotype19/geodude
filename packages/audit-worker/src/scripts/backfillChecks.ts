/**
 * Backfill Diagnostics for Existing Audits
 * 
 * Re-runs diagnostics for pages where checks_json is null/empty without re-crawling.
 * Useful for applying new diagnostic logic to historical audits.
 * Uses the new D1 diagnostics system.
 */

import { runDiagnosticsForPage } from "../diagnostics/runPage";
import { runDiagnosticsForSite } from "../diagnostics/runSite";
import type { Env } from "../index";

interface PageRow {
  id: string;
  url: string;
  html_rendered: string | null;
  html_static: string | null;
}

export async function backfillChecks(
  env: Env, 
  auditId: string, 
  site: { 
    domain: string; 
    homepageUrl: string; 
    targetLocale?: "en" | "en-US" 
  }
) {
  const rows = (await env.DB.prepare(`
    SELECT p.id, p.url, p.html_rendered, p.html_static
    FROM audit_pages p
    LEFT JOIN audit_page_analysis a ON a.page_id = p.id
    WHERE p.audit_id = ?1 
      AND (a.checks_json IS NULL OR a.checks_json = '' OR a.checks_json = '[]')
      AND (p.html_rendered IS NOT NULL OR p.html_static IS NOT NULL)
  `).bind(auditId).all()).results as PageRow[] || [];

  let processed = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Process page-level diagnostics
  for (const row of rows) {
    try {
      await runDiagnosticsForPage(env.DB, {
        pageId: row.id,
        url: row.url,
        html_rendered: row.html_rendered,
        html_static: row.html_static,
        site
      });
      processed++;
      console.log(`[BACKFILL] Processed diagnostics: ${row.url}`);
    } catch (error) {
      skipped++;
      const msg = `${row.url}: ${(error as Error).message}`;
      errors.push(msg);
      console.error(`[BACKFILL] Error processing ${msg}`);
    }
  }

  // Process site-level diagnostics
  try {
    const pagesWithChecks = await env.DB.prepare(`
      SELECT p.id, p.url, p.html_rendered, p.html_static, apa.checks_json
      FROM audit_pages p
      LEFT JOIN audit_page_analysis apa ON apa.page_id = p.id
      WHERE p.audit_id = ?
    `).bind(auditId).all();

    await runDiagnosticsForSite(env.DB, {
      auditId,
      domain: site.domain,
      pages: (pagesWithChecks.results || []).map((r: any) => ({
        id: r.id,
        url: r.url,
        html_rendered: r.html_rendered,
        html_static: r.html_static,
        checks: r.checks_json ? JSON.parse(r.checks_json) : []
      }))
    });
    console.log(`[BACKFILL] Completed site-level diagnostics for ${auditId}`);
  } catch (error) {
    errors.push(`Site diagnostics: ${(error as Error).message}`);
    console.error(`[BACKFILL] Error in site diagnostics:`, error);
  }

  return { 
    total: rows.length,
    processed, 
    skipped,
    errors: errors.slice(0, 10) // Return first 10 errors
  };
}

/**
 * Backfill multiple audits in batch
 */
export async function backfillMultipleAudits(
  env: Env,
  auditIds: string[]
) {
  const results = [];
  
  for (const auditId of auditIds) {
    try {
      // Get audit details for site info
      const audit = await env.DB.prepare(
        "SELECT root_url FROM audits WHERE id = ?"
      ).bind(auditId).first();
      
      if (!audit) {
        results.push({ auditId, status: 'not_found' });
        continue;
      }
      
      const url = new URL(audit.root_url as string);
      const result = await backfillChecks(env, auditId, {
        domain: url.hostname,
        homepageUrl: audit.root_url as string,
        targetLocale: "en-US"
      });
      
      results.push({ auditId, status: 'success', ...result });
    } catch (error) {
      results.push({ 
        auditId, 
        status: 'error', 
        error: (error as Error).message 
      });
    }
  }
  
  return results;
}
