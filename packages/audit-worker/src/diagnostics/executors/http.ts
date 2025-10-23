import type { Executor, SiteContext, CheckResult } from "../types";

async function safeFetch(url: string, init?: RequestInit): Promise<string | null> {
  try {
    const r = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(10000), // 10s timeout
      cf: { cacheTtl: 300 } as any,
    });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
}

function statusFromScore(s: number, passThreshold = 85, warnThreshold = 60): CheckResult["status"] {
  return s >= passThreshold ? "ok" : s >= warnThreshold ? "warn" : "fail";
}

export const httpExecutors: Record<string, Executor> = {
  A8_sitemap_discoverability: {
    id: "A8_sitemap_discoverability",
    async runSite(ctx: SiteContext) {
      const root = `https://${ctx.domain}`;
      const candidates = [`${root}/sitemap.xml`, `${root}/sitemap_index.xml`, `${root}/sitemap`];
      let found = false;
      let hasLastmod = false;
      let urlCount = 0;
      let foundUrl = "";

      for (const u of candidates) {
        const xml = await safeFetch(u);
        if (!xml) continue;
        found = true;
        foundUrl = u;
        hasLastmod = /<lastmod>[^<]+<\/lastmod>/i.test(xml);
        urlCount = (xml.match(/<loc>/gi) || []).length;
        break;
      }

      const score = !found ? 0 : hasLastmod && urlCount >= 50 ? 100 : hasLastmod ? 80 : urlCount >= 20 ? 60 : 40;

      return {
        id: "A8_sitemap_discoverability",
        scope: "site",
        score,
        status: statusFromScore(score, 85, 60),
        details: { found, foundUrl, hasLastmod, urlCount },
        impact: "Medium",
      };
    },
  },

  T5_ai_bot_access: {
    id: "T5_ai_bot_access",
    async runSite(ctx: SiteContext) {
      const robots = await safeFetch(`https://${ctx.domain}/robots.txt`);
      const bots = ["GPTBot", "Claude-Web", "PerplexityBot", "CCBot", "Google-Extended"];
      
      const rules: Record<string, boolean | null> = {};
      
      if (robots) {
        bots.forEach((bot) => {
          // Check if bot is specifically disallowed
          const disallowPattern = new RegExp(`User-agent:\\s*${bot}[\\s\\S]*?Disallow:\\s*/`, "i");
          rules[bot] = !disallowPattern.test(robots);
        });
      } else {
        bots.forEach((bot) => {
          rules[bot] = null; // No robots.txt = allow all by default
        });
      }

      const allowedCount = Object.values(rules).filter((v) => v === true || v === null).length;
      const score = robots ? Math.round((allowedCount / bots.length) * 100) : 50;

      return {
        id: "T5_ai_bot_access",
        scope: "site",
        preview: true,
        score,
        status: statusFromScore(score, 85, 60),
        details: { robotsPresent: !!robots, rules, allowedCount },
        impact: "High",
      };
    },
  },
};

