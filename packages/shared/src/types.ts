export type EdgeClickEvent = {
  ts: number;
  token: string;
  src: string;
  model?: string;
  pid?: string;
  geo?: string;
  ua?: string;
  ip?: string;
  asn?: string;
  dest: string;
  session_id?: string;
};

export type ConversionEvent = {
  ts: number;
  session_id: string;
  type: "lead" | "signup" | "purchase" | string;
  value_cents?: number;
  meta?: Record<string, unknown>;
};
