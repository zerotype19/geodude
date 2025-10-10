import React from "react";

type StatCardProps = {
  label: string;
  value: React.ReactNode; // number | "—"
  sub?: string; // small helper
  tone?: "good" | "warn" | "bad" | "neutral";
};

export function StatCard({ label, value, sub, tone = "neutral" }: StatCardProps) {
  const borderColor = {
    good: "#10b981",
    warn: "#f59e0b",
    bad: "#ef4444",
    neutral: "#e2e8f0",
  }[tone];

  return (
    <div style={{
      background: 'white',
      border: `2px solid ${borderColor}`,
      borderRadius: 12,
      padding: 20,
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
    }}>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600, color: '#1e293b' }}>
        {value ?? "—"}
      </div>
      {sub ? <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>{sub}</div> : null}
    </div>
  );
}

