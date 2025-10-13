# Production Rollout Checklist - Phase Next

## 🚦 Pre-Launch Status: ✅ READY

### ✅ Completed Validations
- [x] **Safety Rails**: Feature flags OFF in production
- [x] **D1 Schema**: All 5 new tables created with indices
- [x] **KV + ENV**: Prompt packs seeded, environment variables configured
- [x] **Migrations**: All migrations applied successfully
- [x] **API Routes**: All 6 endpoints tested and working
- [x] **Detectors**: All 7 detectors implemented and validated
- [x] **Scoring**: New 5-pillar system ready, preserves UI weights
- [x] **UI Components**: All chips and tabs ready for integration
- [x] **Cloudflare Helper**: Configuration generator tested
- [x] **GA4 Helper**: Channel groups and exploration templates ready
- [x] **Monitoring**: Drift monitoring and cleanup scripts created
- [x] **Documentation**: Comprehensive guides and rollback procedures

## 🚀 Rollout Sequence

### Step A: Staging Validation ✅ COMPLETED
- [x] Both flags enabled in staging
- [x] 2 test projects created and tested
- [x] API routes responding correctly
- [x] Database operations working
- [x] No errors in logs

### Step B: Production Beta (E-E-A-T Only)
**Target**: 10% of projects
**Flags**: `FEATURE_EEAT_SCORING=true`, `FEATURE_ASSISTANT_VISIBILITY=false`

**Commands**:
```bash
# Enable E-E-A-T scoring for beta users
wrangler secret put FEATURE_EEAT_SCORING --env production
# Input: true

# Deploy with E-E-A-T enabled
wrangler deploy --env production
```

**Validation**:
- [ ] Monitor scoring stability (±5% vs current model)
- [ ] Check for any performance issues
- [ ] Verify UI chips display correctly
- [ ] Run drift monitoring script

### Step C: Production Beta + (Full Features)
**Target**: Premium/Partner organizations
**Flags**: Both `true`

**Commands**:
```bash
# Enable assistant visibility for premium users
wrangler secret put FEATURE_ASSISTANT_VISIBILITY --env production
# Input: true

# Deploy with full features
wrangler deploy --env production
```

**Validation**:
- [ ] Test assistant connectors with real data
- [ ] Verify MVA calculations
- [ ] Check citation collection
- [ ] Monitor database growth

### Step D: Full Production
**Target**: All projects
**Flags**: Both `true` globally

**Commands**:
```bash
# Deploy to all environments
wrangler deploy --env production
wrangler deploy --env staging
```

**Validation**:
- [ ] All features working for all users
- [ ] Performance within acceptable limits
- [ ] No critical errors in logs
- [ ] User feedback positive

## 📊 Post-Launch Monitoring

### Daily Checks (First 2 Weeks)
- [ ] Run scoring drift monitor
- [ ] Check connector success rates
- [ ] Monitor database growth
- [ ] Review error logs

### Weekly Reviews
- [ ] Analyze MVA trends
- [ ] Review user feedback
- [ ] Check performance metrics
- [ ] Update documentation

### Monthly Planning
- [ ] Set growth targets
- [ ] Plan Phase Next + 1 features
- [ ] Review competitive landscape
- [ ] Optimize resource usage

## 🔧 Maintenance Scripts

### Daily Monitoring
```bash
# Check scoring drift
node scripts/monitor-scoring-drift.js

# Check connector health
wrangler d1 execute optiview_db --command "SELECT assistant, status, COUNT(*) FROM assistant_runs WHERE run_started_at > datetime('now','-1 day') GROUP BY assistant, status;"
```

### Weekly Cleanup
```bash
# Clean old citations
node scripts/cleanup-old-citations.js

# Check database size
wrangler d1 execute optiview_db --command "SELECT COUNT(*) as citations, SUM(LENGTH(raw_payload)) as size_bytes FROM ai_citations;"
```

## 🚨 Emergency Procedures

### Immediate Rollback
```bash
# Run emergency rollback script
node scripts/rollback-phase-next.js
```

### Manual Rollback
1. Set both feature flags to `false`
2. Redeploy immediately
3. Check logs for issues
4. Fix problems in staging
5. Test thoroughly before re-enabling

## 📈 Success Metrics

### Week 1 Targets
- [ ] 0 critical errors
- [ ] <5% scoring drift
- [ ] >95% connector success rate
- [ ] <500MB database growth

### Month 1 Targets
- [ ] 20% of users using new features
- [ ] 10% improvement in average MVA scores
- [ ] 5% increase in AI citations
- [ ] 90% user satisfaction

## 📚 Documentation Updates

### User-Facing
- [ ] Update main documentation
- [ ] Create E-E-A-T guide
- [ ] Add MVA explanation
- [ ] Update FAQ section

### Internal
- [ ] Update API documentation
- [ ] Create troubleshooting guide
- [ ] Document monitoring procedures
- [ ] Update deployment checklist

## 🎯 Next Steps

1. **Execute Step B** (E-E-A-T beta) when ready
2. **Monitor closely** for first 48 hours
3. **Gather feedback** from beta users
4. **Proceed to Step C** after 1 week stable
5. **Full rollout** after 2 weeks stable

---

**Status**: Ready for Step B execution
**Last Updated**: 2025-10-13
**Next Review**: After Step B completion
