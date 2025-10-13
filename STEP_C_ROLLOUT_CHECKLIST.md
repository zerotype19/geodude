# Step C Rollout Checklist

**⚠️ DO NOT MERGE until all gates are GREEN ⚠️**

## Rollout Gates (must be GREEN before merge):

- [ ] **48h Step-B metrics**: 
  - [ ] Drift ≤ 5% vs legacy scoring
  - [ ] EEAT errors < 1%
  - [ ] Runtime within ±10% baseline
  - [ ] CPU < +15% vs baseline
  - [ ] D1 growth < 4MB over 48h

- [ ] **Infrastructure**:
  - [ ] Allowlist KV set for premium projects (`enabled_projects`)
  - [ ] Prompt packs seeded (`visibility_prompts`)
  - [ ] Database retention applied (90-day cleanup)

- [ ] **Feature Flags**:
  - [ ] `FEATURE_ASSISTANT_VISIBILITY=true` in prod secrets (after green light)
  - [ ] `FEATURE_EEAT_SCORING=true` (already enabled)

- [ ] **Testing**:
  - [ ] Manual visibility run succeeds (citations + screenshots recorded)
  - [ ] MVA metrics populated
  - [ ] UI shows Visibility tab only for allowlisted projects
  - [ ] No console errors in browser

- [ ] **Monitoring**:
  - [ ] All monitoring scripts operational
  - [ ] Rollback procedures tested
  - [ ] Alert thresholds configured

## Current Status

- ✅ **Step B**: E-E-A-T scoring active and monitoring
- ⏳ **48h Validation**: In progress (started 2025-10-13)
- 🔒 **Step C**: Gated behind `FEATURE_ASSISTANT_VISIBILITY=false`
- 📊 **Next Check**: Run monitoring every 6 hours

## Rollback Commands (if needed)

```bash
# Set FEATURE_ASSISTANT_VISIBILITY=false in wrangler.toml (prod env)
# Then deploy
wrangler deploy

# Note: Flags are ENV variables, not secrets
# FEATURE_EEAT_SCORING can stay true (additive migrations)
```

## Monitoring Commands

```bash
# Health check
node scripts/final-monitoring.js

# Drift check  
node scripts/monitor-scoring-drift.js

# Generate summary
node scripts/collect-eeat-summary.js --since 24h
```
