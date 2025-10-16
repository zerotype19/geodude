# Optiview AEO + GEO Scoring Guide

## How to read your scores

* **Two rollups:**
  * **AEO** (Answer Engine Optimization): how well your pages win Google/Bing answer-like surfaces (featured snippets, AI Overviews eligibility, rich results).
  * **GEO** (Generative Engine Optimization): how well your content is cited/used by LLMs and answer engines (ChatGPT/Claude/Perplexity).
* **Per-page checks:** 20 items (A1–A10, G1–G10). Each scores **0–3**:
  * **0** Missing, **1** Partial, **2** Meets, **3** Exceeds.
* **Weights:** Each check has a weight. Your page score = Σ(weight × score/3). Site score = average of page scores.
* **Top Blockers:** highest-impact low scores. **Quick Wins:** easiest high-impact fixes.
* **Evidence:** In page details, expand a check to see *why* it scored (detected schema, facts count, links, etc.).

### Priority bands

* **Red (0–1)**: fix now.
* **Amber (2)**: acceptable; improve when possible.
* **Green (3)**: exemplar; keep stable.

## AEO (Answer Engine Optimization)

### A1 — Answer-first design (weight 15)

**What we check:** A concise answer in the first ~600–800 chars, jump links/ToC, a scannable list/table near the top.
**Why it matters:** Reduces pogo-sticking; aligns with engagement-re-ranking and snippet eligibility.
**How to win:**
* Add a **2–4 sentence answer** at the top.
* Include a **"Jump to"** ToC with in-page anchors.
* Use a **step list** or **table** if procedural/comparative.
**Checklist:** answer block, ToC, H2 steps, short paragraphs.
**Tooltip:** *"Put the answer at the top with jump links and a scannable list/table."*

### A2 — Topical cluster integrity (15)

**Checks:** Page links to/from a pillar; breadcrumb present; cluster-internal links use descriptive anchors.
**Win:** Create a pillar ("/topic/") and 6–15 focused subpages; interlink them; add breadcrumbs.
**Tooltip:** *"Belongs to a tight cluster with pillar links and breadcrumb."*

### A3 — Host / site-level authority (15)

**Checks:** Valid `Organization` + `Person` JSON-LD, About/Contact, author pages.
**Win:** Add **Organization** schema site-wide; author bios with credentials; visible editorial standards.
**Tooltip:** *"Clear Organization & Author identity with valid schema."*

### A4 — Originality & effort (12)

**Checks:** Unique assets: data tables, tools, diagrams, code; references/method notes.
**Win:** Publish a downloadable asset (CSV/JSON, calculator, diagram) and explain your method.
**Tooltip:** *"Unique assets & method—hard to copy."*

### A5 — Schema accuracy & breadth (10)

**Checks:** Valid JSON-LD types (`Article`, `HowTo`, `FAQPage`, `QAPage`, `Product`, `BreadcrumbList`)—no errors.
**Win:** Use server-rendered JSON-LD; minimum viable properties per type; validate.
**Tooltip:** *"Correct JSON-LD for the page intent; no errors."*

### A6 — Crawlability & canonicals (10)

**Checks:** Self-canonical; unique title/H1; not `noindex`; no duplicate canonicals in cluster.
**Win:** One canonical per URL; dedupe similar pages; stable titles/H1s.
**Tooltip:** *"Self-canonical, unique title/H1; crawlable."*

### A7 — UX & performance proxies (8)

**Checks:** No big CLS above the fold; images have width/height; proper viewport; lazy-load below fold.
**Win:** Reserve image space; avoid layout shifts near the answer block.
**Tooltip:** *"Stable above-the-fold; no jumpy layout."*

### A8 — Sitemaps & discoverability (6)

**Checks:** `/sitemap.xml` exists; fresh `lastmod`; child sitemaps valid.
**Win:** Generate per-section sitemaps; keep `lastmod` accurate.
**Tooltip:** *"Sitemap present & fresh."*

### A9 — Freshness & stability (5)

**Checks:** `dateModified` present and increasing; internal links not 404; URL stable.
**Win:** Update cadence by topic; keep URLs stable; maintain link health.
**Tooltip:** *"Shows updates; links work; URLs stay put."*

### A10 — AI Overviews readiness (4)

**Checks:** Clear task framing, steps/pros-cons/safety notes, at least one credible external citation.
**Win:** Add a "Summary" + "Steps" + "Considerations/Safety" + "Sources" section.
**Tooltip:** *"Complete, safe, and well-cited answer for AIO."*

## GEO (Generative Engine Optimization)

### G1 — Citable "Key Facts" block (15)

**Checks:** "Key facts / At-a-glance" near top; 3–7 atomic bullets; optional anchors per fact.
**Win:** Add a facts box with **stable IDs** (`#fact-eligibility-2025`).
**Tooltip:** *"3–7 atomic facts near the top (anchored)."*

### G2 — Provenance schema (15)

**Checks:** `Article/CreativeWork` with `author`, `publisher`, `datePublished`, `dateModified`, `citation`, `isBasedOn`, `license`.
**Win:** Include sources in JSON-LD, not just on page.
**Tooltip:** *"Author, publisher, dates + citation/isBasedOn/license in JSON-LD."*

### G3 — Evidence density (12)

**Checks:** References section; outbound links to high-trust domains; tables/footnotes present.
**Win:** Add **References** with primary sources and in-page tables (not images).
**Tooltip:** *"Good references & real data tables."*

### G4 — AI crawler access & parity (12)

**Checks:** robots policy for GPTBot/Claude-Web/Perplexity; HTML ≈ rendered DOM for key blocks.
**Win:** Set your desired allow/deny; ensure server HTML contains key content/schema.
**Tooltip:** *"Bots allowed/denied intentionally; content matches rendered."*

### G5 — Chunkability & structure (10)

**Checks:** Short paragraphs; semantic headings; glossary; TL;DR summary.
**Win:** Add TL;DR, Glossary, and keep sections small and well-labeled.
**Tooltip:** *"Chunked content with summary & glossary."*

### G6 — Canonical fact URLs (8)

**Checks:** One URL per fact topic; stable anchor names.
**Win:** Split omnibus pages; add stable anchors for linkable facts.
**Tooltip:** *"Stable URLs/anchors for individual facts."*

### G7 — Dataset availability (8)

**Checks:** Downloadable CSV/JSON with version notes.
**Win:** Host a `/datasets/` file per table; link it from the page.
**Tooltip:** *"Provide CSV/JSON with versions."*

### G8 — Policy transparency (6)

**Checks:** Visible content license/AI reuse stance in UI + JSON-LD `license`.
**Win:** Add a site-wide policy page and link it; include `license` in schema.
**Tooltip:** *"Clear license/AI policy shown & in schema."*

### G9 — Update hygiene (7)

**Checks:** Visible changelog/"What changed" and `dateModified` aligned.
**Win:** Add a small changelog block or `<details>` with edits and dates.
**Tooltip:** *"Changelog + dateModified kept in sync."*

### G10 — Cluster ↔ evidence linking (7)

**Checks:** Pillars link to a `/sources` hub; hub links back.
**Win:** Build a central **Sources/Research** page; link both ways.
**Tooltip:** *"Pillars link to a sources hub and back."*

## Quick implementation snippets

### Answer-first block (A1)

```html
<section id="summary">
  <p><strong>Short answer:</strong> … 2–4 sentences …</p>
  <nav aria-label="Jump to">
    <a href="#steps">Steps</a> · <a href="#pros-cons">Pros & cons</a> · <a href="#sources">Sources</a>
  </nav>
</section>
```

### Key Facts (G1)

```html
<section id="key-facts">
  <h2>Key facts</h2>
  <ul>
    <li id="fact-eligibility-2025">Eligibility changes in 2025: …</li>
    <li id="fact-fee">Fee is $99/year …</li>
    <li id="fact-sla">SLA: 99.9% …</li>
  </ul>
</section>
```

### References (A4/G3)

```html
<section id="sources">
  <h2>References</h2>
  <ol>
    <li><a href="https://example.org/study">Study A</a></li>
    <li><a href="https://gov.example/reg-2025">Regulation 2025</a></li>
  </ol>
</section>
```

### Article/CreativeWork JSON-LD (A3–A5, G2, G8, G9)

```html
<script type="application/ld+json">
{
  "@context":"https://schema.org",
  "@type":"Article",
  "headline":"How to do X in 5 Steps",
  "url":"https://www.example.com/how-to-x",
  "datePublished":"2025-02-10",
  "dateModified":"2025-03-01",
  "author":{"@type":"Person","name":"Author Name","url":"https://www.example.com/authors/author"},
  "publisher":{"@type":"Organization","name":"Your Brand","url":"https://www.example.com"},
  "citation":[{"@type":"WebPage","name":"Study A","url":"https://example.org/study"}],
  "isBasedOn":[{"@type":"Dataset","name":"Dataset Y","url":"https://www.example.com/datasets/y"}],
  "license":"https://www.example.com/content-license"
}
</script>
```

### Robots stance for AI bots (G4)

```
User-agent: GPTBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: *
Disallow:
```

*(Change "Allow" to "Disallow" per policy.)*

## How to use the Optiview dashboard

1. **Open an audit → Top Blockers:** Work through the highest-weight 0/1 items first (A1/A2/A3 and G1/G2/G4).
2. **Open a page → Evidence:** Expand a check to see what we detected (facts count, schema types, etc.). Fix and click **Recompute**.
3. **Watch site score move:** As you green A1–A3 (AEO) and G1–G2/G4 (GEO), overall scores jump.

## Common pitfalls (and fixes)

* **Fancy content hidden behind JS** → server-render key blocks & JSON-LD (G4).
* **Endless "ultimate guide" pages** with no anchors → split into smaller pages; add stable anchors (G5/G6).
* **FAQ spam** → keep FAQs but don't rely on them; focus on answer-first + facts + provenance (A1/G1/G2).
* **No unique assets** → publish a simple CSV or diagram with method notes (A4/G7).

## Definition of "Done" per item (fast acceptance)

* **A1/G1:** Answer + Key Facts present above the fold; ≥3 bullets; jump links.
* **A3/G2:** JSON-LD passes validator; `citation/isBasedOn/license` present.
* **A4/G7:** At least one downloadable dataset or tool is linked.
* **G4:** Robots stance explicit for GPTBot/Claude-Web/Perplexity; parity pass.
* **G9:** Visible changelog + `dateModified` updated.
