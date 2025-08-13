export function ensureUTMs(dest: URL, src: string, pid?: string) {
  if (!dest.searchParams.has("utm_source")) {
    dest.searchParams.set("utm_source", `ai_${src}`);
    dest.searchParams.set("utm_medium", "ai_recommendation");
    if (pid) dest.searchParams.set("utm_campaign", String(pid));
  }
  return dest;
}
