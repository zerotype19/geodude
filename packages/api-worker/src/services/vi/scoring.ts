/**
 * Visibility Intelligence Scoring Service
 * Computes 0-100 visibility scores for domains across AI assistants
 */

export interface VisibilityScore {
  score: number;           // 0-100 overall score
  coverage: number;        // percentage of intents with audited domain citations
  citations_count: number; // total citations found
  unique_domains_count: number; // unique domains cited alongside audited domain
  recency_score: number;   // 0-1 recency component
  competitor_penalty: number; // penalty for competitor citations
}

export interface CitationResult {
  ref_url: string;
  ref_domain: string;
  title?: string;
  snippet?: string;
  rank?: number;
  is_audited_domain: boolean;
}

export interface Env {
  DB: D1Database;
}

export class VisibilityScorer {
  constructor(private env: Env) {}

  /**
   * Calculate visibility score for a specific intent and source
   */
  calculateIntentScore(
    citations: CitationResult[],
    auditedDomain: string,
    competitors: string[] = []
  ): number {
    if (citations.length === 0) return 0;

    let base = 0;
    
    // +70 if audited domain cited
    const auditedCitations = citations.filter(c => c.is_audited_domain);
    if (auditedCitations.length > 0) {
      base += 70;
      
      // +20 if ranked top-3, else +10 if top-10
      const topRanked = auditedCitations.filter(c => c.rank && c.rank <= 3);
      if (topRanked.length > 0) {
        base += 20;
      } else {
        const top10Ranked = auditedCitations.filter(c => c.rank && c.rank <= 10);
        if (top10Ranked.length > 0) {
          base += 10;
        }
      }
      
      // +5 bonus if multiple audited URLs cited
      if (auditedCitations.length > 1) {
        base += 5;
      }
    }
    
    // Competitor penalty: -5 per competitor cited (max -10)
    const competitorCitations = citations.filter(c => 
      competitors.some(comp => c.ref_domain.includes(comp))
    );
    const competitorPenalty = Math.min(10, competitorCitations.length * 5);
    base -= competitorPenalty;
    
    return Math.max(0, Math.min(100, base));
  }

  /**
   * Calculate overall visibility score for a run
   */
  async calculateOverallScore(
    runId: string,
    domain: string,
    competitors: string[] = []
  ): Promise<VisibilityScore> {
    try {
      // Get all results for this run
      const results = await this.env.DB.prepare(`
        SELECT vr.*, vc.ref_url, vc.ref_domain, vc.title, vc.snippet, vc.rank, vc.is_audited_domain
        FROM visibility_results vr
        LEFT JOIN visibility_citations vc ON vr.id = vc.result_id
        WHERE vr.run_id = ?
      `).bind(runId).all();

      if (results.results.length === 0) {
        return {
          score: 0,
          coverage: 0,
          citations_count: 0,
          unique_domains_count: 0,
          recency_score: 0,
          competitor_penalty: 0
        };
      }

      // Group citations by result
      const resultMap = new Map<string, CitationResult[]>();
      results.results.forEach((row: any) => {
        if (!row.ref_url) return; // Skip results without citations
        
        if (!resultMap.has(row.id)) {
          resultMap.set(row.id, []);
        }
        
        resultMap.get(row.id)!.push({
          ref_url: row.ref_url,
          ref_domain: row.ref_domain,
          title: row.title,
          snippet: row.snippet,
          rank: row.rank,
          is_audited_domain: Boolean(row.is_audited_domain)
        });
      });

      // Calculate scores per intent
      const intentScores: number[] = [];
      const intentWeights: number[] = [];
      let totalCitations = 0;
      let auditedCitations = 0;
      const uniqueDomains = new Set<string>();

      for (const [resultId, citations] of resultMap) {
        const result = results.results.find((r: any) => r.id === resultId);
        if (!result) continue;

        totalCitations += citations.length;
        citations.forEach(c => {
          uniqueDomains.add(c.ref_domain);
          if (c.is_audited_domain) auditedCitations++;
        });

        const intentScore = this.calculateIntentScore(citations, domain, competitors);
        intentScores.push(intentScore);
        
        // Get weight from intent
        const intentWeight = await this.getIntentWeight(result.intent_id);
        intentWeights.push(intentWeight);
      }

      // Calculate weighted average
      let weightedSum = 0;
      let totalWeight = 0;
      for (let i = 0; i < intentScores.length; i++) {
        weightedSum += intentScores[i] * intentWeights[i];
        totalWeight += intentWeights[i];
      }

      const overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
      const coverage = intentScores.length > 0 ? 
        intentScores.filter(score => score > 0).length / intentScores.length : 0;
      
      // Calculate recency score (simplified)
      const recencyScore = await this.calculateRecencyScore(runId);
      
      return {
        score: Math.round(overallScore * 100) / 100,
        coverage: Math.round(coverage * 100) / 100,
        citations_count: totalCitations,
        unique_domains_count: uniqueDomains.size,
        recency_score: Math.round(recencyScore * 100) / 100,
        competitor_penalty: 0 // Already factored into individual scores
      };
    } catch (error) {
      console.error('[VisibilityScorer] Error calculating overall score:', error);
      return {
        score: 0,
        coverage: 0,
        citations_count: 0,
        unique_domains_count: 0,
        recency_score: 0,
        competitor_penalty: 0
      };
    }
  }

  /**
   * Save visibility scores to database
   */
  async saveScores(runId: string, scores: Record<string, VisibilityScore>): Promise<void> {
    try {
      for (const [source, score] of Object.entries(scores)) {
        await this.env.DB.prepare(`
          UPDATE visibility_results 
          SET visibility_score = ?
          WHERE run_id = ? AND source = ?
        `).bind(score.score, runId, source).run();
      }

      // Update run summary
      const overallScore = Object.values(scores).reduce((sum, s) => sum + s.score, 0) / Object.keys(scores).length;
      await this.env.DB.prepare(`
        UPDATE visibility_runs 
        SET finished_at = ?, status = 'complete'
        WHERE id = ?
      `).bind(new Date().toISOString(), runId).run();

      console.log(`[VisibilityScorer] Saved scores for run ${runId}: overall=${overallScore.toFixed(2)}`);
    } catch (error) {
      console.error('[VisibilityScorer] Error saving scores:', error);
      throw error;
    }
  }

  /**
   * Get intent weight from database
   */
  private async getIntentWeight(intentId: string): Promise<number> {
    try {
      const result = await this.env.DB.prepare(`
        SELECT weight FROM visibility_intents WHERE id = ?
      `).bind(intentId).first();

      return (result as any)?.weight || 1.0;
    } catch (error) {
      console.error('[VisibilityScorer] Error getting intent weight:', error);
      return 1.0;
    }
  }

  /**
   * Calculate recency score (0-1)
   */
  private async calculateRecencyScore(runId: string): Promise<number> {
    try {
      const run = await this.env.DB.prepare(`
        SELECT started_at FROM visibility_runs WHERE id = ?
      `).bind(runId).first();

      if (!run) return 0;

      const startedAt = new Date((run as any).started_at);
      const now = new Date();
      const hoursAgo = (now.getTime() - startedAt.getTime()) / (1000 * 60 * 60);

      // Recent runs get higher scores (within 24h = 1.0, older = lower)
      return Math.max(0, 1 - (hoursAgo / 24));
    } catch (error) {
      console.error('[VisibilityScorer] Error calculating recency:', error);
      return 0;
    }
  }

  /**
   * Get competitor domains from project settings
   */
  async getCompetitors(projectId: string): Promise<string[]> {
    try {
      const result = await this.env.DB.prepare(`
        SELECT competitors FROM projects WHERE id = ?
      `).bind(projectId).first();

      const competitors = (result as any)?.competitors;
      if (!competitors) return [];

      try {
        return JSON.parse(competitors);
      } catch {
        return [];
      }
    } catch (error) {
      console.error('[VisibilityScorer] Error getting competitors:', error);
      return [];
    }
  }

  /**
   * Calculate coverage by source
   */
  async getSourceCoverage(runId: string): Promise<Record<string, number>> {
    try {
      const results = await this.env.DB.prepare(`
        SELECT source, 
               COUNT(*) as total_intents,
               SUM(CASE WHEN visibility_score > 0 THEN 1 ELSE 0 END) as covered_intents
        FROM visibility_results 
        WHERE run_id = ?
        GROUP BY source
      `).bind(runId).all();

      const coverage: Record<string, number> = {};
      results.results.forEach((row: any) => {
        coverage[row.source] = row.total_intents > 0 ? 
          row.covered_intents / row.total_intents : 0;
      });

      return coverage;
    } catch (error) {
      console.error('[VisibilityScorer] Error getting source coverage:', error);
      return {};
    }
  }
}
