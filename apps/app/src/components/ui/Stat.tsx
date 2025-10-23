import React from "react";

export function Stat({
  value,
  label,
  meta,
  className
}: {
  value: string | number;
  label: string;
  meta?: string;
  className?: string;
}) {
  return (
    <div className={`stat ${className || ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {meta && <div className="stat-meta">{meta}</div>}
    </div>
  );
}

