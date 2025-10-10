import React from "react";

type StatCardProps = {
  label: string;
  value: React.ReactNode; // number | "—"
  sub?: string; // small helper
  tone?: "good" | "warn" | "bad" | "neutral";
};

export function StatCard({ label, value, sub, tone = "neutral" }: StatCardProps) {
  const colors = {
    good: { bg: "#d1fae5", text: "#065f46", border: "#10b981" },
    warn: { bg: "#fef3c7", text: "#92400e", border: "#f59e0b" },
    bad: { bg: "#fee2e2", text: "#991b1b", border: "#ef4444" },
    neutral: { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" },
  }[tone];

  return (
    <div style={{
      background: colors.bg,
      border: `2px solid ${colors.border}`,
      borderRadius: 12,
      padding: 20,
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
    }}>
      <div style={{ fontSize: 13, color: colors.text, marginBottom: 8, opacity: 0.8, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: colors.text }}>
        {value ?? "—"}
      </div>
      {sub ? <div style={{ marginTop: 8, fontSize: 12, color: colors.text, opacity: 0.7 }}>{sub}</div> : null}
    </div>
  );
}

