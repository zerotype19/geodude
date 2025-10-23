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

const getScoreGlow = (score: number): string => {
  if (!Number.isFinite(score)) return '';
  if (score >= 85) return 'score-glow-success';
  if (score >= 60) return 'score-glow-warn';
  return 'score-glow-danger';
};

export default function CompositeBanner({ data }: Props) {
  return (
    <div className="kpi-grid mb-8">
      <Stat
        value={fmt(data.total)}
        label="Optiview Score"
        className={getScoreGlow(data.total)}
      />
      <Stat
        value={fmt(data.page_score)}
        label="Page Score"
        meta={`${data.counts.included} checks`}
        className={getScoreGlow(data.page_score)}
      />
      <Stat
        value={fmt(data.site_score)}
        label="Site Score"
        className={getScoreGlow(data.site_score)}
      />
    </div>
  );
}

const fmt = (n: number) => (Number.isFinite(n) ? `${n.toFixed(1)}` : '—');

