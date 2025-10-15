# UI JSON Contracts - Ready-to-Wire Frontend Integration

## Audit Detail Header Widget

**Endpoint**: `GET /v1/audits/{id}/summary`

```json
{
  "audit": {
    "id": "aud_1760530760730_rilfi3dyr",
    "status": "running",
    "phase": "citations",
    "phase_started_at": "2025-01-15T23:05:56Z",
    "phase_heartbeat_at": "2025-01-15T23:06:08Z",
    "created_at": "2025-01-15T23:05:46Z",
    "completed_at": null,
    "pages_crawled": 50,
    "frontier_pending": 0
  },
  "coverage": {
    "pages": 50,
    "h1_coverage": 95,
    "title_coverage": 100,
    "meta_coverage": 87,
    "schema_article": 15,
    "schema_organization": 12,
    "has_author": 39,
    "has_dates": 32
  },
  "top_schema_types": [
    {"types": "Article,Organization", "count": 8},
    {"types": "WebSite", "count": 5},
    {"types": "FAQPage", "count": 3}
  ]
}
```

**Frontend Usage**:
```typescript
// Progress bar
const progress = `${audit.pages_crawled}/50`;
const phase = audit.phase;
const lastHeartbeat = formatTimeAgo(audit.phase_heartbeat_at);

// Health chips
const healthChips = [
  { label: "Frontier Empty", status: audit.frontier_pending === 0 },
  { label: "Seeded", status: true }, // from phase_state
  { label: "Browser", status: "closed" }, // from breaker status
  { label: "AI", status: "closed" } // from breaker status
];
```

## Coverage Widgets

**Endpoint**: `GET /v1/audits/{id}/analysis/coverage`

```json
{
  "pages": 50,
  "h1_ok": 48,
  "single_h1": 47,
  "title_ok": 50,
  "meta_ok": 44,
  "schema_article": 15,
  "schema_faq": 3,
  "schema_organization": 12,
  "schema_website": 8,
  "has_author": 39,
  "has_dates": 32,
  "has_media": 45,
  "has_citations": 22
}
```

**Frontend Usage**:
```typescript
// Coverage percentages
const h1Coverage = Math.round((coverage.h1_ok / coverage.pages) * 100);
const titleCoverage = Math.round((coverage.title_ok / coverage.pages) * 100);
const metaCoverage = Math.round((coverage.meta_ok / coverage.pages) * 100);

// E-E-A-T badges
const eeatBadges = [
  { label: "Author", percentage: Math.round((coverage.has_author / coverage.pages) * 100) },
  { label: "Dates", percentage: Math.round((coverage.has_dates / coverage.pages) * 100) },
  { label: "Media", percentage: Math.round((coverage.has_media / coverage.pages) * 100) },
  { label: "Citations", percentage: Math.round((coverage.has_citations / coverage.pages) * 100) }
];

// Schema histogram
const schemaHistogram = [
  { type: "Article", count: coverage.schema_article },
  { type: "Organization", count: coverage.schema_organization },
  { type: "WebSite", count: coverage.schema_website },
  { type: "FAQPage", count: coverage.schema_faq }
];
```

## Problem Table

**Endpoint**: `GET /v1/audits/{id}/analysis/problems`

```json
{
  "problems": [
    {
      "url": "https://example.com/page1",
      "h1_count": 0,
      "h1": null,
      "title": "Page Title",
      "meta_description": null,
      "schema_types": "",
      "eeat_flags": "HAS_MEDIA",
      "problem_codes": ["NO_H1", "NO_META_DESC", "NO_SCHEMA", "NO_AUTHOR", "NO_DATES"]
    },
    {
      "url": "https://example.com/page2",
      "h1_count": 3,
      "h1": "Main Heading",
      "title": "Page Title",
      "meta_description": "Description",
      "schema_types": "Article",
      "eeat_flags": "HAS_AUTHOR,HAS_DATES",
      "problem_codes": ["MULTI_H1"]
    }
  ]
}
```

**Frontend Usage**:
```typescript
// Problem table columns
const columns = [
  { key: "url", label: "URL" },
  { key: "h1_count", label: "H1 Count" },
  { key: "title", label: "Title" },
  { key: "meta_description", label: "Meta" },
  { key: "schema_types", label: "Schema" },
  { key: "eeat_flags", label: "E-E-A-T" },
  { key: "problem_codes", label: "Issues" }
];

// Problem code filters
const problemFilters = [
  "NO_H1", "MULTI_H1", "NO_TITLE", "NO_META_DESC", 
  "NO_SCHEMA", "NO_AUTHOR", "NO_DATES", "ROBOTS_NOINDEX"
];

// Status indicators
const getStatusIcon = (problemCodes: string[]) => {
  if (problemCodes.length === 0) return "✅";
  if (problemCodes.includes("NO_H1") || problemCodes.includes("MULTI_H1")) return "⚠️";
  return "❌";
};
```

## Schema Distribution Widget

**Endpoint**: `GET /v1/audits/{id}/analysis/schema-gaps`

```json
{
  "gaps": [
    {"schema_types": "Article,Organization", "c": 8},
    {"schema_types": "WebSite", "c": 5},
    {"schema_types": "FAQPage", "c": 3},
    {"schema_types": "Product", "c": 2},
    {"schema_types": "BreadcrumbList", "c": 1}
  ]
}
```

**Frontend Usage**:
```typescript
// Schema distribution chart
const schemaData = gaps.map(item => ({
  types: item.schema_types,
  count: item.c,
  percentage: Math.round((item.c / totalPages) * 100)
}));

// Top schema types
const topSchemas = schemaData
  .sort((a, b) => b.count - a.count)
  .slice(0, 5);
```

## Detailed Pages Table

**Endpoint**: `GET /v1/audits/{id}/analysis/pages?page=1&limit=20`

```json
{
  "results": [
    {
      "url": "https://example.com/",
      "h1": "Welcome to Example",
      "h1_count": 1,
      "title": "Example Domain",
      "meta_description": "This domain is for use in illustrative examples",
      "canonical": "https://example.com/",
      "robots_meta": "",
      "schema_types": "Organization,WebSite",
      "author": "Example Corp",
      "date_published": "2024-01-01",
      "date_modified": "2024-10-15",
      "images": 5,
      "headings_h2": 3,
      "headings_h3": 2,
      "outbound_links": 8,
      "word_count": 150,
      "eeat_flags": "HAS_AUTHOR,HAS_DATES,HAS_MEDIA,HAS_CITATIONS"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "pages": 3
  }
}
```

**Frontend Usage**:
```typescript
// Page table with expandable details
const pageColumns = [
  { key: "url", label: "URL", sortable: true },
  { key: "h1", label: "H1" },
  { key: "title", label: "Title" },
  { key: "word_count", label: "Words", sortable: true },
  { key: "schema_types", label: "Schema" },
  { key: "eeat_flags", label: "E-E-A-T" }
];

// E-E-A-T flag parsing
const parseEeatFlags = (flags: string) => {
  const flagList = flags ? flags.split(',') : [];
  return {
    hasAuthor: flagList.includes('HAS_AUTHOR'),
    hasDates: flagList.includes('HAS_DATES'),
    hasMedia: flagList.includes('HAS_MEDIA'),
    hasCitations: flagList.includes('HAS_CITATIONS')
  };
};
```

## Ops Dashboard Tiles (Admin)

**Endpoint**: Watchdog logs + custom metrics endpoint

```json
{
  "metrics": {
    "continuations_per_min": 12,
    "rewinds_per_min": 2,
    "visiting_demoted_per_min": 5,
    "p95_tick_duration_ms": 18500,
    "p95_total_audit_time_ms": 180000,
    "breaker_status": {
      "browser": "closed",
      "ai": "closed", 
      "fetch": "closed"
    },
    "recent_alerts": [
      {
        "type": "AUDIT_STUCK",
        "audit_id": "aud_123",
        "timestamp": "2025-01-15T23:10:00Z"
      }
    ]
  }
}
```

**Frontend Usage**:
```typescript
// Ops dashboard tiles
const opsTiles = [
  {
    title: "Continuations/min",
    value: metrics.continuations_per_min,
    status: metrics.continuations_per_min > 20 ? "warning" : "good"
  },
  {
    title: "P95 Tick Duration",
    value: `${Math.round(metrics.p95_tick_duration_ms / 1000)}s`,
    status: metrics.p95_tick_duration_ms > 25000 ? "warning" : "good"
  },
  {
    title: "Circuit Breakers",
    value: Object.values(metrics.breaker_status).every(s => s === "closed") ? "All Closed" : "Some Open",
    status: Object.values(metrics.breaker_status).every(s => s === "closed") ? "good" : "error"
  }
];
```

## Real-time Progress Updates

**Polling Strategy**:
```typescript
// Poll every 5 seconds during running audits
const pollInterval = 5000;

const pollAuditProgress = async (auditId: string) => {
  const response = await fetch(`/v1/audits/${auditId}/summary`);
  const data = await response.json();
  
  // Update progress indicators
  updateProgressBar(data.audit.pages_crawled);
  updatePhaseIndicator(data.audit.phase);
  updateHeartbeat(data.audit.phase_heartbeat_at);
  
  // Stop polling when complete
  if (data.audit.status === 'completed' || data.audit.status === 'failed') {
    clearInterval(pollTimer);
  }
};
```

## Error Handling

```typescript
// API error handling
const handleApiError = (error: any) => {
  if (error.status === 404) {
    return "Audit not found";
  }
  if (error.status === 429) {
    return "Rate limit exceeded. Please try again later.";
  }
  if (error.status >= 500) {
    return "Service temporarily unavailable. Please try again.";
  }
  return "An unexpected error occurred.";
};

// Graceful degradation for missing data
const getCoveragePercentage = (count: number, total: number) => {
  if (total === 0) return 0;
  return Math.round((count / total) * 100);
};
```

---

**Ready for Frontend Integration**: All endpoints tested and documented  
**CORS Enabled**: All endpoints support cross-origin requests  
**Error Handling**: Comprehensive error responses with helpful messages
