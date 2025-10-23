export type Scope = "page" | "site";
export type CheckType = "html_dom" | "http" | "aggregate" | "llm";
export type Impact = "High" | "Medium" | "Low";

export interface CriterionRow {
  id: string;
  label: string;
  scope: Scope;
  check_type: CheckType;
  preview: 0 | 1;
  enabled: 0 | 1;
  weight: number;
  impact_level: Impact;
  pass_threshold: number;
  warn_threshold: number;
  display_order?: number | null;
}

export interface PageContext {
  pageId: string;
  url: string;
  html_rendered?: string | null;
  html_static?: string | null;
  site: { domain: string; homepageUrl: string; targetLocale?: "en" | "en-US" };
}

export interface SiteContext {
  auditId: string;
  domain: string;
  pages: Array<{
    id: string;
    url: string;
    checks?: CheckResult[];
    html_rendered?: string | null;
    html_static?: string | null;
  }>;
}

export type Status = "ok" | "warn" | "fail" | "not_applicable" | "error";

export interface CheckResult {
  id: string; // matches scoring_criteria.id
  score: number; // 0–100
  status: Status;
  details: Record<string, any>;
  evidence?: string[];
  scope: Scope; // "page" or "site"
  preview?: boolean;
  impact?: Impact;
}

export interface Executor {
  id: string;
  runPage?: (ctx: PageContext) => Promise<CheckResult | undefined>;
  runSite?: (ctx: SiteContext) => Promise<CheckResult | undefined>;
}

