# Phase Next - Complete File Listing

All files created or modified for Phase 1 Foundation implementation.

## New Files Created (14 total)

### Database & Migrations
1. `packages/audit-worker/migrations/0013_phase_next_foundation.sql`
   - Comprehensive migration with 20+ columns, 2 tables, 15+ indexes

### Scoring System
2. `packages/audit-worker/src/scoring/criteria.ts`
   - CRITERIA registry with 21 checks, 6 categories, 5 E-E-A-T pillars
   
3. `packages/audit-worker/src/scoring/rollups.ts`
   - Category & E-E-A-T rollup calculations
   - Top failing checks prioritization

### Migration Scripts
4. `packages/audit-worker/scripts/upsert-criteria.ts`
   - Populate audit_criteria from CRITERIA registry
   
5. `packages/audit-worker/scripts/backfill-rollups.ts`
   - Compute rollups for existing audits
   
6. `packages/audit-worker/scripts/migrate-citations.ts`
   - Migrate old citations to new unified table

### Analysis Modules (New Checks)
7. `packages/audit-worker/src/analysis/qaScaffold.ts`
   - A12: Q&A Scaffold detector
   
8. `packages/audit-worker/src/analysis/botAccess.ts`
   - C1: AI Bot Access checker
   
9. `packages/audit-worker/src/analysis/entityGraph.ts`
   - G11: Entity Graph completeness analyzer
   
10. `packages/audit-worker/src/analysis/perf.ts`
    - Performance metrics (LCP/CLS/FID) collection

### LLM Analysis
11. `packages/audit-worker/src/llm/topicDepth.ts`
    - G12: Topic Depth / Semantic Coverage analyzer

### Vectorize Integration
12. `packages/audit-worker/src/vectorize/embed.ts`
    - Embedding generation via Workers AI
    - Vectorize upsert/query utilities
    
13. `packages/audit-worker/src/vectorize/index.ts`
    - Vectorize index management
    - Configuration and setup instructions

### Documentation
14. `PHASE_NEXT_PROGRESS.md`
    - Implementation progress tracking
    
15. `PHASE_NEXT_DEPLOYMENT.md`
    - Step-by-step deployment guide
    
16. `PHASE_NEXT_API_CONTRACTS.md`
    - Complete API data structures and contracts
    
17. `PHASE_NEXT_FILES.md`
    - This file (complete file listing)

---

## File Structure

```
geodude/
├── PHASE_NEXT_PROGRESS.md
├── PHASE_NEXT_DEPLOYMENT.md
├── PHASE_NEXT_API_CONTRACTS.md
├── PHASE_NEXT_FILES.md
└── packages/
    └── audit-worker/
        ├── migrations/
        │   └── 0013_phase_next_foundation.sql
        ├── src/
        │   ├── scoring/
        │   │   ├── criteria.ts          (NEW)
        │   │   └── rollups.ts           (NEW)
        │   ├── analysis/
        │   │   ├── qaScaffold.ts        (NEW)
        │   │   ├── botAccess.ts         (NEW)
        │   │   ├── entityGraph.ts       (NEW)
        │   │   └── perf.ts              (NEW)
        │   ├── llm/
        │   │   └── topicDepth.ts        (NEW)
        │   └── vectorize/
        │       ├── embed.ts             (NEW)
        │       └── index.ts             (NEW)
        └── scripts/
            ├── upsert-criteria.ts       (NEW)
            ├── backfill-rollups.ts      (NEW)
            └── migrate-citations.ts     (NEW)
```

---

## Lines of Code by Component

| Component | Files | LOC | Purpose |
|-----------|-------|-----|---------|
| Database Schema | 1 | ~350 | Migrations, tables, indexes |
| Scoring System | 2 | ~600 | CRITERIA registry, rollups |
| Migration Scripts | 3 | ~450 | Data migration utilities |
| Analysis Modules | 4 | ~1,200 | New check implementations |
| LLM Analysis | 1 | ~300 | Topic depth analyzer |
| Vectorize | 2 | ~400 | Embedding infrastructure |
| Documentation | 4 | ~1,500 | Deployment & API guides |
| **Total** | **17** | **~4,800** | **Complete Phase 1** |

---

## Import Paths

For use in existing code:

```typescript
// Scoring
import { CRITERIA, CRITERIA_BY_ID, getCriteriaForCategory } from './scoring/criteria';
import { computeCategoryRollups, computeEEATRollups, getTopFailingChecks } from './scoring/rollups';

// Analysis (New Checks)
import { detectQAScaffold } from './analysis/qaScaffold';
import { checkBotAccess } from './analysis/botAccess';
import { buildEntityGraph, analyzeEntityGraph } from './analysis/entityGraph';
import { capturePerformanceMetrics, selectPagesForPerfTesting } from './analysis/perf';

// LLM
import { analyzeTopicDepth, generateSeedTerms } from './llm/topicDepth';

// Vectorize
import { 
  embedText, 
  generatePageSummary, 
  upsertEmbedding, 
  queryNearestNeighbors,
  isVectorizeEnabled 
} from './vectorize';

// Scripts (for admin endpoints)
import { upsertCriteria } from './scripts/upsert-criteria';
import { backfillRollups } from './scripts/backfill-rollups';
import { migrateCitations, updateCitationAggregates } from './scripts/migrate-citations';
```

---

## Dependencies

No new external dependencies required! All implementations use:

- Built-in Node.js APIs
- Cloudflare Workers APIs
- Workers AI (existing binding)
- Vectorize (new binding, optional)
- D1 Database (existing binding)
- KV (existing binding)

---

## Testing Files

Suggested test files to create (not yet implemented):

```
packages/audit-worker/
└── tests/
    ├── criteria.spec.ts
    ├── rollups.spec.ts
    ├── qaScaffold.spec.ts
    ├── botAccess.spec.ts
    ├── entityGraph.spec.ts
    ├── topicDepth.spec.ts
    ├── perf.spec.ts
    └── vectorize.spec.ts
```

---

## Configuration Files to Update

### wrangler.toml

Add Vectorize binding:

```toml
[[vectorize]]
binding = "VECTORIZE"
index_name = "optiview-page-embeddings"
```

### Environment Variables

Add feature flags:

```bash
PHASE_NEXT_ENABLED=true
PHASE_NEXT_SCORING=false
VECTORIZE_ENABLED=true
```

---

## Next Phase Files (Phase 2 - UI)

Planned files for Phase 2:

```
apps/app/src/
├── routes/
│   └── score-guide/
│       ├── index.tsx              (MODIFY)
│       ├── [slug].tsx             (NEW)
│       └── components/
│           ├── CategorySection.tsx    (NEW)
│           ├── CheckCard.tsx          (NEW)
│           └── ViewToggle.tsx         (NEW)
└── components/
    ├── CategoryRollups.tsx        (NEW)
    ├── EEATRollups.tsx           (NEW)
    ├── PreviewBadge.tsx          (NEW)
    └── FixFirst.tsx              (NEW)
```

---

**Phase 1 Complete: 17 files created, ~4,800 lines of code**
