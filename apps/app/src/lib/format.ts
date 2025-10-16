import { Scores } from '../services/api';

export const isV21 = (scores?: Partial<Scores>) =>
  (scores?.score_model_version ?? "v1.0") === "v2.1";

export const pct = (n?: number) => `${Math.round((n ?? 0))}%`;

export const formatNumber = (n?: number) => {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString();
};

export const formatScore = (score?: number) => {
  if (score === null || score === undefined) return '—';
  return `${Math.round(score)}%`;
};

export const getScoreColor = (score?: number) => {
  if (score === null || score === undefined) return 'text-slate-400';
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-600';
};

export const getScoreBgColor = (score?: number) => {
  if (score === null || score === undefined) return 'bg-slate-100';
  if (score >= 80) return 'bg-emerald-50';
  if (score >= 60) return 'bg-yellow-50';
  return 'bg-red-50';
};
