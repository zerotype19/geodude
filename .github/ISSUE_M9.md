# M9 — Citations Lite (Perplexity-first)

**Goal**: Prototype AI inclusion signal (0 or some sources).

## Schema

New table:

```sql
CREATE TABLE IF NOT EXISTS citations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_id TEXT NOT NULL,
  engine TEXT NOT NULL,      -- 'perplexity' | 'bing' | 'stub'
  query TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  cited_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_citations_audit ON citations(audit_id);
```

## Tasks

- [ ] Migration: add `citations` table (db/migrations/0003_citations.sql)
- [ ] Worker endpoint (internal): `/v1/citations/fetch?audit_id=...` (re-uses last domain & a few seed queries)
- [ ] Minimal fetcher: call a TOS-safe endpoint (or stub returning 0) and parse "sources"
- [ ] Store matches; surface in API `GET /v1/audits/:id` as `citations[]`
- [ ] UI: add "Citations" tab; show "None yet" if empty

## Acceptance Criteria

- [ ] For query "Optiview AI visibility", system returns either 0 or a small list
- [ ] If any URL matches your domain, it appears in the Citations tab
- [ ] Empty state: "No citations yet" displays correctly
- [ ] Citations persist to D1 database

## Out of Scope

- Full search integrations
- Paid APIs at scale
- Multiple search engines (Perplexity-first only)

## Technical Notes

### Migration File
```sql
-- db/migrations/0003_citations.sql
CREATE TABLE IF NOT EXISTS citations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_id TEXT NOT NULL,
  engine TEXT NOT NULL,
  query TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  cited_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_citations_audit ON citations(audit_id);
```

### Seed Queries
```typescript
const seedQueries = [
  `${domain} AI visibility`,
  `${companyName} AI optimization`,
  `${domain} structured data`
];
```

### TOS-Safe Options
1. **Stub**: Return 0 citations (minimal viable)
2. **SerpAPI**: Perplexity results (check TOS)
3. **Direct scrape**: Perplexity HTML (check robots.txt)

### API Response Format
```json
{
  "id": "aud_xxx",
  "score_overall": 0.99,
  "pages": [...],
  "issues": [...],
  "citations": [
    {
      "engine": "perplexity",
      "query": "Optiview AI visibility",
      "url": "https://optiview.ai/docs/audit.html",
      "title": "Audit Checks - Optiview",
      "cited_at": 1696800000
    }
  ]
}
```

### UI Component
```typescript
// Citations tab
{citations && citations.length > 0 ? (
  <table>
    <thead>
      <tr>
        <th>Engine</th>
        <th>Query</th>
        <th>Cited URL</th>
        <th>Date</th>
      </tr>
    </thead>
    <tbody>
      {citations.map(c => (
        <tr key={c.id}>
          <td>{c.engine}</td>
          <td>{c.query}</td>
          <td><a href={c.url}>{c.title || c.url}</a></td>
          <td>{new Date(c.cited_at * 1000).toLocaleDateString()}</td>
        </tr>
      ))}
    </tbody>
  </table>
) : (
  <p>No citations yet. This means your domain hasn't appeared in AI answer sources.</p>
)}
```

## Dependencies

- [ ] D1 migration for citations table
- [ ] Search API decision (stub vs. SerpAPI vs. scrape)
- [ ] Dashboard UI update for Citations tab

## Testing Checklist

- [ ] Migration applies successfully
- [ ] Stub fetcher returns 0 citations
- [ ] Citations table populated when sources found
- [ ] UI shows "None yet" for empty state
- [ ] UI shows citations table when data present
- [ ] Domain matching works correctly

---

**Target Release**: v0.12.0  
**Priority**: Medium (requires external API research)

