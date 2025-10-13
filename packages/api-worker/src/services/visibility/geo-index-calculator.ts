// Phase 5: GEO Index Calculator
// Calculates AI findability scores for individual pages/URLs

export interface GeoIndexResult {
  geoIndexScore: number;
  assistantsSeen: number;
  backlinksAi: number;
  recencyScore: number;
  citationsCount: number;
  contentQualityScore: number;
}

export interface Env {
  DB: D1Database;
}

export class GeoIndexCalculator {
  constructor(private env: Env) {}

  async calculateGeoIndex(url: string): Promise<GeoIndexResult> {
    console.log(`[GeoIndexCalculator] Calculating GEO index for ${url}`);
    
    // Get citations for this URL across all assistants
    const citations = await this.getUrlCitations(url);
    
    // Calculate components
    const totalAiAnswers = await this.getTotalAiAnswers();
    const aiVisibilityScore = Math.min(60, (citations.length / Math.max(totalAiAnswers, 1)) * 60);
    
    const assistantsSeen = await this.getAssistantsSeen(url);
    const diversityScore = Math.min(25, (assistantsSeen / 3) * 25); // 3 assistants max
    
    const freshnessScore = await this.calculateFreshnessScore(url) * 15;
    
    const geoIndexScore = Math.min(100, aiVisibilityScore + diversityScore + freshnessScore);
    
    const result = {
      geoIndexScore: Math.round(geoIndexScore * 100) / 100,
      assistantsSeen,
      backlinksAi: citations.length,
      recencyScore: await this.calculateRecencyScore(url),
      citationsCount: citations.length,
      contentQualityScore: await this.calculateContentQualityScore(url)
    };
    
    console.log(`[GeoIndexCalculator] GEO index calculated:`, result);
    return result;
  }
  
  private async getUrlCitations(url: string) {
    const query = `
      SELECT * FROM ai_citations 
      WHERE source_url = ?
      ORDER BY occurred_at DESC
    `;
    
    const result = await this.env.DB.prepare(query)
      .bind(url)
      .all();
    
    return result.results || [];
  }
  
  private async getTotalAiAnswers() {
    // Get total number of AI answers in the system (from assistant_outputs)
    const query = `
      SELECT COUNT(*) as total
      FROM assistant_outputs
      WHERE parsed_at >= datetime('now', '-30 days')
    `;
    
    const result = await this.env.DB.prepare(query).first();
    return (result as any)?.total || 1;
  }
  
  private async calculateFreshnessScore(url: string) {
    const citations = await this.getUrlCitations(url);
    
    if (citations.length === 0) return 0;
    
    // Find the most recent citation
    const mostRecent = citations.reduce((latest, current) => {
      const latestTime = new Date((latest as any).occurred_at);
      const currentTime = new Date((current as any).occurred_at);
      return currentTime > latestTime ? current : latest;
    });
    
    const citationTime = new Date((mostRecent as any).occurred_at);
    const now = new Date();
    const daysAgo = (now.getTime() - citationTime.getTime()) / (1000 * 60 * 60 * 24);
    
    // Fresh citations (≤7 days) get full score, older get reduced score
    return daysAgo <= 7 ? 1.0 : Math.max(0, 1 - (daysAgo - 7) / 30);
  }
  
  private async getAssistantsSeen(url: string) {
    const query = `
      SELECT COUNT(DISTINCT assistant) as assistants_seen
      FROM ai_citations 
      WHERE source_url = ?
        AND assistant IS NOT NULL
    `;
    
    const result = await this.env.DB.prepare(query)
      .bind(url)
      .first();
    
    return (result as any)?.assistants_seen || 0;
  }
  
  private async calculateRecencyScore(url: string) {
    const citations = await this.getUrlCitations(url);
    
    if (citations.length === 0) return 0;
    
    // Calculate average recency across all citations for this URL
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
  
  private async calculateContentQualityScore(url: string) {
    // This is a placeholder for content quality assessment
    // In a real implementation, this could analyze:
    // - Content length and structure
    // - Keyword density and relevance
    // - Schema markup presence
    // - Page speed and mobile-friendliness
    
    const citations = await this.getUrlCitations(url);
    
    if (citations.length === 0) return 0;
    
    // Simple heuristic: more citations = higher quality
    // More sophisticated analysis could be added here
    const citationCount = citations.length;
    const qualityScore = Math.min(1.0, citationCount / 10); // Normalize to 0-1
    
    return qualityScore;
  }
  
  async saveGeoIndex(url: string, result: GeoIndexResult): Promise<void> {
    const id = `geo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const domain = this.extractDomain(url);
    
    const query = `
      INSERT INTO ai_geo_index 
      (id, url, domain, assistants_seen, backlinks_ai, recency_score, geo_index_score, citations_count, content_quality_score, measured_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.env.DB.prepare(query)
      .bind(
        id,
        url,
        domain,
        result.assistantsSeen,
        result.backlinksAi,
        result.recencyScore,
        result.geoIndexScore,
        result.citationsCount,
        result.contentQualityScore,
        new Date().toISOString()
      )
      .run();
    
    console.log(`[GeoIndexCalculator] Saved GEO index for ${url}: ${result.geoIndexScore}`);
  }
  
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, '').toLowerCase();
    } catch (error) {
      console.warn(`[GeoIndexCalculator] Invalid URL for domain extraction: ${url}`);
      return url.split('/')[2] || url;
    }
  }
}
