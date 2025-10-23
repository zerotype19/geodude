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

export default function CompositeBanner({ data }: Props) {
  return (
    <div className="kpi-grid mb-8">
      <Stat
        value={fmt(data.total)}
        label="Optiview Score"
      />
      <Stat
        value={fmt(data.page_score)}
        label="Page Score"
        meta={`${data.counts.included} checks`}
      />
      <Stat
        value={fmt(data.site_score)}
        label="Site Score"
      />
    </div>
  );
}

const fmt = (n: number) => (Number.isFinite(n) ? `${n.toFixed(1)}` : '—');

