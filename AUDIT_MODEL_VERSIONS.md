# Audit Model Versions

This document describes the different scoring models used in the Optiview audit system.

## v1.0 - Legacy 4-Pillar Scoring

**Status**: Deprecated (still supported for backward compatibility)

**Pillars**:
- **Crawlability** (40% weight) - 42 max points
- **Structured** (30% weight) - 30 max points  
- **Answerability** (20% weight) - 20 max points
- **Trust** (10% weight) - 10 max points

**Total**: 100% (102 max points)

**Features**:
- Basic SEO analysis
- Simple structured data detection
- Basic content quality metrics
- Legacy issue detection

**Storage**: Scores stored in `audits` table columns (`score_overall`, `score_crawlability`, etc.)

## v2.1 - Enhanced 5-Pillar Scoring

**Status**: Current (enabled via feature flags)

**Pillars**:
- **Crawlability** (30% weight) - 30 max points
- **Structured** (25% weight) - 25 max points
- **Answerability** (20% weight) - 20 max points
- **Trust** (15% weight) - 15 max points
- **Visibility** (10% weight) - 10 max points

**Total**: 100% (100 max points)

**Features**:
- Enhanced EEAT (Experience, Expertise, Authoritativeness, Trustworthiness) analysis
- FAQ schema detection and prioritization
- Author and date coverage analysis
- Canonical URL analysis
- Robots meta analysis
- AI visibility scoring
- Advanced issue detection with v2.1 rules
- Sitemap-first URL collection

**Storage**: 
- Primary: `audit_scores` table with `score_model_version='v2.1'`
- Legacy: Also stored in `audits` table for backward compatibility

## Feature Flags

### `FF_AUDIT_V21_SCORING`
- **Purpose**: Enable/disable v2.1 scoring system
- **Values**: `true` | `false`
- **Default**: `false` (v1.0)
- **Override**: KV store `flags/audit_v21_scoring`

### `FF_CRAWL_SITEMAP_DEPTH1`
- **Purpose**: Enable sitemap-first URL collection with depth ≤1 filtering
- **Values**: `true` | `false`
- **Default**: `false`
- **Override**: KV store `flags/crawl_sitemap_depth1`

## Migration Strategy

### Phase 1: Parallel Operation
- v2.1 system runs alongside v1.0
- Feature flags control which system is used
- Both systems write to their respective storage locations
- API returns v2.1 scores when available, falls back to v1.0

### Phase 2: Gradual Rollout
- Enable v2.1 for new audits only
- Monitor scoring accuracy and performance
- Collect benchmark data comparing v1.0 vs v2.1

### Phase 3: Full Migration
- Enable v2.1 for all audits
- Backfill existing audits with v2.1 analysis
- Deprecate v1.0 system (maintain backward compatibility)

## API Response Format

### v1.0 Response
```json
{
  "scores": {
    "total": 85,
    "crawlability": 35,
    "structured": 25,
    "answerability": 15,
    "trust": 10,
    "score_model_version": "v1.0"
  },
  "score_overall": 85,
  "score_crawlability": 83,
  "score_structured": 83,
  "score_answerability": 75,
  "score_trust": 100
}
```

### v2.1 Response
```json
{
  "scores": {
    "total": 78,
    "crawlability": 24,
    "structured": 20,
    "answerability": 16,
    "trust": 12,
    "visibility": 6,
    "crawlabilityPct": 80,
    "structuredPct": 80,
    "answerabilityPct": 80,
    "trustPct": 80,
    "visibilityPct": 60,
    "score_model_version": "v2.1"
  },
  "score_overall": 78,
  "score_crawlability": 80,
  "score_structured": 80,
  "score_answerability": 80,
  "score_trust": 80
}
```

## Testing and Validation

### Scripts Available
- `scripts/test_v21_audit.ts` - Test single audit
- `scripts/batch_recompute_v21.ts` - Batch recompute scores
- `scripts/batch_reanalyze_v21.ts` - Batch re-analyze HTML
- `scripts/compare_v1_v21.ts` - Compare v1.0 vs v2.1 scores
- `scripts/validate_v21_deployment.ts` - Comprehensive validation

### Validation Checklist
- [ ] Feature flags working correctly
- [ ] API endpoints returning v2.1 scores
- [ ] UI showing 5-card layout for v2.1 audits
- [ ] Score calculations accurate
- [ ] CSV exports working for benchmarking
- [ ] No regression in existing functionality

## Rollback Plan

If issues are detected with v2.1:

1. **Immediate**: Set `FF_AUDIT_V21_SCORING=false` in KV store
2. **API**: Will immediately fall back to v1.0 scoring
3. **UI**: Will show 4-card layout for all audits
4. **Data**: No data loss - v1.0 scores remain intact

## Performance Impact

### v2.1 Enhancements
- **Analysis**: ~20% slower due to enhanced EEAT analysis
- **Storage**: ~15% more data due to additional analysis fields
- **API**: Minimal impact - scores cached after computation
- **UI**: No impact - conditional rendering based on data availability

### Optimization Strategies
- Lazy loading of visibility data
- Caching of computed scores
- Batch processing for backfill operations
- Feature flags for gradual rollout

## Future Versions

### v2.2 (Planned)
- Enhanced visibility scoring with more AI providers
- Advanced EEAT analysis with author authority scoring
- Real-time score updates during audit
- Machine learning-based score calibration

### v3.0 (Future)
- Multi-language support
- Industry-specific scoring models
- Predictive scoring based on historical data
- Advanced competitor analysis integration
