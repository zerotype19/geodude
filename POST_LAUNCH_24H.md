# 📊 Post-Launch 24-Hour Verification

## Quick Reference Card for Day 1

Run these commands at specific intervals to ensure smooth launch.

---

## ⏰ Timeline & Checkpoints

### Hour 0 (Launch Moment)

**Immediately after `./FINAL_LAUNCH.sh` completes:**

```bash
# Verify launch success
curl -s https://api.optiview.ai/status | jq '{status, latest_audit: .latest_audit.completed_at, budget: .citations_budget}'

# Expected output:
{
  "status": "ok",
  "latest_audit": "2025-01-09T...",
  "budget": {
    "used": 3,
    "remaining": 197,
    "max": 200
  }
}
```

**✅ Success Criteria:**
- `status: "ok"`
- `budget.remaining: 197-200`
- `latest_audit: recent timestamp`

**📸 Screenshot this for your records!**

---

### Hour 1 (Initial Monitoring)

**Run every 15-30 minutes for first hour:**

```bash
# Status check
curl -s https://api.optiview.ai/status | jq .status

# Budget check
curl -s https://api.optiview.ai/v1/citations/budget | jq '{used, remaining}'

# (Optional) Watch logs live
npx wrangler tail geodude-api --format=json | jq -r 'select(.out).out' | grep -E "audit|brave|error"
```

**✅ Success Criteria:**
- No errors in logs
- Budget used < 10
- Status always "ok"

**🚨 Alert Triggers:**
- Any 500 errors
- Budget remaining < 150
- Status != "ok"

---

### Hour 4 (First Major Checkpoint)

**Run full health check:**

```bash
# Full status
curl -s https://api.optiview.ai/status | jq

# Budget trend
curl -s https://api.optiview.ai/v1/citations/budget | jq

# Admin metrics
curl -s -u ops:PASSWORD https://api.optiview.ai/v1/admin/metrics | jq

# CI status
open https://github.com/zerotype19/geodude/actions
```

**✅ Success Criteria:**
- Budget used: 5-15 (light usage)
- No failed audits
- CI still green
- Cache hits starting to show in logs

**📊 Record these metrics:**
- Budget used: _____
- Audits completed: _____
- Average response time: _____
- Cache hit rate: _____%

---

### Hour 8 (Mid-Day Check)

**Quick verification:**

```bash
# One-liner health check
curl -s https://api.optiview.ai/status | jq '{status, budget: .citations_budget.remaining}'

# Test fresh audit
AID=$(curl -s -X POST https://api.optiview.ai/v1/audits/start \
  -H "x-api-key: prj_live_8c5e1556810d52f8d5e8b179" \
  -H "content-type: application/json" \
  -d '{"property_id":"prop_demo"}' | jq -r '.id')

echo "Test audit: https://app.optiview.ai/a/$AID"

# Verify citations load
curl -s "https://api.optiview.ai/v1/audits/$AID/citations" | jq '.items | length'
```

**✅ Success Criteria:**
- Budget remaining > 140
- Test audit completes in < 20 seconds
- Citations return (even if empty)
- Share link loads instantly

---

### Hour 12 (Evening Check)

**Review daily trends:**

```bash
# Budget consumption
curl -s https://api.optiview.ai/v1/citations/budget | jq

# Recent audit history
npx wrangler d1 execute optiview_db --remote \
  --command "SELECT COUNT(*) as total, status FROM audits WHERE created_at > $(date -u -d '12 hours ago' +%s) GROUP BY status"
```

**✅ Success Criteria:**
- Budget used: 15-40 (moderate usage)
- All audits status: "completed"
- No "failed" or "error" statuses
- System stable and responsive

**📝 Document any issues:**
- Errors encountered: _____
- Fixes applied: _____
- Performance notes: _____

---

### Hour 24 (End of Day 1)

**Full system verification:**

```bash
# Final health report
curl -s https://api.optiview.ai/status | jq

# Budget summary
curl -s https://api.optiview.ai/v1/citations/budget | jq

# Check for backup (if after 03:00 UTC)
npx wrangler r2 object list geodude-backups --prefix backups/$(date -u +%F)/

# 24-hour metrics
curl -s -u ops:PASSWORD https://api.optiview.ai/v1/admin/metrics | jq
```

**✅ Day 1 Success Criteria:**

**Availability:**
- ✅ No downtime reported
- ✅ Status endpoint always returned "ok"
- ✅ All audits completed successfully

**Performance:**
- ✅ Average audit time: < 20 seconds
- ✅ Citations load: < 2 seconds
- ✅ Share links load: < 3 seconds

**Reliability:**
- ✅ Budget used: 30-60 (healthy usage)
- ✅ Cache hit rate: 50-80% (building up)
- ✅ Backup present: 4 files (if after 03:00 UTC)
- ✅ CI green: All checks passing

**📋 Day 1 Completion Checklist:**
- [ ] No P0/P1 incidents
- [ ] Budget consumption reasonable (< 100)
- [ ] All audits succeeded
- [ ] CI pipeline green
- [ ] Backup present (if applicable)
- [ ] Demo audit created and shared
- [ ] Team notified of launch
- [ ] Monitoring plan established

---

## 🚨 Alert Thresholds (Set These Up)

### Critical (Immediate Action)
- ❌ Status != "ok" for > 5 minutes
- ❌ All audits failing
- ❌ API returning 500 errors
- ❌ Budget exhausted (remaining = 0)

### High (Action within 1 hour)
- ⚠️ Budget remaining < 20
- ⚠️ Backup missing after 04:00 UTC
- ⚠️ > 10% of audits failing
- ⚠️ Cache hit rate < 20%

### Medium (Action within 4 hours)
- ⚠️ Budget used > 100 in 24h
- ⚠️ Average audit time > 30 seconds
- ⚠️ CI failing on main branch
- ⚠️ Status page not updating

---

## 📊 Metrics to Track

### Day 1 KPIs

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Uptime | 100% | ___% | ☐ |
| Audits completed | All | ___/__ | ☐ |
| Budget used | < 100 | ___ | ☐ |
| Avg audit time | < 20s | ___s | ☐ |
| Cache hit rate | > 50% | ___% | ☐ |
| Errors logged | 0 | ___ | ☐ |
| Backup success | 100% | ___% | ☐ |

### User Activity (If Applicable)

| Activity | Count |
|----------|-------|
| Projects created | ___ |
| Properties added | ___ |
| Audits run (total) | ___ |
| Share links accessed | ___ |
| Citations viewed | ___ |

---

## 🎯 Common Day 1 Issues & Quick Fixes

### Issue: Budget exhausted before end of day
**Symptom:** `remaining: 0`, 429 errors
**Fix:**
```bash
cd packages/api-worker
# Edit wrangler.toml: CITATIONS_DAILY_BUDGET = "400"
pnpm deploy
```
**Timeline:** 30 seconds

---

### Issue: Backup missing after 04:00 UTC
**Symptom:** Empty R2 folder for today
**Fix:**
```bash
# Check cron logs
npx wrangler tail geodude-api | grep backup

# Manual backup if needed
npx wrangler d1 export optiview_db --remote --output=manual_$(date +%F).sql
```
**Timeline:** 2 minutes

---

### Issue: Slow citations (> 5 seconds)
**Symptom:** First audit slow, subsequent fast
**Explanation:** Expected! Cache warming in progress
**Fix:** No action needed (will improve by Day 2)
**Timeline:** N/A

---

### Issue: CI failing on main
**Symptom:** Red X on GitHub Actions
**Fix:**
```bash
# Check what failed
open https://github.com/zerotype19/geodude/actions

# Common fix: smoke test expecting different data
# Review test expectations vs actual API responses
```
**Timeline:** 5-15 minutes

---

## 📝 Day 1 Report Template

**Copy this and fill out at end of Day 1:**

```markdown
# Day 1 Launch Report - [DATE]

## Summary
- Launch time: [HH:MM UTC]
- Total uptime: [XX.X%]
- Total audits: [XXX]
- Budget used: [XX/200]

## Highlights
- ✅ [What went well]
- ✅ [What went well]
- ✅ [What went well]

## Issues Encountered
- ⚠️ [Issue 1] - [Resolution]
- ⚠️ [Issue 2] - [Resolution]

## Metrics
- Average audit time: [XX.Xs]
- Cache hit rate: [XX%]
- API availability: [XX.X%]
- Backup success: [Yes/No]

## Next Steps
- [ ] Continue monitoring through Week 1
- [ ] Adjust budget if needed
- [ ] Share demo with stakeholders
- [ ] Document any lessons learned

## Status
✅ Day 1 Complete - System Stable
```

---

## 🎉 Day 1 Success Celebration

**If all checks pass:**

1. ✅ Update team/stakeholders: "Optiview is live and stable!"
2. 🎬 Record demo using DEMO_FLOW.md
3. 🔗 Share demo audit link
4. 📊 Post metrics summary (internal)
5. 🍾 Celebrate! You shipped production SaaS!

---

## 🗓️ Week 1 Schedule

After Day 1, continue monitoring with reduced frequency:

**Day 2-6:**
- Morning: Quick status check (2 min)
- Evening: Budget + metrics review (2 min)

**Day 7 (Monday):**
- 07:00 UTC: Verify weekly audit ran
- Check cache warming completed
- Review full week metrics
- See: `docs/week-1-ops-plan.md`

---

**Last Updated:** 2025-01-09  
**Version:** v1.0.0-beta  
**Owner:** ops@optiview.ai

