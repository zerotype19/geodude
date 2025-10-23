import React from 'react';

interface SiteCheck {
  id: string;
  score: number;
  status: 'ok' | 'warn' | 'fail' | 'not_applicable' | 'error';
  scope: 'site';
  preview?: boolean;
  impact?: 'High' | 'Medium' | 'Low';
  details?: Record<string, any>;
}

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

interface Props {
  siteChecks: SiteCheck[];
  criteriaMap: Map<string, Criterion>;
}

export default function SiteOverview({ siteChecks, criteriaMap }: Props) {
  const order = [
    'S1_faq_coverage_pct',
    'S2_faq_schema_adoption_pct',
    'S3_canonical_correct_pct',
    'S4_mobile_ready_pct',
    'S5_lang_correct_pct',
    'S6_entity_graph_adoption_pct',
    'S7_dup_title_pct',
    'S8_avg_h2_coverage',
    'S9_og_tags_coverage_pct',
    'S10_cta_above_fold_pct',
    'S11_internal_link_health_pct',
    'A8_sitemap_discoverability',
    'T5_ai_bot_access',
  ];

  const byId = new Map(siteChecks.map((c) => [c.id, c]));

  return (
    <div className="mb-8">
      <div className="mb-4">
        <h2 className="text-xl font-semibold  mb-1">Site-Level Diagnostics</h2>
        <p className="text-sm muted">
          Aggregate scores across all pages and site-wide checks
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {order.map((id) => {
          const row = byId.get(id);
          if (!row) return null;
          const meta = criteriaMap.get(id);
          return <MetricTile key={id} row={row} meta={meta} />;
        })}
      </div>
    </div>
  );
}

interface MetricTileProps {
  row: SiteCheck;
  meta?: Criterion;
}

function MetricTile({ row, meta }: MetricTileProps) {
  const badge = row.preview ? 'preview' : row.status;

  const getScoreBorderColor = (score: number): string => {
    if (!Number.isFinite(score)) return 'border-border';
    if (score >= 85) return 'border-success';
    if (score >= 60) return 'border-warn';
    return 'border-danger';
  };

  return (
    <div className={`rounded-xl border-2 p-4 bg-surface-1 hover:shadow-md transition-shadow ${getScoreBorderColor(row.score)}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="font-semibold  text-sm">
            {meta?.label ?? row.id}
          </div>
          {meta?.impact_level && (
            <div className="text-xs subtle mt-0.5">
              {meta.impact_level} Impact
            </div>
          )}
        </div>
        <StatusChip status={badge as any} />
      </div>
      <div className="text-3xl font-bold  mb-2">
        {Math.round(row.score)}
        <span className="text-lg subtle ml-1">
          {row.id.includes('pct') || row.id.includes('coverage') ? '%' : ''}
        </span>
      </div>
      {meta?.why_it_matters && (
        <div className="text-xs muted line-clamp-2">{meta.why_it_matters}</div>
      )}
    </div>
  );
}

interface StatusChipProps {
  status: 'ok' | 'warn' | 'fail' | 'preview' | 'not_applicable' | 'error';
}

function StatusChip({ status }: StatusChipProps) {
  const cls =
    status === 'ok'
      ? 'bg-success-soft text-success'
      : status === 'warn'
      ? 'bg-warn-soft text-warn'
      : status === 'fail'
      ? 'bg-danger-soft text-danger'
      : status === 'preview'
      ? 'bg-brand-soft text-brand'
      : status === 'not_applicable'
      ? 'bg-surface-2 muted'
      : 'bg-surface-2 muted';

  const label =
    status === 'preview'
      ? 'Preview'
      : status === 'not_applicable'
      ? 'N/A'
      : status === 'error'
      ? 'Error'
      : status && typeof status === 'string'
      ? status.toUpperCase()
      : 'Unknown';

  return (
    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded uppercase ${cls}`}>
      {label}
    </span>
  );
}

