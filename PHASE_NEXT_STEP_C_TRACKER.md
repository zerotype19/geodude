# Phase Next: Step C Rollout Tracker

**Issue**: Use the draft PR to track code; this document tracks go/no-go after 48h watch.

## Overview

This tracks the Phase Next Step C rollout (Assistant Visibility) which is currently gated behind feature flags and requires 48-hour validation of Step B (E-E-A-T scoring).

## Current Status

- **Step B (E-E-A-T)**: ✅ Active and monitoring
- **Step C (Visibility)**: 🔒 Gated behind `FEATURE_ASSISTANT_VISIBILITY=false`
- **48h Validation**: ⏳ In progress (started 2025-10-13 15:25 UTC)

## Key Files

- **Draft PR**: `feature/assistant-visibility-rollout` → `main`
- **Checklist**: `STEP_C_ROLLOUT_CHECKLIST.md`
- **Monitoring**: `scripts/final-monitoring.js`, `scripts/monitor-scoring-drift.js`

## Rollout Gates

**Do not merge PR until all gates are GREEN:**

1. **48h Step-B metrics**: drift ≤ 5%, EEAT errors < 1%, runtime ±10%, CPU < +15%, D1 growth < 4MB
2. **Infrastructure**: Allowlist KV set, prompt packs seeded, retention applied
3. **Feature Flags**: `FEATURE_ASSISTANT_VISIBILITY=true` (after green light)
4. **Testing**: Manual visibility run succeeds, MVA metrics populated, UI works
5. **Monitoring**: All scripts operational, rollback tested, alerts configured

## Next Actions

1. **Continue 48h monitoring** (every 6h)
2. **After 48h**: Evaluate all gates
3. **If GREEN**: Enable `FEATURE_ASSISTANT_VISIBILITY=true` and deploy
4. **If RED**: Investigate and fix issues before proceeding

## Emergency Rollback

```bash
wrangler secrets put FEATURE_ASSISTANT_VISIBILITY false
wrangler secrets put FEATURE_EEAT_SCORING false
wrangler deploy
```

## Team Notes

- **Do not merge** the draft PR until all rollout gates are green
- **Monitor** the 48-hour validation period closely
- **Test** rollback procedures before enabling Step C
- **Document** any issues found during validation
