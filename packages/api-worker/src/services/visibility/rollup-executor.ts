// Phase 5: Rollup Executor - Exact SQL for visibility scores
// Handles the core rollup logic with proper timezone and normalization

export interface Env {
  DB: D1Database;
}

export class RollupExecutor {
  constructor(private env: Env) {}

  async executeDailyRollup(day: string = new Date().toISOString().split('T')[0]): Promise<{
    scoresCreated: number;
    rankingsCreated: number;
    errors: string[];
  }> {
    // Normalize day parameter
    if (day === 'today') {
      day = new Date().toISOString().split('T')[0];
    }
    
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      throw new Error(`Invalid date format: ${day}. Expected YYYY-MM-DD`);
    }
    
    console.log(`[RollupExecutor] Starting daily rollup for ${day}`);
    const errors: string[] = [];
    let scoresCreated = 0;
    let rankingsCreated = 0;

    try {
      // 1. Execute visibility scores rollup
      scoresCreated = await this.rollupVisibilityScores(day);
      console.log(`[RollupExecutor] Created ${scoresCreated} visibility scores`);

      // 2. Execute weekly rankings rollup
      rankingsCreated = await this.rollupWeeklyRankings(day);
      console.log(`[RollupExecutor] Created ${rankingsCreated} weekly rankings`);

    } catch (error) {
      console.error('[RollupExecutor] Error during rollup:', error);
      errors.push(`Rollup error: ${error}`);
    }

    return { scoresCreated, rankingsCreated, errors };
  }

  private async rollupVisibilityScores(day: string): Promise<number> {
    // First, normalize domains in ai_citations if needed
    await this.normalizeDomains();

    const query = `
      INSERT OR REPLACE INTO ai_visibility_scores (
        id, day, assistant, domain, score_0_100, citations_count, 
        unique_domains_count, recency_score, drift_pct, created_at
      )
      WITH base AS (
        SELECT
          date(occurred_at) AS day,
          COALESCE(assistant, 'unknown') AS assistant,
          LOWER(REPLACE(REPLACE(source_domain, 'www.', ''), 'WWW.', '')) AS domain,
          COUNT(*) AS cits,
          COUNT(DISTINCT source_url) AS uniq_urls,
          COUNT(DISTINCT source_domain) AS uniq_domains
        FROM ai_citations
        WHERE date(occurred_at) = ?
          AND assistant IS NOT NULL
        GROUP BY 1, 2, 3
      ),
      norm AS (
        SELECT
          b.*,
          -- Normalize vs median per assistant to avoid runaway leaders
          (cits * 50.0) / NULLIF(
            (SELECT COALESCE(AVG(cits), 1) FROM base b2 WHERE b2.assistant = b.assistant), 0
          ) +
          (uniq_urls * 30.0) / NULLIF(
            (SELECT MAX(uniq_urls) FROM base WHERE assistant = b.assistant), 0
          ) +
          -- Recency bonus (more recent = higher score)
          CASE 
            WHEN b.day = date('now') THEN 20.0
            WHEN b.day = date('now', '-1 day') THEN 15.0
            WHEN b.day = date('now', '-2 days') THEN 10.0
            ELSE 5.0
          END AS raw_score
        FROM base b
      )
      SELECT
        'vis_' || unixepoch() || '_' || substr(hex(randomblob(4)), 1, 8) AS id,
        day, 
        assistant, 
        domain,
        CAST(MAX(MIN(100.0, MAX(0.0, raw_score))) AS REAL) AS score_0_100,
        cits AS citations_count,
        uniq_domains AS unique_domains_count,
        CASE 
          WHEN day = date('now') THEN 20.0
          WHEN day = date('now', '-1 day') THEN 15.0
          WHEN day = date('now', '-2 days') THEN 10.0
          ELSE 5.0
        END AS recency_score,
        0.0 AS drift_pct,
        datetime('now') AS created_at
      FROM norm
      GROUP BY day, assistant, domain
    `;

    const result = await this.env.DB.prepare(query).bind(day).run();
    return result.meta.changes || 0;
  }

  private async rollupWeeklyRankings(day: string): Promise<number> {
    // Get the week start for this day
    const weekStart = this.getWeekStart(day);
    
    const query = `
      INSERT OR REPLACE INTO ai_visibility_rankings (
        id, week_start, assistant, domain, domain_rank, mentions_count, 
        share_pct, previous_rank, rank_change, created_at
      )
      WITH w AS (
        SELECT
          ? AS week_start,
          assistant,
          LOWER(REPLACE(REPLACE(source_domain, 'www.', ''), 'WWW.', '')) AS domain,
          COUNT(*) AS mentions
        FROM ai_citations
        WHERE date(occurred_at) >= ?
          AND date(occurred_at) < date(?, '+7 days')
          AND assistant IS NOT NULL
        GROUP BY 2, 3
      ),
      t AS (
        SELECT week_start, assistant, SUM(mentions) AS total 
        FROM w 
        GROUP BY 1, 2
      ),
      r AS (
        SELECT
          w.week_start, w.assistant, w.domain, w.mentions,
          (w.mentions * 100.0) / NULLIF(t.total, 0) AS share_pct,
          ROW_NUMBER() OVER (PARTITION BY w.week_start, w.assistant ORDER BY w.mentions DESC) AS rk
        FROM w 
        JOIN t USING(week_start, assistant)
      )
      SELECT
        'rank_' || unixepoch() || '_' || substr(hex(randomblob(4)), 1, 8) AS id,
        week_start, assistant, domain, rk AS domain_rank, mentions AS mentions_count, 
        share_pct, NULL AS previous_rank, 0 AS rank_change, datetime('now')
      FROM r
      WHERE rk <= 100
    `;

    const result = await this.env.DB.prepare(query).bind(weekStart, weekStart, weekStart).run();
    return result.meta.changes || 0;
  }

  private async normalizeDomains(): Promise<void> {
    // Normalize domains in ai_citations to ensure consistency
    const query = `
      UPDATE ai_citations 
      SET source_domain = LOWER(REPLACE(source_domain, 'www.', ''))
      WHERE source_domain LIKE 'www.%' OR source_domain LIKE 'WWW.%'
    `;
    
    await this.env.DB.prepare(query).run();
  }

  private getWeekStart(date: string): string {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const weekStart = new Date(d.setDate(diff));
    return weekStart.toISOString().split('T')[0];
  }

  async getRollupStatus(day: string): Promise<{
    scoresCount: number;
    rankingsCount: number;
    topDomains: any[];
    recentErrors: any[];
  }> {
    // Get scores count for the day
    const scoresResult = await this.env.DB.prepare(`
      SELECT COUNT(*) as count FROM ai_visibility_scores WHERE day = ?
    `).bind(day).first();

    // Get rankings count for the week
    const weekStart = this.getWeekStart(day);
    const rankingsResult = await this.env.DB.prepare(`
      SELECT COUNT(*) as count FROM ai_visibility_rankings WHERE week_start = ?
    `).bind(weekStart).first();

    // Get top domains for the day
    const topDomainsResult = await this.env.DB.prepare(`
      SELECT domain, assistant, score_0_100, citations_count
      FROM ai_visibility_scores 
      WHERE day = ?
      ORDER BY score_0_100 DESC 
      LIMIT 10
    `).bind(day).all();

    // Get recent errors (if any)
    const errorsResult = await this.env.DB.prepare(`
      SELECT type, message, created_at
      FROM ai_alerts 
      WHERE day >= date('now', '-1 day')
      ORDER BY created_at DESC 
      LIMIT 5
    `).all();

    return {
      scoresCount: (scoresResult as any)?.count || 0,
      rankingsCount: (rankingsResult as any)?.count || 0,
      topDomains: topDomainsResult.results || [],
      recentErrors: errorsResult.results || []
    };
  }
}
