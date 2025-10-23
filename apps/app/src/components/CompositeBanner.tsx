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

const getScoreBorderColor = (score: number): string => {
  if (!Number.isFinite(score)) return 'border-border';
  if (score >= 85) return 'border-success';
  if (score >= 60) return 'border-warn';
  return 'border-danger';
};

export default function CompositeBanner({ data }: Props) {
  return (
    <div className="kpi-grid mb-8">
      <Stat
        value={fmt(data.total)}
        label="Optiview Score"
        className={`border-2 ${getScoreBorderColor(data.total)}`}
      />
      <Stat
        value={fmt(data.page_score)}
        label="Page Score"
        meta={`${data.counts.included} checks`}
        className={`border-2 ${getScoreBorderColor(data.page_score)}`}
      />
      <Stat
        value={fmt(data.site_score)}
        label="Site Score"
        className={`border-2 ${getScoreBorderColor(data.site_score)}`}
      />
    </div>
  );
}

const fmt = (n: number) => (Number.isFinite(n) ? `${n.toFixed(1)}` : '—');

