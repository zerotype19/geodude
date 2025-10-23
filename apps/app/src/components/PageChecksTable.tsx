import React, { useState } from 'react';

interface PageCheck {
  id: string;
  score: number;
  status: 'ok' | 'warn' | 'fail' | 'not_applicable' | 'error';
  scope: 'page';
  preview?: boolean;
  impact?: 'High' | 'Medium' | 'Low';
  details?: Record<string, any>;
  evidence?: string[];
}

interface Criterion {
  id: string;
  label: string;
  description?: string | null;
  category: string;
  impact_level: 'High' | 'Medium' | 'Low';
  why_it_matters?: string | null;
  how_to_fix?: string | null;
  check_type?: string;
}

interface Props {
  rows: PageCheck[];
  criteriaMap: Map<string, Criterion>;
}

export default function PageChecksTable({ rows, criteriaMap }: Props) {
  const sorted = [...rows].sort(
    (a, b) => (a.preview ? 1 : 0) - (b.preview ? 1 : 0) || a.score - b.score
  );
  const active = rows.filter((r) => !r.preview).length;
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="rounded-xl border-2 border-border bg-surface-1 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border bg-surface-2">
        <h3 className="font-semibold ">Page-Level Checks</h3>
        <div className="text-xs muted">
          Active: {active}/{rows.length}
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        {sorted.map((r) => {
          const meta = criteriaMap.get(r.id);
          const isExpanded = expandedRows.has(r.id);
          return (
            <Row
              key={r.id}
              r={r}
              label={meta?.label ?? r.id}
              impact={meta?.impact_level}
              why={meta?.why_it_matters}
              how={meta?.how_to_fix}
              checkType={meta?.check_type}
              isExpanded={isExpanded}
              onToggle={() => toggleRow(r.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

interface RowProps {
  r: PageCheck;
  label: string;
  impact?: string;
  why?: string | null;
  how?: string | null;
  checkType?: string;
  isExpanded: boolean;
  onToggle: () => void;
}

function Row({ r, label, impact, why, how, checkType, isExpanded, onToggle }: RowProps) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 hover:bg-surface-2 transition-colors text-left"
      >
        <Status status={r.preview ? 'preview' : r.status} />
        <div className="flex-1 min-w-0">
          <div className="font-medium  text-sm">{label}</div>
          <div className="text-xs subtle mt-0.5 flex items-center gap-2">
            <span className="font-mono">{r.id}</span>
            {impact && (
              <>
                <span>•</span>
                <span>{impact} Impact</span>
              </>
            )}
            {checkType && (
              <>
                <span>•</span>
                <span className="font-mono text-[10px] bg-surface-2 px-1.5 py-0.5 rounded">
                  {checkType}
                </span>
              </>
            )}
          </div>
        </div>
        <ScoreBar score={r.score} />
        <svg
          className={`w-5 h-5 subtle transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 pl-16 space-y-3 bg-surface-2 border-t border-gray-100">
          {why && (
            <div className="text-sm">
              <span className="font-semibold ">Why it matters:</span>
              <p className="muted mt-1">{why}</p>
            </div>
          )}
          {how && (
            <div className="text-sm">
              <span className="font-semibold ">How to fix:</span>
              <p className="muted mt-1">{how}</p>
            </div>
          )}
          {r.details && Object.keys(r.details).length > 0 && (
            <div className="text-sm">
              <span className="font-semibold ">Details:</span>
              <pre className="bg-surface-1 rounded-lg p-3 overflow-x-auto text-xs mt-2 border border-border">
                {JSON.stringify(r.details, null, 2)}
              </pre>
            </div>
          )}
          {r.evidence && r.evidence.length > 0 && (
            <div className="text-sm">
              <span className="font-semibold ">Evidence:</span>
              <div className="mt-2 space-y-1">
                {r.evidence.slice(0, 3).map((ev, i) => (
                  <div key={i} className="text-xs muted bg-surface-1 rounded px-3 py-2 border border-border">
                    {ev}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface StatusProps {
  status: 'ok' | 'warn' | 'fail' | 'not_applicable' | 'error' | 'preview';
}

function Status({ status }: StatusProps) {
  const m = {
    ok: 'bg-success-soft0',
    warn: 'bg-warn-soft0',
    fail: 'bg-danger-soft0',
    error: 'bg-rose-500',
    not_applicable: 'bg-gray-400',
    preview: 'bg-brand',
  }[status] || 'bg-gray-400';

  const label =
    status === 'not_applicable'
      ? 'N/A'
      : status === 'preview'
      ? 'Preview'
      : status && typeof status === 'string'
      ? status.toUpperCase()
      : 'Unknown';

  return (
    <span className={`text-[10px] font-bold text-white px-2 py-1 rounded uppercase ${m}`}>
      {label}
    </span>
  );
}

interface ScoreBarProps {
  score: number;
}

function ScoreBar({ score }: ScoreBarProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const color =
    score >= 85 ? 'bg-success-soft0' : score >= 60 ? 'bg-warn-soft0' : 'bg-danger-soft0';

  return (
    <div className="w-32">
      <div className="w-full h-2 bg-surface-3 rounded-full overflow-hidden">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${clamped}%` }} />
      </div>
      <div className="text-xs text-right mt-1 font-semibold muted">
        {Math.round(score)}
      </div>
    </div>
  );
}

