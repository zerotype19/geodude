/**
 * MVA (Measured Visibility & Authority) Computation
 * 
 * Computes competitive visibility metrics from citations data
 */

import { extractDomain } from '../lib/urlNormalizer';

export interface Env {
  DB: D1Database;
}

export interface MVAMetrics {
  mva_index: number;          // 0-100
  mentions_count: number;
  unique_urls: number;
  impression_estimate: number;
  competitors: Array<{
    domain: string;
    mentions: number;
    share: number;
  }>;
  window: string;             // '7d' | '30d'
  computed_at: string;
}

// Assistant impression weights
const ASSISTANT_WEIGHTS: Record<string, number> = {
  chatgpt: 5,
  claude: 3,
  perplexity: 2,
  brave: 1
};

/**
 * Compute MVA metrics for an audit
 */
export async function computeMVA(
  db: D1Database,
  projectId: string,
  auditId: string,
  window: '7d' | '30d' = '30d'
): Promise<MVAMetrics> {
  console.log(`[MVA] Computing metrics for audit ${auditId}, window: ${window}...`);

  // Get window cutoff date
  const windowDays = window === '7d' ? 7 : 30;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - windowDays);
  const cutoffISO = cutoffDate.toISOString();

  // Get audit domain
  const audit = await db.prepare(`
    SELECT root_url FROM audits WHERE id = ?
  `).bind(auditId).first() as any;

  if (!audit) {
    throw new Error(`Audit ${auditId} not found`);
  }

  const auditDomain = extractDomain(audit.root_url);

  // Get citations in window
  const citations = await db.prepare(`
    SELECT 
      cited_url,
      assistant,
      cited_at
    FROM citations
    WHERE audit_id = ?
      AND cited_at >= ?
  `).bind(auditId, cutoffISO).all();

  const citationRows = citations.results as any[] || [];

  // Compute mentions count
  const mentions_count = citationRows.length;

  // Compute unique URLs
  const uniqueUrls = new Set(citationRows.map(c => c.cited_url));
  const unique_urls = uniqueUrls.size;

  // Compute impression estimate
  let impression_estimate = 0;
  for (const citation of citationRows) {
    const weight = ASSISTANT_WEIGHTS[citation.assistant.toLowerCase()] || 1;
    impression_estimate += weight;
  }

  // Compute competitors (domains that aren't the audited domain)
  const competitorDomains = new Map<string, number>();
  for (const citation of citationRows) {
    const domain = extractDomain(citation.cited_url);
    if (domain !== auditDomain) {
      competitorDomains.set(domain, (competitorDomains.get(domain) || 0) + 1);
    }
  }

  // Sort competitors by mentions
  const competitors = Array.from(competitorDomains.entries())
    .map(([domain, mentions]) => ({
      domain,
      mentions,
      share: mentions / (mentions_count || 1)
    }))
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 10);  // Top 10 competitors

  // Compute MVA index (0-100)
  const totalCompetitorMentions = competitors.reduce((sum, c) => sum + c.mentions, 0);
  const mva_index = Math.min(100, Math.round(
    mentions_count / Math.max(1, mentions_count + totalCompetitorMentions) * 100
  ));

  const metrics: MVAMetrics = {
    mva_index,
    mentions_count,
    unique_urls,
    impression_estimate,
    competitors,
    window,
    computed_at: new Date().toISOString()
  };

  // Store in mva_metrics table
  await db.prepare(`
    INSERT INTO mva_metrics (
      project_id,
      audit_id,
      window,
      assistant,
      mva_index,
      mentions_count,
      unique_urls,
      impression_estimate,
      competitor_json,
      computed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    projectId,
    auditId,
    window,
    'all',  // Aggregate across all assistants
    mva_index,
    mentions_count,
    unique_urls,
    impression_estimate,
    JSON.stringify(competitors),
    metrics.computed_at
  ).run();

  console.log(`[MVA] Computed metrics: MVA=${mva_index}, mentions=${mentions_count}, competitors=${competitors.length}`);

  return metrics;
}

/**
 * Get latest MVA metrics for an audit
 */
export async function getMVAMetrics(
  db: D1Database,
  auditId: string,
  window: '7d' | '30d' = '30d'
): Promise<MVAMetrics | null> {
  const result = await db.prepare(`
    SELECT *
    FROM mva_metrics
    WHERE audit_id = ?
      AND window = ?
      AND assistant = 'all'
    ORDER BY computed_at DESC
    LIMIT 1
  `).bind(auditId, window).first() as any;

  if (!result) {
    return null;
  }

  return {
    mva_index: result.mva_index,
    mentions_count: result.mentions_count,
    unique_urls: result.unique_urls,
    impression_estimate: result.impression_estimate,
    competitors: JSON.parse(result.competitor_json || '[]'),
    window: result.window,
    computed_at: result.computed_at
  };
}

/**
 * Compute MVA for all recent audits (cron job)
 */
export async function computeMVAForAllAudits(db: D1Database): Promise<void> {
  console.log('[MVA Cron] Starting daily MVA computation...');

  // Get audits from last 30 days that have citations
  const audits = await db.prepare(`
    SELECT DISTINCT a.id, a.project_id
    FROM audits a
    JOIN citations c ON a.id = c.audit_id
    WHERE a.finished_at >= datetime('now', '-30 days')
    ORDER BY a.finished_at DESC
    LIMIT 100
  `).all();

  if (!audits.results || audits.results.length === 0) {
    console.log('[MVA Cron] No audits with citations found');
    return;
  }

  console.log(`[MVA Cron] Computing MVA for ${audits.results.length} audits...`);

  for (const audit of audits.results as any[]) {
    try {
      // Compute both 7d and 30d windows
      await computeMVA(db, audit.project_id, audit.id, '7d');
      await computeMVA(db, audit.project_id, audit.id, '30d');
    } catch (error) {
      console.error(`[MVA Cron] Error computing MVA for audit ${audit.id}:`, error);
    }
  }

  console.log('[MVA Cron] Daily MVA computation complete');
}

