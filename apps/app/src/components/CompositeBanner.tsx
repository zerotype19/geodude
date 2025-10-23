import React from 'react';

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
    <div className="grid gap-4 sm:grid-cols-3 mb-8">
      <Tile 
        title="Optiview Score" 
        value={fmt(data.total)} 
        subtitle={data.counts.preview > 0 ? `${data.counts.preview} preview excluded` : undefined}
        color="blue"
      />
      <Tile 
        title="Page Score" 
        value={fmt(data.page_score)} 
        subtitle={`${data.counts.included} checks`}
        color="green"
      />
      <Tile 
        title="Site Score" 
        value={fmt(data.site_score)} 
        color="purple"
      />
    </div>
  );
}

interface TileProps {
  title: string;
  value: string;
  subtitle?: string;
  color?: 'blue' | 'green' | 'purple';
}

function Tile({ title, value, subtitle, color = 'blue' }: TileProps) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    purple: 'bg-purple-50 border-purple-200',
  };

  const textColorClasses = {
    blue: 'text-blue-900',
    green: 'text-green-900',
    purple: 'text-purple-900',
  };

  return (
    <div className={`rounded-xl border-2 p-6 ${colorClasses[color]} shadow-sm`}>
      <div className="text-sm font-medium text-gray-600">{title}</div>
      <div className={`text-4xl font-bold mt-2 ${textColorClasses[color]}`}>{value}</div>
      {subtitle && <div className="text-xs text-gray-500 mt-2">{subtitle}</div>}
    </div>
  );
}

const fmt = (n: number) => (Number.isFinite(n) ? `${n.toFixed(1)}` : '—');

