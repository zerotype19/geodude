# Phase 6: Exports & Benchmarks - Specification

**Version**: 0.1.0 (Draft)  
**Status**: Planning  
**Prerequisites**: Phase Next v2.0.0 stable (72h+ monitoring)  
**Estimated Effort**: 2-3 weeks

---

## 🎯 Objectives

Transform Optiview from an audit tool into a **competitive intelligence platform** with:
1. **Data Export APIs** - CSV/JSON exports for reporting
2. **Benchmark Comparisons** - Site vs. category/industry averages
3. **Webhook Notifications** - Real-time alerts for citations & visibility shifts
4. **Assistant-Specific Tuning** - Separate optimization for ChatGPT vs. Claude vs. Perplexity

---

## 📊 Feature Breakdown

### 6.1 Export APIs

**Goal**: Enable clients to export audit data for external analysis

#### Export Types

| Export Type | Format | Endpoint | Description |
|------------|--------|----------|-------------|
| **Audit Summary** | CSV/JSON | `/v1/audits/:id/export` | Complete audit with all checks |
| **Page-Level Detail** | CSV/JSON | `/v1/audits/:id/pages/export` | All pages with scores & recommendations |
| **MVA Report** | CSV/JSON | `/v1/audits/:id/mva/export` | Competitive visibility over time |
| **Citations List** | CSV/JSON | `/v1/audits/:id/citations/export` | All citations with snippets |
| **Recommendations** | CSV/JSON | `/v1/audits/:id/recommendations/export` | Learning Loop suggestions |

#### CSV Schema Example (Audit Summary)

```csv
audit_id,domain,created_at,aeo_score,geo_score,category_content_clarity,category_structure,category_authority,category_technical,category_crawl,category_experience,eeat_access,eeat_entities,eeat_answer_fitness,eeat_authority,eeat_performance,pages_total,pages_cited,mva_index,top_competitor
aud_123,example.com,2025-10-21,85,78,86,82,71,90,84,68,85,80,83,72,69,45,12,62,competitor-a.com
```

#### Implementation

**Files to Create:**
- `src/api/exports/auditExport.ts` - Main export logic
- `src/api/exports/csvFormatter.ts` - CSV generation
- `src/api/exports/jsonFormatter.ts` - JSON generation
- `src/api/routes/exports.ts` - API routes

**Key Functions:**
```typescript
async function exportAudit(auditId: string, format: 'csv' | 'json'): Promise<Blob>
async function exportPages(auditId: string, format: 'csv' | 'json'): Promise<Blob>
async function exportMVA(auditId: string, window: '7d' | '30d', format: 'csv' | 'json'): Promise<Blob>
```

---

### 6.2 Benchmarks Dashboard

**Goal**: Show how a site performs vs. industry peers

#### Benchmark Metrics

| Metric | Description | Calculation |
|--------|-------------|-------------|
| **Category Percentile** | Where site ranks in category scores | Percentile across all audits in industry |
| **Industry Average** | Mean scores per category | Rolling 90-day average |
| **Peer Comparison** | Similar-sized sites | Filter by page count ±50% |
| **Citation Rate** | Pages cited vs. industry | % cited pages / total pages |
| **MVA Trend** | Visibility growth rate | Week-over-week % change |

#### Benchmark Categories

1. **E-Commerce** - Shopify, WooCommerce, etc.
2. **Healthcare** - HIPAA-compliant sites
3. **Finance** - Banks, fintech, insurance
4. **SaaS** - Software products
5. **Publishing** - News, blogs, magazines
6. **Professional Services** - Law, consulting, agencies

#### UI Components

**Files to Create:**
- `apps/app/src/routes/audits/[id]/benchmarks.tsx` - Benchmarks tab
- `apps/app/src/components/Benchmarks/CategoryPercentile.tsx` - Percentile chart
- `apps/app/src/components/Benchmarks/IndustryAverage.tsx` - Average comparison
- `apps/app/src/components/Benchmarks/PeerList.tsx` - Similar sites
- `apps/app/src/components/Benchmarks/TrendChart.tsx` - Time series

**Backend Jobs:**
- `src/jobs/benchmarksCompute.ts` - Daily aggregation
- `src/lib/benchmarks.ts` - Calculation logic

**Database:**
```sql
CREATE TABLE benchmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  industry TEXT NOT NULL,
  metric TEXT NOT NULL,
  period TEXT NOT NULL, -- '7d', '30d', '90d'
  value REAL,
  percentile_25 REAL,
  percentile_50 REAL,
  percentile_75 REAL,
  percentile_90 REAL,
  sample_size INTEGER,
  computed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_benchmarks_industry ON benchmarks(industry);
CREATE INDEX idx_benchmarks_metric ON benchmarks(metric);
CREATE INDEX idx_benchmarks_period ON benchmarks(period);
```

---

### 6.3 Webhook Notifications

**Goal**: Push real-time alerts to external systems

#### Webhook Events

| Event | Trigger | Payload |
|-------|---------|---------|
| `audit.completed` | Audit finishes | Audit summary with scores |
| `citation.new` | New citation detected | Citation details + page |
| `mva.threshold` | MVA drops >10% | Current vs. previous MVA |
| `recommendation.new` | Learning Loop finds opportunities | Top 5 recommendations |
| `score.regression` | Category score drops >15% | Changed category + delta |

#### Webhook Configuration

**Admin UI:**
- `apps/app/src/routes/admin/webhooks.tsx` - Webhook management
- CRUD for webhook URLs + event subscriptions
- Test webhook button
- Delivery logs

**Database:**
```sql
CREATE TABLE webhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT NOT NULL, -- JSON array
  secret TEXT, -- HMAC signing
  enabled INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE webhook_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  webhook_id INTEGER NOT NULL,
  event TEXT NOT NULL,
  payload TEXT NOT NULL, -- JSON
  response_status INTEGER,
  response_body TEXT,
  delivered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (webhook_id) REFERENCES webhooks(id)
);
```

**Implementation:**
- `src/webhooks/dispatcher.ts` - Queue and send webhooks
- `src/webhooks/signer.ts` - HMAC signature generation
- `src/webhooks/retry.ts` - Exponential backoff retry logic

---

### 6.4 Assistant-Specific Tuning

**Goal**: Optimize differently for ChatGPT vs. Claude vs. Perplexity

#### Assistant Profiles

| Assistant | Optimization Focus | Weighted Checks | Recommendations |
|-----------|-------------------|-----------------|-----------------|
| **ChatGPT** | Answer-first, Q&A | A1, A12, G6 | Add FAQ schema, concise summaries |
| **Claude** | Depth, citations | G2, G12, A4 | Expand topic coverage, add references |
| **Perplexity** | Source diversity | G5, G7, A11 | Enhance entity markup, improve discoverability |
| **Brave** | Speed, mobile | A7, A8, A9 | Optimize performance, mobile-first |

#### Assistant-Specific Scores

**Database Extension:**
```sql
ALTER TABLE audit_pages ADD COLUMN scores_by_assistant TEXT; -- JSON
-- Example: {"chatgpt": 85, "claude": 78, "perplexity": 82, "brave": 90}
```

**UI Components:**
- `apps/app/src/components/Scores/AssistantTabs.tsx` - Tab switcher
- `apps/app/src/components/Scores/AssistantProfile.tsx` - Per-assistant view

**Calculation:**
```typescript
function computeAssistantScore(
  page: AuditPage,
  assistant: 'chatgpt' | 'claude' | 'perplexity' | 'brave'
): number {
  const weights = ASSISTANT_WEIGHTS[assistant];
  return weightedAverage(page.checks, weights);
}
```

---

## 🗂️ Database Schema Changes

### New Tables (3)

1. **benchmarks** - Industry aggregates
2. **webhooks** - Webhook configurations
3. **webhook_deliveries** - Delivery logs

### Modified Tables (1)

1. **audit_pages** - Add `scores_by_assistant` column

---

## 📋 API Endpoints (New)

### Exports
- `GET /v1/audits/:id/export?format=csv|json`
- `GET /v1/audits/:id/pages/export?format=csv|json`
- `GET /v1/audits/:id/mva/export?format=csv|json&window=7d|30d`
- `GET /v1/audits/:id/citations/export?format=csv|json`
- `GET /v1/audits/:id/recommendations/export?format=csv|json`

### Benchmarks
- `GET /v1/benchmarks/:industry?metric=category_content&period=90d`
- `GET /v1/audits/:id/benchmarks` - Site vs. industry comparison

### Webhooks (Admin)
- `GET /v1/webhooks` - List webhooks
- `POST /v1/webhooks` - Create webhook
- `PUT /v1/webhooks/:id` - Update webhook
- `DELETE /v1/webhooks/:id` - Delete webhook
- `POST /v1/webhooks/:id/test` - Test delivery
- `GET /v1/webhooks/:id/deliveries` - Delivery logs

### Assistant Tuning
- `GET /v1/audits/:id/scores/:assistant` - Assistant-specific view

---

## 🎨 UI Components (New)

### Exports
- Export button on Audit Detail
- Format selector (CSV/JSON)
- Download progress indicator

### Benchmarks Tab
- Industry selector dropdown
- Percentile chart (bar chart with markers)
- Peer comparison table
- Trend line chart

### Webhooks (Admin)
- Webhooks list with status indicators
- Create/Edit webhook form
- Event subscription checkboxes
- Test webhook button
- Delivery logs table

### Assistant Tabs
- Tab switcher (ChatGPT | Claude | Perplexity | Brave)
- Assistant-specific scores
- Tailored recommendations

---

## 🔄 Background Jobs (New)

### Daily Benchmarks Cron
```toml
[triggers]
crons = [
  "0 4 * * *"  # Daily benchmarks at 4 AM UTC
]
```

**Job**: `src/jobs/benchmarksCompute.ts`
- Aggregate all audits by industry
- Compute percentiles (25, 50, 75, 90)
- Store in `benchmarks` table

### Webhook Dispatcher
**Trigger**: Event-driven (on audit complete, new citation, etc.)
**Job**: `src/webhooks/dispatcher.ts`
- Queue webhook deliveries
- Sign payloads with HMAC
- Retry failed deliveries (exponential backoff)

---

## 📊 Success Metrics

### Technical
- Export API response time < 5s
- Benchmark computation time < 10 min
- Webhook delivery success rate > 98%
- Assistant score accuracy validated

### Business
- Export usage > 30% of users
- Benchmarks viewed by > 50% of users
- Webhooks configured by > 20% of teams
- Assistant-specific optimization adopted

---

## 🧪 Testing Plan

### Export APIs
- Test CSV/JSON formatting
- Verify all fields present
- Test large audits (>1000 pages)
- Validate encoding (UTF-8)

### Benchmarks
- Seed test data across industries
- Verify percentile calculations
- Test edge cases (new industry, single audit)
- Validate UI rendering

### Webhooks
- Test HMAC signature verification
- Verify retry logic
- Test delivery logs
- Validate event filtering

### Assistant Tuning
- Compare scores across assistants
- Verify weight application
- Test recommendation relevance
- Validate UI tabs

---

## 🚀 Rollout Plan

### Phase 6.1: Exports (Week 1)
- [ ] Implement CSV/JSON formatters
- [ ] Add export API routes
- [ ] Create download UI
- [ ] Test with 10 audits
- [ ] Deploy to staging

### Phase 6.2: Benchmarks (Week 2)
- [ ] Create benchmarks schema
- [ ] Implement aggregation job
- [ ] Build benchmarks UI
- [ ] Seed initial data
- [ ] Deploy to production

### Phase 6.3: Webhooks (Week 3)
- [ ] Create webhooks schema
- [ ] Implement dispatcher
- [ ] Build admin UI
- [ ] Test delivery + retry
- [ ] Deploy to production

### Phase 6.4: Assistant Tuning (Week 4)
- [ ] Define assistant weights
- [ ] Implement scoring logic
- [ ] Build tabbed UI
- [ ] Validate recommendations
- [ ] Deploy to production

---

## 💰 Estimated Effort

| Feature | Backend | Frontend | Testing | Total |
|---------|---------|----------|---------|-------|
| Exports | 3 days | 2 days | 1 day | 6 days |
| Benchmarks | 4 days | 3 days | 1 day | 8 days |
| Webhooks | 4 days | 2 days | 2 days | 8 days |
| Assistant Tuning | 2 days | 2 days | 1 day | 5 days |
| **Total** | **13 days** | **9 days** | **5 days** | **27 days** |

---

## 📝 Documentation Needed

1. **Export API Guide** - Format specifications, field glossary
2. **Benchmarks Methodology** - How percentiles are calculated
3. **Webhook Integration Guide** - Setup instructions, event catalog
4. **Assistant Optimization Guide** - Per-assistant best practices

---

## 🔄 Dependencies

### External
- None (all Cloudflare native)

### Internal
- Phase Next v2.0.0 stable
- Citation data flowing
- MVA cron executing
- Recommendations generating

---

## 🎯 Open Questions

1. **Export Limits**: Max audit size for export? Pagination?
2. **Benchmark Privacy**: Anonymize peer data?
3. **Webhook Rate Limits**: Max deliveries per minute?
4. **Assistant Weights**: How to determine optimal weights?

---

## 🚦 Go/No-Go Criteria

**Go** if:
- ✅ Phase Next v2.0.0 stable for 72h+
- ✅ No critical bugs in production
- ✅ User feedback positive
- ✅ Citation data populating

**No-Go** if:
- ❌ Phase Next issues unresolved
- ❌ Performance degradation
- ❌ User complaints increasing

---

**Next Steps:**
1. Review this specification
2. Prioritize features (all vs. subset?)
3. Approve for development
4. Create implementation tickets

---

**Version**: 0.1.0 (Draft)  
**Author**: Cursor AI Assistant  
**Date**: October 21, 2025  
**Status**: Awaiting approval

