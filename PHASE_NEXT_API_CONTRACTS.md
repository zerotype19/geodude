# Phase Next - API Contracts & Data Formats

This document defines the exact data structures and API responses for Phase Next.

---

## Page List Response

### GET `/api/audits/:auditId/pages`

```typescript
{
  "pages": [{
    "id": 123,
    "audit_id": "abc-123",
    "url": "https://example.com/guide",
    "title": "Complete Guide",
    "page_type": "article",  // NEW: answer|faq|product|article|category|docs
    
    // Scores (includes shadow checks)
    "scores": {
      "criteria": {
        // Existing checks
        "A1": 0.9,
        "A2": 0.8,
        "A3": 1.0,
        // ... existing A1-A11, G1-G10
        
        // NEW shadow checks
        "A12": 0.0,  // Q&A scaffold
        "C1": 1.0,   // AI bot access
        "G11": 0.7,  // Entity graph
        "G12": 0.8   // Topic depth
      },
      
      // NEW: Category rollups (0-100 scale)
      "categoryRollups": {
        "Content & Clarity": 86,
        "Structure & Organization": 78,
        "Authority & Trust": 71,
        "Technical Foundations": 90,
        "Crawl & Discoverability": 84,
        "Experience & Performance": 68
      },
      
      // NEW: E-E-A-T rollups (0-100 scale)
      "eeatRollups": {
        "Access & Indexability": 85,
        "Entities & Structure": 80,
        "Answer Fitness": 83,
        "Authority/Trust": 72,
        "Performance & Stability": 69
      }
    },
    
    // NEW: Performance metrics
    "perf": {
      "lcp_ms": 2200,
      "cls": 0.04,
      "fid_ms": 18,
      "ttfb_ms": 150,
      "fcp_ms": 1200
    },
    
    // NEW: Citation flags
    "is_cited": true,
    "citation_count": 3,
    "assistants_citing": ["chatgpt", "claude"],
    
    // NEW: Recommendation fields (Phase 4)
    "nearest_cited_url": "https://example.com/other",
    "recommendation_json": {
      "diffs": {
        "A1": { "delta": 0.3, "tip": "Add concise answer in first paragraph" },
        "A12": { "delta": 1.0, "tip": "Add FAQ schema" }
      },
      "actions": [
        "Add FAQ schema for Q&A content",
        "Improve answer-first design"
      ]
    },
    
    // Existing fields
    "depth": 1,
    "status_code": 200,
    "content_type": "text/html",
    "created_at": "2025-10-21T12:00:00Z"
  }]
}
```

---

## AI Bot Access JSON

Stored in `audit_page_analysis.ai_bot_access_json`:

```json
{
  "gptbot": {
    "allowed": true,
    "rule": "allow",
    "source": "robots.txt"
  },
  "claude": {
    "allowed": true,
    "rule": "no-rule",
    "source": "inferred"
  },
  "perplexity": {
    "allowed": false,
    "rule": "disallow: /",
    "source": "robots.txt"
  }
}
```

### Fields

- `allowed` (boolean): Whether bot can access the page
- `rule` (string): Specific rule applied (e.g., "allow", "disallow: /", "no-rule", "noindex")
- `source` (string): Where rule comes from ("robots.txt" | "meta" | "header" | "inferred")

---

## Topic Depth Diagnostics (G12)

Stored in `audit_page_analysis.metadata.topic_depth`:

```json
{
  "top_terms": [
    "insurance",
    "coverage",
    "premium",
    "deductible",
    "network",
    "copay",
    "enrollment"
  ],
  "question_patterns": [
    "what",
    "how",
    "cost",
    "compare",
    "benefits"
  ],
  "coverage_ratio": 0.76
}
```

### Fields

- `top_terms` (string[]): Top 10 most relevant terms extracted from page
- `question_patterns` (string[]): Question patterns found on page
- `coverage_ratio` (number): 0-1 ratio of topic coverage vs. seed terms

---

## Entity Graph Metadata (G11)

Stored in `audit_page_analysis.metadata.entity_graph`:

```json
{
  "graph_orphan": false,
  "graph_hub": true,
  "graph_types": ["Organization", "WebPage", "BreadcrumbList"],
  "links_in": 15,
  "links_out": 23
}
```

### Fields

- `graph_orphan` (boolean): True if page has no inbound links
- `graph_hub` (boolean): True if page is an entity hub (About/Org page)
- `graph_types` (string[]): Schema types present on this page
- `links_in` (number): Count of inbound internal links
- `links_out` (number): Count of outbound internal links

---

## Q&A Scaffold Evidence (A12)

Stored in `audit_page_analysis.metadata.qa_scaffold`:

```json
{
  "faq_schema": true,
  "dl_elements": 3,
  "question_headings": 5,
  "answer_blocks": 5,
  "first_viewport_answer": true,
  "patterns": [
    "FAQ Schema (FAQPage + Question/Answer)",
    "Definition lists (3 <dl> elements)",
    "Question headings (5 H2/H3 with "?")",
    "Answer blocks (5 Q→A pairs)"
  ]
}
```

### Fields

- `faq_schema` (boolean): FAQPage schema detected
- `dl_elements` (number): Count of `<dl>` elements
- `question_headings` (number): Count of H2/H3 with "?"
- `answer_blocks` (number): Count of Q→A pairs
- `first_viewport_answer` (boolean): Concise answer in first 800 chars
- `patterns` (string[]): Human-readable detected patterns

---

## Citations Summary

### GET `/api/audits/:auditId/citations/summary`

```typescript
{
  "audit_id": "abc-123",
  "project_id": "proj-456",
  "window": "7d",
  "summary": {
    "total_citations": 45,
    "unique_urls": 12,
    "assistants": {
      "chatgpt": { "citations": 20, "unique_urls": 8 },
      "claude": { "citations": 15, "unique_urls": 6 },
      "perplexity": { "citations": 10, "unique_urls": 4 }
    }
  },
  "top_cited_urls": [
    {
      "url": "https://example.com/guide",
      "citations": 8,
      "assistants": ["chatgpt", "claude", "perplexity"]
    }
  ],
  "queries": [
    {
      "question": "what is example product",
      "assistant": "chatgpt",
      "cited_url": "https://example.com/guide",
      "snippet": "Example product is...",
      "cited_at": "2025-10-21T12:00:00Z"
    }
  ]
}
```

---

## MVA Metrics

### GET `/api/audits/:auditId/mva`

Stored in `mva_metrics` table:

```typescript
{
  "audit_id": "abc-123",
  "project_id": "proj-456",
  "window": "7d",
  "assistant": "all",
  "mva_index": 78,  // 0-100
  "mentions_count": 45,
  "unique_urls": 12,
  "impression_estimate": 15000,
  "competitors": [
    {
      "domain": "competitor.com",
      "mentions": 30,
      "share": 0.40
    },
    {
      "domain": "example.com",
      "mentions": 45,
      "share": 0.60
    }
  ],
  "computed_at": "2025-10-21T12:00:00Z"
}
```

### MVA Index Calculation

```
MVA Index = (
  (mentions_count * 0.4) +
  (unique_urls * 0.3) +
  (relative_share * 0.3)
) * 100 / max_possible
```

---

## Performance Ratings

### Helper Function Response

```typescript
{
  "lcp_rating": "good" | "needs-improvement" | "poor" | "unknown",
  "cls_rating": "good" | "needs-improvement" | "poor" | "unknown",
  "fid_rating": "good" | "needs-improvement" | "poor" | "unknown"
}
```

### Thresholds (Google CWV)

- **LCP**: good ≤ 2500ms, needs-improvement ≤ 4000ms, poor > 4000ms
- **CLS**: good ≤ 0.1, needs-improvement ≤ 0.25, poor > 0.25
- **FID**: good ≤ 100ms, needs-improvement ≤ 300ms, poor > 300ms

---

## Vectorize Metadata

Stored with each embedding in Vectorize index:

```json
{
  "project_id": "proj-456",
  "audit_id": "abc-123",
  "url": "https://example.com/guide",
  "page_type": "article",
  "is_cited": true,
  "assistants_citing": "[\"chatgpt\",\"claude\"]"
}
```

Note: `assistants_citing` is JSON stringified due to Vectorize metadata limitations.

---

## Category & E-E-A-T Rollup Storage

Stored in `audit_page_analysis.metadata`:

```json
{
  "category_scores": {
    "Content & Clarity": 86,
    "Structure & Organization": 78,
    "Authority & Trust": 71,
    "Technical Foundations": 90,
    "Crawl & Discoverability": 84,
    "Experience & Performance": 68
  },
  "eeat_scores": {
    "Access & Indexability": 85,
    "Entities & Structure": 80,
    "Answer Fitness": 83,
    "Authority/Trust": 72,
    "Performance & Stability": 69
  }
}
```

---

## Shadow Check Preview Badge

UI should render checks with `preview: true` flag differently:

```tsx
{check.preview && (
  <span className="badge badge-preview">Preview</span>
)}
```

Check IDs with preview flag (Phase 1):
- A12 (Q&A scaffold)
- C1 (AI bot access)
- G11 (Entity graph)
- G12 (Topic depth)

---

## Backward Compatibility

All existing API endpoints continue to work unchanged. New fields are **additive only**:

- Existing `scores.criteria` object still includes A1-A11, G1-G10
- New shadow checks (A12, C1, G11, G12) are added but don't affect composite scores while `PHASE_NEXT_SCORING=false`
- New rollups (`categoryRollups`, `eeatRollups`) are optional additions
- New performance fields (`perf`, `lcp_ms`, etc.) are optional

Clients can safely ignore new fields if not yet ready to consume them.

---

## Feature Flags

Control Phase Next behavior via environment variables:

```bash
PHASE_NEXT_ENABLED=true    # Enable new checks and rollups
PHASE_NEXT_SCORING=false   # Shadow mode (don't affect scores)
VECTORIZE_ENABLED=true     # Enable embeddings
```

When `PHASE_NEXT_ENABLED=false`:
- New checks not computed
- Rollups not calculated
- Vectorize not called

When `PHASE_NEXT_SCORING=false`:
- New checks computed but excluded from composite
- Preview badges shown in UI

When `PHASE_NEXT_SCORING=true`:
- New checks affect composite scores
- Preview badges removed

