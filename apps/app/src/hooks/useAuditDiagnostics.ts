import { useState, useEffect } from 'react';
import { apiGet } from '/src/lib/api';

interface Criterion {
  id: string;
  label: string;
  description?: string | null;
  category: string;
  scope: 'page' | 'site';
  impact_level: 'High' | 'Medium' | 'Low';
  weight: number;
  check_type: 'html_dom' | 'llm' | 'aggregate' | 'http';
  preview: 0 | 1;
  enabled: 0 | 1;
  why_it_matters?: string | null;
  how_to_fix?: string | null;
}

interface CompositeData {
  total: number;
  page_score: number;
  site_score: number;
  counts: {
    included: number;
    preview: number;
    disabled: number;
  };
}

interface PageCheck {
  id: string;
  score: number;
  status: string;
  scope: 'page';
  preview?: boolean;
  impact?: string;
  details?: Record<string, any>;
  evidence?: string[];
}

interface SiteCheck {
  id: string;
  score: number;
  status: string;
  scope: 'site';
  preview?: boolean;
  impact?: string;
  details?: Record<string, any>;
}

export interface AuditDiagnostics {
  criteriaMap: Map<string, Criterion>;
  composite: CompositeData | null;
  siteChecks: SiteCheck[];
  pageChecks: Record<string, PageCheck[]>; // pageId -> checks
  loading: boolean;
  error: string | null;
}

export function useAuditDiagnostics(auditId: string | undefined, isPublic: boolean = false): AuditDiagnostics {
  const [criteriaMap, setCriteriaMap] = useState<Map<string, Criterion>>(new Map());
  const [composite, setComposite] = useState<CompositeData | null>(null);
  const [siteChecks, setSiteChecks] = useState<SiteCheck[]>([]);
  const [pageChecks, setPageChecks] = useState<Record<string, PageCheck[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auditId) {
      setLoading(false);
      return;
    }

    let mounted = true;

    async function loadDiagnostics() {
      try {
        setLoading(true);
        setError(null);

        // Build API paths based on public/private access
        const auditPath = isPublic ? `/api/public/audits/${auditId}` : `/api/audits/${auditId}`;
        const compositePath = isPublic ? `/api/public/audits/${auditId}/composite` : `/api/audits/${auditId}/composite`;
        const pagesPath = isPublic ? `/api/public/audits/${auditId}/pages?limit=100` : `/api/audits/${auditId}/pages?limit=100`;

        // Fetch criteria (all, including preview) - always public endpoint
        const criteria = await apiGet<Criterion[]>('/api/scoring/criteria?productionOnly=false');
        if (mounted) {
          const map = new Map(criteria.map((c) => [c.id, c]));
          setCriteriaMap(map);
        }

        // Fetch composite scores
        try {
          const compositeData = await apiGet<CompositeData>(compositePath);
          if (mounted) {
            setComposite(compositeData);
          }
        } catch (err) {
          console.warn('Composite scores not available:', err);
          // Not fatal - continue loading other data
        }

        // Fetch audit detail (includes site_checks_json)
        const audit = await apiGet<any>(auditPath);
        if (mounted) {
          // Parse site checks
          if (audit.site_checks_json) {
            try {
              const parsed =
                typeof audit.site_checks_json === 'string'
                  ? JSON.parse(audit.site_checks_json)
                  : audit.site_checks_json;
              setSiteChecks(Array.isArray(parsed) ? parsed : []);
            } catch (err) {
              console.error('Failed to parse site_checks_json:', err);
              setSiteChecks([]);
            }
          }
        }

        // Fetch pages (includes checks_json per page)
        const pagesData = await apiGet<{ pages: any[] }>(pagesPath);
        if (mounted && pagesData.pages) {
          const checksMap: Record<string, PageCheck[]> = {};
          pagesData.pages.forEach((page) => {
            if (page.checks_json) {
              try {
                const parsed =
                  typeof page.checks_json === 'string'
                    ? JSON.parse(page.checks_json)
                    : page.checks_json;
                checksMap[page.id] = Array.isArray(parsed) ? parsed : [];
              } catch (err) {
                console.error(`Failed to parse checks_json for page ${page.id}:`, err);
                checksMap[page.id] = [];
              }
            } else {
              checksMap[page.id] = [];
            }
          });
          setPageChecks(checksMap);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load diagnostics');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadDiagnostics();

    return () => {
      mounted = false;
    };
  }, [auditId, isPublic]);

  return {
    criteriaMap,
    composite,
    siteChecks,
    pageChecks,
    loading,
    error,
  };
}

