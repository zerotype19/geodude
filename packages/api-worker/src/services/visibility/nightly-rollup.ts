// Phase 5: Nightly Rollup Service
// Processes daily citations and generates visibility scores, rankings, and alerts

export interface Env {
  DB: D1Database;
  HEURISTICS: KVNamespace;
}

export class NightlyRollupService {
  constructor(private env: Env) {}

  async runNightlyRollup(): Promise<void> {
    console.log('[NightlyRollup] Starting nightly visibility rollup...');
    
    const today = new Date().toISOString().split('T')[0];
    
    try {
      // Use the new RollupExecutor for consistent logic
      const { RollupExecutor } = await import('./rollup-executor');
      const executor = new RollupExecutor(this.env);
      
      // Execute the rollup
      const result = await executor.executeDailyRollup(today);
      console.log(`[NightlyRollup] Created ${result.scoresCreated} scores and ${result.rankingsCreated} rankings`);
      
      if (result.errors.length > 0) {
        console.warn('[NightlyRollup] Rollup completed with errors:', result.errors);
      }
      
      // Generate alerts
      await this.generateAlerts(today);
      
      console.log('[NightlyRollup] Nightly rollup completed successfully');
      
    } catch (error) {
      console.error('[NightlyRollup] Error during rollup:', error);
      throw error;
    }
  }
  
  private async processAssistant(assistant: string, day: string) {
    console.log(`[NightlyRollup] Processing ${assistant} for ${day}`);
    
    // Get all domains that had citations for this assistant today
    const domains = await this.getDomainsWithCitations(assistant, day);
    
    console.log(`[NightlyRollup] Found ${domains.length} domains with citations for ${assistant}`);
    
    // Import VisibilityScorer dynamically to avoid circular imports
    const { VisibilityScorer } = await import('./visibility-scorer');
    const scorer = new VisibilityScorer(this.env);
    
    for (const domain of domains) {
      try {
        const score = await scorer.calculateVisibilityScore(domain, assistant, day);
        await scorer.saveVisibilityScore(domain, assistant, day, score);
      } catch (error) {
        console.error(`[NightlyRollup] Error processing domain ${domain} for ${assistant}:`, error);
        // Continue with other domains
      }
    }
  }
  
  private async getDomainsWithCitations(assistant: string, day: string): Promise<string[]> {
    const query = `
      SELECT DISTINCT source_domain
      FROM ai_citations 
      WHERE assistant = ? 
        AND DATE(occurred_at) = ?
        AND source_domain IS NOT NULL
      ORDER BY source_domain
    `;
    
    const result = await this.env.DB.prepare(query)
      .bind(assistant, day)
      .all();
    
    return (result.results || []).map((row: any) => row.source_domain);
  }
  
  private async calculateRankings(day: string) {
    console.log(`[NightlyRollup] Calculating weekly rankings for ${day}`);
    
    const weekStart = this.getWeekStart(day);
    const assistants = ['perplexity', 'chatgpt_search', 'claude'];
    
    for (const assistant of assistants) {
      const rankings = await this.calculateAssistantRankings(assistant, weekStart);
      await this.saveRankings(assistant, weekStart, rankings);
    }
  }
  
  private async calculateAssistantRankings(assistant: string, weekStart: string) {
    // Get all domains with citations for this assistant this week
    const query = `
      SELECT 
        source_domain,
        COUNT(*) as mentions_count,
        COUNT(DISTINCT DATE(occurred_at)) as active_days
      FROM ai_citations 
      WHERE assistant = ? 
        AND DATE(occurred_at) >= ?
        AND DATE(occurred_at) < date(?, '+7 days')
        AND source_domain IS NOT NULL
      GROUP BY source_domain
      ORDER BY mentions_count DESC, active_days DESC
    `;
    
    const result = await this.env.DB.prepare(query)
      .bind(assistant, weekStart)
      .all();
    
    const domains = result.results || [];
    const totalMentions = domains.reduce((sum: number, row: any) => sum + row.mentions_count, 0);
    
    return domains.map((row: any, index: number) => ({
      domain: row.source_domain,
      rank: index + 1,
      mentionsCount: row.mentions_count,
      sharePct: totalMentions > 0 ? (row.mentions_count / totalMentions) * 100 : 0,
      activeDays: row.active_days
    }));
  }
  
  private async saveRankings(assistant: string, weekStart: string, rankings: any[]) {
    console.log(`[NightlyRollup] Saving ${rankings.length} rankings for ${assistant} (week ${weekStart})`);
    
    for (const ranking of rankings) {
      const id = `rank_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Get previous week's rank for comparison
      const previousRank = await this.getPreviousRank(assistant, weekStart, ranking.domain);
      const rankChange = previousRank ? previousRank - ranking.rank : 0;
      
      const query = `
        INSERT OR REPLACE INTO ai_visibility_rankings 
        (id, week_start, assistant, domain, domain_rank, mentions_count, share_pct, previous_rank, rank_change, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      await this.env.DB.prepare(query)
        .bind(
          id,
          weekStart,
          assistant,
          ranking.domain,
          ranking.rank,
          ranking.mentionsCount,
          ranking.sharePct,
          previousRank,
          rankChange,
          new Date().toISOString()
        )
        .run();
    }
  }
  
  private async getPreviousRank(assistant: string, weekStart: string, domain: string): Promise<number | null> {
    const previousWeekStart = this.getPreviousWeek(weekStart);
    
    const query = `
      SELECT domain_rank
      FROM ai_visibility_rankings 
      WHERE assistant = ? 
        AND week_start = ?
        AND domain = ?
    `;
    
    const result = await this.env.DB.prepare(query)
      .bind(assistant, previousWeekStart, domain)
      .first();
    
    return (result as any)?.domain_rank || null;
  }
  
  private async generateAlerts(day: string) {
    console.log(`[NightlyRollup] Generating alerts for ${day}`);
    
    await this.checkDriftAlerts(day);
    await this.checkErrorAlerts(day);
    await this.checkThresholdAlerts(day);
  }
  
  private async checkDriftAlerts(day: string) {
    // Check for significant drift in visibility scores
    const query = `
      SELECT domain, assistant, drift_pct
      FROM ai_visibility_scores 
      WHERE day = ?
        AND ABS(drift_pct) > 50
      ORDER BY ABS(drift_pct) DESC
    `;
    
    const result = await this.env.DB.prepare(query)
      .bind(day)
      .all();
    
    const significantDrifts = result.results || [];
    
    for (const drift of significantDrifts) {
      const severity = Math.abs(drift.drift_pct) > 100 ? 'high' : 'medium';
      const message = `${drift.domain} visibility ${drift.drift_pct > 0 ? 'increased' : 'decreased'} by ${Math.abs(drift.drift_pct).toFixed(1)}% for ${drift.assistant}`;
      
      await this.createAlert(day, 'drift', message, severity, drift.domain, drift.assistant);
    }
  }
  
  private async checkErrorAlerts(day: string) {
    // Check for high error rates in assistant runs
    const query = `
      SELECT assistant, 
             COUNT(*) as total_runs,
             SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_runs
      FROM assistant_runs 
      WHERE DATE(created_at) = ?
      GROUP BY assistant
      HAVING (error_runs * 100.0 / total_runs) > 10
    `;
    
    const result = await this.env.DB.prepare(query)
      .bind(day)
      .all();
    
    const highErrorRates = result.results || [];
    
    for (const error of highErrorRates) {
      const errorRate = (error.error_runs / error.total_runs) * 100;
      const message = `${error.assistant} has ${errorRate.toFixed(1)}% error rate (${error.error_runs}/${error.total_runs} runs failed)`;
      
      await this.createAlert(day, 'error', message, 'high', null, error.assistant);
    }
  }
  
  private async checkThresholdAlerts(day: string) {
    // Check for domains with very low or very high visibility scores
    const query = `
      SELECT domain, assistant, score_0_100
      FROM ai_visibility_scores 
      WHERE day = ?
        AND (score_0_100 < 5 OR score_0_100 > 95)
      ORDER BY score_0_100
    `;
    
    const result = await this.env.DB.prepare(query)
      .bind(day)
      .all();
    
    const thresholdBreaches = result.results || [];
    
    for (const breach of thresholdBreaches) {
      const severity = breach.score_0_100 < 5 ? 'low' : 'medium';
      const message = `${breach.domain} has ${breach.score_0_100} visibility score for ${breach.assistant}`;
      
      await this.createAlert(day, 'threshold', message, severity, breach.domain, breach.assistant);
    }
  }
  
  private async createAlert(
    day: string, 
    type: string, 
    message: string, 
    severity: string, 
    domain: string | null, 
    assistant: string | null
  ) {
    const id = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const query = `
      INSERT INTO ai_alerts 
      (id, day, type, message, severity, domain, assistant, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.env.DB.prepare(query)
      .bind(
        id,
        day,
        type,
        message,
        severity,
        domain,
        assistant,
        new Date().toISOString()
      )
      .run();
    
    console.log(`[NightlyRollup] Created ${severity} alert: ${message}`);
  }
  
  private getWeekStart(date: string): string {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const weekStart = new Date(d.setDate(diff));
    return weekStart.toISOString().split('T')[0];
  }
  
  private getPreviousWeek(date: string): string {
    const d = new Date(date);
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  }
}
