/**
 * TypeScript types for Executive Summary Report
 */

export interface ReportData {
  audit: AuditInfo;
  scores: ScoreBreakdown;
  categories: CategoryDetail[];
  priorityFixes: PriorityFix[];
  citations: CitationAnalysis;
  siteDiagnostics: SiteDiagnostic[];
  topPages: PagePerformance[];
  quickWins: PagePerformance[];
}

export interface SiteDiagnostic {
  id: string;
  name: string;
  score: number;
  status: 'ok' | 'warn' | 'fail';
  impact_level: string;
  description: string;
}

export interface AuditInfo {
  id: string;
  root_url: string;
  domain: string;
  started_at: string;
  finished_at: string;
  status: string;
  pages_analyzed: number;
  composite_score: number;
}

export interface ScoreBreakdown {
  overall: number;
  page_score: number;
  site_score: number;
  percentile?: number;
}

export interface CategoryDetail {
  category: string;
  display_name: string;
  score: number;
  max_score: number;
  percentage: number;
  checks_passing: number;
  checks_total: number;
  impact_level: 'high' | 'medium' | 'low';
  strengths: string[];
  opportunities: string[];
  affected_pages: number;
}

export interface PriorityFix {
  id: string;
  name: string;
  category: string;
  severity: 'high' | 'medium' | 'low';
  score: number;
  weight: number;
  impact_description: string;
  why_it_matters: string;
  how_to_fix: string;
  affected_pages: Array<{
    url: string;
    title?: string;
    current_score?: number;
  }>;
  expected_impact: string;
  effort_estimate: string;
}

export interface CitationAnalysis {
  overall_rate: number;
  total_queries: number;
  cited_queries: number;
  by_source: Array<{
    source: string;
    rate: number;
    total: number;
    cited: number;
  }>;
  top_cited_pages: Array<{
    url: string;
    title?: string;
    citation_count: number;
    top_queries: string[];
  }>;
  successful_citations: Array<{
    query: string;
    source: string;
    cited_url: string;
    answer_excerpt?: string;
  }>;
  missed_opportunities: Array<{
    query: string;
    source: string;
    competitor_cited?: string;
    reason: string;
  }>;
}

export interface PagePerformance {
  url: string;
  title?: string;
  score: number;
  citation_count: number;
  strengths: string[];
  issues: string[];
  quick_win?: {
    fix: string;
    impact: string;
    effort: string;
  };
}

