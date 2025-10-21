# Phase Next Implementation Progress

## ✅ Completed (Phase 1 - Foundation)

### Database & Schema
- ✅ **D1 Migration** (`0013_phase_next_foundation.sql`)
  - Added category, eeat_pillar, impact_level to audit_criteria
  - Added LCP/CLS/FID performance columns
  - Added page_type classification
  - Added ai_bot_access_json and render_parity
  - Created unified `citations` table
  - Created `mva_metrics` table
  - Added citation aggregates to audit_pages (is_cited, citation_count, assistants_citing)
  - Added recommendation fields (nearest_cited_url, recommendation_json)

### Scoring System
- ✅ **CRITERIA Registry** (`src/scoring/criteria.ts`)
  - 21 checks with new metadata (A1-A12, G1-G12, C1)
  - 6 Practical Categories
  - 5 E-E-A-T Pillars
  - Impact levels (High/Medium/Low)
  - Plain-language, outcome-led descriptions
  - Shadow mode flags for new checks (A12, C1, G11, G12)

- ✅ **Rollup Calculations** (`src/scoring/rollups.ts`)
  - computeCategoryRollups() - 6 category scores
  - computeEEATRollups() - 5 E-E-A-T scores
  - getTopFailingChecks() - prioritized by impact + weight
  - formatRollupsForStorage() - JSON format for metadata

### Migration & Backfill Scripts
- ✅ **Upsert Criteria** (`scripts/upsert-criteria.ts`)
  - Populates audit_criteria table from CRITERIA registry
  
- ✅ **Backfill Rollups** (`scripts/backfill-rollups.ts`)
  - Computes category & E-E-A-T rollups for existing audits
  
- ✅ **Migrate Citations** (`scripts/migrate-citations.ts`)
  - Migrates from ai_citations → citations table
  - Updates citation aggregates on audit_pages

---

## 🚧 In Progress (Next Steps)

### New Check Implementations (Shadow Mode)
- ⏳ **A12: Q&A Scaffold Detector**
  - Detect FAQ schema, Q&A blocks, dl elements
  - Score based on presence and quality
  
- ⏳ **C1: AI Bot Access Checker**
  - Parse robots.txt for GPTBot, Claude-Web, Perplexity-Web
  - Test with different user agents
  - Store per-bot results in ai_bot_access_json
  
- ⏳ **G11: Entity Graph Completeness**
  - Analyze internal link graph
  - Detect orphaned entities
  - Score based on connectivity
  
- ⏳ **G12: Topic Depth / Semantic Coverage**
  - Analyze term coverage and semantic density
  - Compare against topic lexicon

### Performance Collection
- ⏳ **CWV Metrics via Browser Rendering**
  - Collect LCP, CLS, FID
  - Store in audit_page_analysis
  - Scope: all pages if ≤50, top 100 if >50

### Vectorize Integration
- ⏳ **Embeddings Infrastructure**
  - Create optiview-page-embeddings index
  - embedPageSummary() using Workers AI (@cf/baai/bge-base-en-v1.5)
  - Index on crawl finalization

### API Updates
- ⏳ **Extend Audit Endpoints**
  - Add category_scores, eeat_scores to /api/audits/:id/pages
  - Add is_cited, citation_count, assistants_citing
  - New endpoint: /api/audits/:id/citations/summary (MVA)
  - New endpoint: /api/pages/:id/recommendations

---

## 📋 TODO (Remaining Phases)

### Phase 2 - UI Refresh
- Score Guide redesign with practical categories
- Audit Detail with category/E-E-A-T rollups
- Business/Technical toggle (global + persistent)
- Cited pages filter and badges

### Phase 3 - Citations & MVA
- Citation ETL post-ingest job
- MVA computation (7d/30d windows)
- Visibility tab with trends and competitors
- Proof drawer integration

### Phase 4 - Learning Loop
- Nearest cited page matching via Vectorize
- Recommendation diff engine
- "Learn from Success" panel
- Assistant-specific tips

### Phase 5 - Production Rollout
- Feature flags: PHASE_NEXT_ENABLED, PHASE_NEXT_SCORING
- QA on 5+ diverse domains
- Observability and logging
- Release notes and documentation

---

## 🎯 Key Decisions Locked

1. **Backward Compatibility**: Coexist with checksV2.ts, backfill existing data
2. **Shadow Mode**: A12, C1, G11, G12 computed but don't affect scores until flag flip
3. **Citations**: Unified table with project_id + audit_id, migrate from old tables
4. **MVA Timing**: After each citation run + daily cron
5. **UI Priority**: Category rollups (default), E-E-A-T (tab), Raw AEO/GEO (tab)
6. **Vectorize**: Workers AI @cf/baai/bge-base-en-v1.5, embed title+h1+first_paragraph
7. **Performance**: Browser Rendering for all if ≤50 pages, top 100 if >50
8. **Toggle**: Global + persistent via localStorage

---

## 📊 Implementation Stats

- **Files Created**: 6
- **Lines of Code**: ~1,200
- **Database Changes**: 20+ new columns, 2 new tables
- **New Checks**: 4 (A12, C1, G11, G12)
- **Rollup Types**: 2 (Category, E-E-A-T)
- **Categories**: 6 practical
- **E-E-A-T Pillars**: 5

---

**Last Updated**: $(date +%Y-%m-%d)
**Status**: Phase 1 Foundation - 60% Complete
**Next**: Implement shadow mode checks (A12, C1, G11, G12)

