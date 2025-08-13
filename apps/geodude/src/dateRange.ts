import { useEffect, useState } from "react";

export type Range = { from: number; to: number };

export function lastNDays(n: number): Range {
  const to = Date.now();
  const from = to - n * 24 * 3600 * 1000;
  return { from, to };
}

export function useDateRange(initial: Range = lastNDays(7)) {
  const [range, setRange] = useState<Range>(initial);
  return { range, setRange };
}

// Helper to build query URLs with date range
export function q(path: string, r: Range, base: string) {
  const u = new URL(`${base}${path}`);
  u.searchParams.set("from", String(r.from));
  u.searchParams.set("to", String(r.to));
  return u.toString();
}
