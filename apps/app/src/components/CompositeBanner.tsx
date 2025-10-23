import React from 'react';
import { Stat } from './ui/Stat';

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

interface Props {
  data: CompositeData;
}

const getScoreColor = (score: number): string => {
  if (!Number.isFinite(score)) return '';
  if (score >= 85) return 'bg-success-soft border-success/20';
  if (score >= 60) return 'bg-warn-soft border-warn/20';
  return 'bg-danger-soft border-danger/20';
};

export default function CompositeBanner({ data }: Props) {
  return (
    <div className="kpi-grid mb-8">
      <Stat
        value={fmt(data.total)}
        label="Optiview Score"
        className={getScoreColor(data.total)}
      />
      <Stat
        value={fmt(data.page_score)}
        label="Page Score"
        meta={`${data.counts.included} checks`}
        className={getScoreColor(data.page_score)}
      />
      <Stat
        value={fmt(data.site_score)}
        label="Site Score"
        className={getScoreColor(data.site_score)}
      />
    </div>
  );
}

const fmt = (n: number) => (Number.isFinite(n) ? `${n.toFixed(1)}` : '—');

