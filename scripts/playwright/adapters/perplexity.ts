import { chromium } from "playwright";

export async function runPerplexity(query: string) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const url = `https://www.perplexity.ai/search?q=${encodeURIComponent(query)}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000); // simple settle

  const id = `px-${Date.now()}`;
  await page.screenshot({ path: `out/${id}.png`, fullPage: true });
  const html = await page.content();
  await browser.close();

  // naive citation parse: collect visible links under answer container
  const cites = Array.from(html.matchAll(/href="(https?:\/\/[^"]+)"/g)).slice(0,10).map((m, i) => ({
    url: m[1], rank: i+1, confidence: 0.5
  }));

  return {
    capture: {
      id, ts: Date.now(), surface: "perplexity",
      model_variant: "online", persona: null, geo: "us",
      query_text: query,
      dom_url: null,             // (set if you upload DOM to R2)
      screenshot_url: null       // (set if you upload PNG to R2)
    },
    citations: cites.map(c => ({ ...c, capture_id: id, ts: Date.now(), surface: "perplexity", query }))
  };
}
