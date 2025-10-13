// Phase 5: Visibility Scoring Service
// Calculates 0-100 visibility scores for domains across AI assistants

export interface VisibilityScoreResult {
  score: number;
  citationsCount: number;
  uniqueDomainsCount: number;
  recencyScore: number;
  driftPct: number;
}

export interface Env {
  DB: D1Database;
}

export class VisibilityScorer {
  constructor(private env: Env) {}

  async calculateVisibilityScore(
    domain: string, 
    assistant: string, 
    day: string
  ): Promise<VisibilityScoreResult> {
    console.log(`[VisibilityScorer] Calculating score for ${domain} (${assistant}) on ${day}`);
    
    // Get citations for domain/assistant/day
    const citations = await this.getCitations(domain, assistant, day);
    
    // Get 30-day median for normalization
    const medianCitations = await this.getMedianCitations(domain, assistant, 30);
    
    // Calculate components
    const citationScore = Math.min(50, (citations.length / Math.max(medianCitations, 1)) * 50);
    const diversityScore = await this.calculateDiversityScore(domain, assistant, day) * 30;
    const recencyScore = await this.calculateRecencyScore(domain, assistant, day) * 20;
    
    const totalScore = Math.min(100, citationScore + diversityScore + recencyScore);
    
    // Calculate drift from previous week
    const driftPct = await this.calculateDrift(domain, assistant, day);
    
    const result = {
      score: Math.round(totalScore * 100) / 100,
      citationsCount: citations.length,
      uniqueDomainsCount: await this.getUniqueDomainsCount(domain, assistant, day),
      recencyScore: Math.round(recencyScore * 100) / 100,
      driftPct: Math.round(driftPct * 100) / 100
    };
    
    console.log(`[VisibilityScorer] Score calculated:`, result);
    return result;
  }
  
  private async getCitations(domain: string, assistant: string, day: string) {
    const query = `
      SELECT * FROM ai_citations 
      WHERE source_domain = ? 
        AND assistant = ? 
        AND DATE(occurred_at) = ?
      ORDER BY occurred_at DESC
    `;
    
    const result = await this.env.DB.prepare(query)
      .bind(domain, assistant, day)
      .all();
    
    return result.results || [];
  }
  
  private async getMedianCitations(domain: string, assistant: string, days: number) {
    const query = `
      SELECT COUNT(*) as count
      FROM ai_citations 
      WHERE source_domain = ? 
        AND assistant = ? 
        AND occurred_at >= datetime('now', '-${days} days')
      GROUP BY DATE(occurred_at)
      ORDER BY count
    `;
    
    const result = await this.env.DB.prepare(query)
      .bind(domain, assistant)
      .all();
    
    const counts = (result.results || []).map((r: any) => r.count);
    
    if (counts.length === 0) return 1;
    
    // Calculate median
    counts.sort((a, b) => a - b);
    const mid = Math.floor(counts.length / 2);
    return counts.length % 2 === 0 
      ? (counts[mid - 1] + counts[mid]) / 2 
      : counts[mid];
  }
  
  private async calculateDiversityScore(domain: string, assistant: string, day: string) {
    // Get total unique domains cited by this assistant today
    const totalDomainsQuery = `
      SELECT COUNT(DISTINCT source_domain) as total_domains
      FROM ai_citations 
      WHERE assistant = ? 
        AND DATE(occurred_at) = ?
    `;
    
    const totalResult = await this.env.DB.prepare(totalDomainsQuery)
      .bind(assistant, day)
      .first();
    
    const totalDomains = (totalResult as any)?.total_domains || 1;
    
    // This domain's citations as percentage of total
    const domainCitations = await this.getCitations(domain, assistant, day);
    const diversityRatio = domainCitations.length / Math.max(totalDomains, 1);
    
    // Normalize to 0-1 scale
    return Math.min(1, diversityRatio * 10); // Scale factor for diversity
  }
  
  private async calculateRecencyScore(domain: string, assistant: string, day: string) {
    const citations = await this.getCitations(domain, assistant, day);
    
    if (citations.length === 0) return 0;
    
    // Calculate average recency (more recent = higher score)
    const now = new Date();
    let totalRecency = 0;
    
    for (const citation of citations) {
      const citationTime = new Date((citation as any).occurred_at);
      const hoursAgo = (now.getTime() - citationTime.getTime()) / (1000 * 60 * 60);
      
      // Recent citations get higher scores (within 24h = 1.0, older = lower)
      const recency = Math.max(0, 1 - (hoursAgo / 24));
      totalRecency += recency;
    }
    
    return totalRecency / citations.length;
  }
  
  private async getUniqueDomainsCount(domain: string, assistant: string, day: string) {
    // For this specific domain, count how many unique domains it was cited alongside
    const query = `
      SELECT COUNT(DISTINCT source_domain) as unique_domains
      FROM ai_citations 
      WHERE assistant = ? 
        AND DATE(occurred_at) = ?
        AND source_domain != ?
    `;
    
    const result = await this.env.DB.prepare(query)
      .bind(assistant, day, domain)
      .first();
    
    return (result as any)?.unique_domains || 0;
  }
  
  private async calculateDrift(domain: string, assistant: string, day: string) {
    // Calculate week-over-week drift percentage
    const currentWeekStart = this.getWeekStart(day);
    const previousWeekStart = this.getWeekStart(this.getPreviousWeek(day));
    
    // Get current week citations
    const currentCitations = await this.getCitationsForWeek(domain, assistant, currentWeekStart);
    
    // Get previous week citations
    const previousCitations = await this.getCitationsForWeek(domain, assistant, previousWeekStart);
    
    if (previousCitations.length === 0) {
      return currentCitations.length > 0 ? 100 : 0; // 100% increase if no previous data
    }
    
    const driftPct = ((currentCitations.length - previousCitations.length) / previousCitations.length) * 100;
    return driftPct;
  }
  
  private async getCitationsForWeek(domain: string, assistant: string, weekStart: string) {
    const query = `
      SELECT * FROM ai_citations 
      WHERE source_domain = ? 
        AND assistant = ? 
        AND DATE(occurred_at) >= ?
        AND DATE(occurred_at) < date(?, '+7 days')
    `;
    
    const result = await this.env.DB.prepare(query)
      .bind(domain, assistant, weekStart)
      .all();
    
    return result.results || [];
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
  
  async saveVisibilityScore(
    domain: string, 
    assistant: string, 
    day: string, 
    score: VisibilityScoreResult
  ): Promise<void> {
    const id = `vis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const query = `
      INSERT OR REPLACE INTO ai_visibility_scores 
      (id, day, assistant, domain, score_0_100, citations_count, unique_domains_count, recency_score, drift_pct, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.env.DB.prepare(query)
      .bind(
        id,
        day,
        assistant,
        domain,
        score.score,
        score.citationsCount,
        score.uniqueDomainsCount,
        score.recencyScore,
        score.driftPct,
        new Date().toISOString()
      )
      .run();
    
    console.log(`[VisibilityScorer] Saved score for ${domain} (${assistant}): ${score.score}`);
  }
}
