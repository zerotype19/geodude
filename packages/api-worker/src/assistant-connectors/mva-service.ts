/**
 * MVA (Multi-Vector Authority) Service - Phase Next
 * Calculates MVA scores and impression estimates for assistant visibility
 */

export interface MVAMetrics {
  day: string; // YYYY-MM-DD
  projectId: string;
  assistant: string;
  mentionsCount: number;
  uniqueUrls: number;
  mvaDaily: number; // 0-100
  impressionEstimate: number;
  competitorDomains: string[];
}

export interface MVACalculation {
  mentions: number;
  diversity: number;
  stability: number;
  depth: number;
  freshness: number;
  overall: number; // 0-100
}

export class MVAService {
  constructor(
    private db: D1Database,
    private kv: KVNamespace
  ) {}

  async calculateDailyMVA(
    projectId: string,
    assistant: string,
    day: string
  ): Promise<MVAMetrics> {
    // Get citations for the day
    const citations = await this.getCitationsForDay(projectId, assistant, day);
    
    // Calculate MVA components
    const mva = await this.calculateMVA(projectId, assistant, day);
    
    // Calculate impression estimate
    const impressionEstimate = await this.calculateImpressionEstimate(
      projectId,
      assistant,
      mva.overall
    );
    
    // Get competitor domains
    const competitorDomains = await this.getCompetitorDomains(projectId, day);
    
    const metrics: MVAMetrics = {
      day,
      projectId,
      assistant,
      mentionsCount: citations.length,
      uniqueUrls: new Set(citations.map(c => c.url)).size,
      mvaDaily: mva.overall,
      impressionEstimate,
      competitorDomains
    };
    
    // Store metrics
    await this.storeMVAMetrics(metrics);
    
    return metrics;
  }

  private async getCitationsForDay(
    projectId: string,
    assistant: string,
    day: string
  ): Promise<Array<{ url: string; occurred_at: string }>> {
    const result = await this.db.prepare(`
      SELECT source_url as url, occurred_at
      FROM ai_citations
      WHERE project_id = ? 
        AND occurred_at >= ? 
        AND occurred_at < ?
    `).bind(
      projectId,
      `${day} 00:00:00`,
      `${day} 23:59:59`
    ).all<{ url: string; occurred_at: string }>();
    
    return result.results;
  }

  private async calculateMVA(
    projectId: string,
    assistant: string,
    day: string
  ): Promise<MVACalculation> {
    // Mentions: count of citations per day
    const mentions = await this.getMentionsScore(projectId, assistant, day);
    
    // Diversity: assistants × intents
    const diversity = await this.getDiversityScore(projectId, assistant, day);
    
    // Stability: 4-week rolling presence ratio
    const stability = await this.getStabilityScore(projectId, assistant, day);
    
    // Depth: unique URLs cited / total URLs
    const depth = await this.getDepthScore(projectId, assistant, day);
    
    // Freshness: days since last citation
    const freshness = await this.getFreshnessScore(projectId, assistant, day);
    
    // Overall MVA (weighted average)
    const overall = (
      mentions * 0.25 +
      diversity * 0.20 +
      stability * 0.25 +
      depth * 0.15 +
      freshness * 0.15
    );
    
    return {
      mentions,
      diversity,
      stability,
      depth,
      freshness,
      overall: Math.round(overall * 100) / 100
    };
  }

  private async getMentionsScore(
    projectId: string,
    assistant: string,
    day: string
  ): Promise<number> {
    const result = await this.db.prepare(`
      SELECT COUNT(*) as count
      FROM ai_citations
      WHERE project_id = ? 
        AND occurred_at >= ? 
        AND occurred_at < ?
    `).bind(
      projectId,
      `${day} 00:00:00`,
      `${day} 23:59:59`
    ).first<{ count: number }>();
    
    const mentions = result?.count || 0;
    
    // Scale to 0-100 (exponential growth)
    if (mentions === 0) return 0;
    if (mentions <= 5) return mentions * 10; // 0-50
    if (mentions <= 20) return 50 + (mentions - 5) * 2; // 50-80
    return Math.min(100, 80 + (mentions - 20) * 0.5); // 80-100
  }

  private async getDiversityScore(
    projectId: string,
    assistant: string,
    day: string
  ): Promise<number> {
    // Get unique intents for the day
    const intentsResult = await this.db.prepare(`
      SELECT DISTINCT ap.intent_tag
      FROM assistant_prompts ap
      JOIN assistant_runs ar ON ap.run_id = ar.id
      WHERE ar.project_id = ? 
        AND ar.assistant = ?
        AND ar.run_started_at >= ? 
        AND ar.run_started_at < ?
        AND ap.intent_tag IS NOT NULL
    `).bind(
      projectId,
      assistant,
      `${day} 00:00:00`,
      `${day} 23:59:59`
    ).all<{ intent_tag: string }>();
    
    const uniqueIntents = intentsResult.results.length;
    
    // Scale to 0-100 (more intents = higher diversity)
    return Math.min(100, uniqueIntents * 20);
  }

  private async getStabilityScore(
    projectId: string,
    assistant: string,
    day: string
  ): Promise<number> {
    // Get citations for the last 28 days
    const startDate = new Date(day);
    startDate.setDate(startDate.getDate() - 28);
    const startDateStr = startDate.toISOString().split('T')[0];
    
    const result = await this.db.prepare(`
      SELECT DATE(occurred_at) as citation_day, COUNT(*) as count
      FROM ai_citations
      WHERE project_id = ? 
        AND occurred_at >= ? 
        AND occurred_at < ?
      GROUP BY DATE(occurred_at)
    `).bind(
      projectId,
      `${startDateStr} 00:00:00`,
      `${day} 23:59:59`
    ).all<{ citation_day: string; count: number }>();
    
    const daysWithCitations = result.results.length;
    const totalDays = 28;
    const stability = daysWithCitations / totalDays;
    
    return Math.round(stability * 100);
  }

  private async getDepthScore(
    projectId: string,
    assistant: string,
    day: string
  ): Promise<number> {
    // Get unique URLs vs total URLs for the day
    const uniqueResult = await this.db.prepare(`
      SELECT COUNT(DISTINCT source_url) as unique_count
      FROM ai_citations
      WHERE project_id = ? 
        AND occurred_at >= ? 
        AND occurred_at < ?
    `).bind(
      projectId,
      `${day} 00:00:00`,
      `${day} 23:59:59`
    ).first<{ unique_count: number }>();
    
    const totalResult = await this.db.prepare(`
      SELECT COUNT(*) as total_count
      FROM ai_citations
      WHERE project_id = ? 
        AND occurred_at >= ? 
        AND occurred_at < ?
    `).bind(
      projectId,
      `${day} 00:00:00`,
      `${day} 23:59:59`
    ).first<{ total_count: number }>();
    
    const uniqueUrls = uniqueResult?.unique_count || 0;
    const totalUrls = totalResult?.total_count || 0;
    
    if (totalUrls === 0) return 0;
    
    const depth = uniqueUrls / totalUrls;
    return Math.round(depth * 100);
  }

  private async getFreshnessScore(
    projectId: string,
    assistant: string,
    day: string
  ): Promise<number> {
    // Get days since last citation
    const result = await this.db.prepare(`
      SELECT MAX(occurred_at) as last_citation
      FROM ai_citations
      WHERE project_id = ?
    `).bind(projectId).first<{ last_citation: string }>();
    
    if (!result?.last_citation) return 0;
    
    const lastCitation = new Date(result.last_citation);
    const currentDate = new Date(day);
    const daysSince = Math.floor((currentDate.getTime() - lastCitation.getTime()) / (1000 * 60 * 60 * 24));
    
    // Scale to 0-100 (fresher = higher score)
    if (daysSince === 0) return 100;
    if (daysSince <= 7) return 100 - (daysSince * 10); // 100-30
    if (daysSince <= 30) return 30 - ((daysSince - 7) * 1); // 30-0
    return 0;
  }

  private async calculateImpressionEstimate(
    projectId: string,
    assistant: string,
    mvaScore: number
  ): Promise<number> {
    // Get weights from KV storage
    const weights = await this.getImpressionWeights(assistant);
    
    // Calculate impression estimate
    const baseImpressions = mvaScore * 100; // Base on MVA score
    const assistantWeight = weights.assistant || 1.0;
    const intentWeight = weights.intent || 1.0;
    const popularityWeight = weights.popularity || 1.0;
    
    return Math.round(baseImpressions * assistantWeight * intentWeight * popularityWeight);
  }

  private async getImpressionWeights(assistant: string): Promise<{
    assistant: number;
    intent: number;
    popularity: number;
  }> {
    const weights = await this.kv.get(`impression_weights:${assistant}`);
    if (weights) {
      return JSON.parse(weights);
    }
    
    // Default weights
    const defaultWeights = {
      assistant: 1.0,
      intent: 1.0,
      popularity: 1.0
    };
    
    await this.kv.put(`impression_weights:${assistant}`, JSON.stringify(defaultWeights));
    return defaultWeights;
  }

  private async getCompetitorDomains(projectId: string, day: string): Promise<string[]> {
    // Get top domains from citations (excluding own domain)
    const result = await this.db.prepare(`
      SELECT source_domain, COUNT(*) as count
      FROM ai_citations
      WHERE project_id = ? 
        AND occurred_at >= ? 
        AND occurred_at < ?
      GROUP BY source_domain
      ORDER BY count DESC
      LIMIT 10
    `).bind(
      projectId,
      `${day} 00:00:00`,
      `${day} 23:59:59`
    ).all<{ source_domain: string; count: number }>();
    
    return result.results.map(row => row.source_domain);
  }

  private async storeMVAMetrics(metrics: MVAMetrics): Promise<void> {
    await this.db.prepare(`
      INSERT OR REPLACE INTO ai_visibility_metrics 
      (day, project_id, assistant, mentions_count, unique_urls, mva_daily, impression_estimate, competitor_domains)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      metrics.day,
      metrics.projectId,
      metrics.assistant,
      metrics.mentionsCount,
      metrics.uniqueUrls,
      metrics.mvaDaily,
      metrics.impressionEstimate,
      JSON.stringify(metrics.competitorDomains)
    ).run();
  }
}
