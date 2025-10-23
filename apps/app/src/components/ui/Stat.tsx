import React from "react";

export function Stat({
  value,
  label,
  meta
}: {
  value: string | number;
  label: string;
  meta?: string;
}) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {meta && <div className="stat-meta">{meta}</div>}
    </div>
  );
}

