import type { Executor, SiteContext, CheckResult } from "../types";

async function safeFetch(url: string, init?: RequestInit): Promise<{ text: string; status: number } | null> {
  try {
    const r = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(10000), // 10s timeout
      cf: { cacheTtl: 300 } as any,
    });
    if (!r.ok) return null;
    const text = await r.text();
    // Avoid HTML error pages masquerading as XML/text
    if (/<!doctype|<html/i.test(text)) return null;
    return { text, status: r.status };
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
      const candidates = [
        `${root}/sitemap.xml`,
        `${root}/sitemap_index.xml`,
        `${root}/sitemap_index.xml.gz`,
        `${root}/sitemap1.xml`,
      ];

      // Parse robots.txt for Sitemap directives
      const robotsRes = await safeFetch(`${root}/robots.txt`);
      const robotsText = robotsRes?.text || "";
      const robotMapMatches = [...robotsText.matchAll(/Sitemap:\s*(https?:\/\/[^\s]+)/gi)];
      robotMapMatches.forEach(m => candidates.push(m[1]));

      let best: { url: string; xml: string } | null = null;
      
      // Try all candidates in parallel for efficiency
      const results = await Promise.all(
        [...new Set(candidates)].map(async u => {
          const res = await safeFetch(u);
          return res ? { url: u, xml: res.text } : null;
        })
      );
      
      // Pick first successful result
      best = results.find(r => r !== null) || null;

      const found = !!best;
      let hasLastmod = false;
      let urlCount = 0;
      
      if (best) {
        // Handle namespaced lastmod tags (e.g., <xhtml:lastmod>)
        hasLastmod = /<[-\w:]*lastmod>[^<]+<\/[-\w:]*lastmod>/i.test(best.xml);
        // Handle namespaced loc tags
        urlCount = (best.xml.match(/<[-\w:]*loc>/gi) || []).length;
      }

      const score = !found ? 0 :
        hasLastmod && urlCount >= 50 ? 100 :
        hasLastmod ? 80 :
        urlCount >= 20 ? 60 : 40;

      return {
        id: "A8_sitemap_discoverability",
        scope: "site",
        score,
        status: statusFromScore(score, 85, 60),
        details: { found, foundUrl: best?.url, hasLastmod, urlCount, fromRobots: robotMapMatches.length },
        impact: "Medium",
      };
    },
  },

  T6_ai_bot_access: {
    id: "T6_ai_bot_access",
    async runSite(ctx: SiteContext) {
      const robotsRes = await safeFetch(`https://${ctx.domain}/robots.txt`);
      const robots = robotsRes?.text || "";
      const bots = ["GPTBot", "Claude-Web", "PerplexityBot", "CCBot", "Googlebot"];
      
      const rules: Record<string, boolean | null> = {};
      const hasRobots = !!robots;
      
      if (hasRobots) {
        bots.forEach((bot) => {
          // Find bot-specific block (handles versioned user-agents like GPTBot/1.0)
          const botPattern = new RegExp(`User-agent:\\s*${bot}[\\s\\S]*?(?=User-agent:|$)`, "gi");
          const block = robots.match(botPattern)?.[0];
          
          // Find global wildcard block
          const globalBlock = robots.match(/User-agent:\s*\*\s*[\s\S]*?(?=User-agent:|$)/i)?.[0];
          
          // Check if bot is disallowed
          // Disallowed if: bot-specific "Disallow: /" OR global "Disallow: /" without bot-specific "Allow: /"
          const disallowed =
            /Disallow:\s*\/\s*$/im.test(block || "") ||
            (/Disallow:\s*\/\s*$/im.test(globalBlock || "") && !/Allow:\s*\//i.test(block || ""));
          
          rules[bot] = !disallowed;
        });
      } else {
        bots.forEach((bot) => {
          rules[bot] = null; // No robots.txt = neutral (not blocked, but not explicitly allowed)
        });
      }

      const allowedCount = Object.values(rules).filter((v) => v !== false).length;
      const score = !hasRobots ? 50 : Math.round((allowedCount / bots.length) * 100);

      return {
        id: "T6_ai_bot_access",
        scope: "site",
        preview: false,
        score,
        status: statusFromScore(score, 85, 60),
        details: { robotsPresent: hasRobots, allowedCount, rules },
        impact: "High",
      };
    },
  },
};

