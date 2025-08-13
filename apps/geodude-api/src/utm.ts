// UTM parameter utilities for the API
export function ensureUTMs(dest: URL, source: string, campaign?: string) {
  if (!dest.searchParams.has("utm_source")) {
    dest.searchParams.set("utm_source", source);
  }
  if (!dest.searchParams.has("utm_medium")) {
    dest.searchParams.set("utm_medium", "ai_recommendation");
  }
  if (campaign && !dest.searchParams.has("utm_campaign")) {
    dest.searchParams.set("utm_campaign", campaign);
  }
}
