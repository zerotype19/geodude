import React from "react";

type StatCardProps = {
  label: string;
  value: React.ReactNode; // number | "—"
  sub?: string; // small helper
  tone?: "good" | "warn" | "bad" | "neutral";
};

export function StatCard({ label, value, sub, tone = "neutral" }: StatCardProps) {
  const ring = {
    good: "ring-green-500/40",
    warn: "ring-yellow-500/40",
    bad: "ring-red-500/40",
    neutral: "ring-white/10",
  }[tone];

  return (
    <div className={`rounded-2xl ring-1 ${ring} bg-white/5 p-4 md:p-5`}>
      <div className="text-sm text-white/60">{label}</div>
      <div className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight">
        {value ?? "—"}
      </div>
      {sub ? <div className="mt-1 text-xs text-white/40">{sub}</div> : null}
    </div>
  );
}

