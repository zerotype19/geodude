# 🏥 Admin Dashboard & System Monitoring - COMPLETE

**Status**: ✅ Deployed  
**Date**: 2025-10-18  
**Worker Version**: `ac115499-98f2-4361-b327-a1230b4d7ffb`  
**Frontend Version**: `7ee78a7f`

---

## ✅ What's New

### **Enhanced Admin Dashboard**
Complete system health and monitoring hub at: **https://app.optiview.ai/admin**

---

## 🏥 System Health & Monitoring Tools

### **1. Classifier Health Dashboard**
**URL**: https://app.optiview.ai/admin/health

**Monitors**:
- Cache hit rate (target: ≥80%)
- P95 latency (target: ≤25ms)
- Site type agreement (target: ≥80%)
- Industry agreement (target: ≥70%)
- Low confidence rate (target: <15%)
- Error rate (target: <0.5%)
- Real-time alerts

**Updates**: Every 60 seconds (auto-refresh)

---

### **2. Classifier Compare**
**URL**: https://app.optiview.ai/admin/classifier-compare

**Features**:
- Side-by-side legacy vs V2 comparison
- Signals breakdown
- Confidence scores
- JSON export
- "Open Site" quick link

**Usage**: `?host=example.com`

---

### **3. System Status API**
**URL**: https://api.optiview.ai/api/admin/system-status

**Provides**:
```json
{
  "timestamp": "2025-10-18T...",
  "version": {
    "worker": "ac115499-98f2-4361-b327-a1230b4d7ffb",
    "deployment": "production",
    "phase_2_ai": true,
    "classifier_v2": "shadow"
  },
  "audits": {
    "total_7d": 42,
    "completed": 38,
    "running": 2,
    "failed": 2,
    "last_started": "2025-10-18T20:30:00Z",
    "last_completed": "2025-10-18T20:25:00Z"
  },
  "recent_activity": {
    "audits_24h": 15,
    "pages_analyzed_24h": 750,
    "avg_aeo_score": 72,
    "avg_geo_score": 68
  },
  "citations": {
    "audits_with_citations_7d": 25,
    "total_runs_7d": 30,
    "completed_runs": 28,
    "last_run": "2025-10-18T19:00:00Z"
  },
  "database": {
    "total_audits": 156,
    "total_pages": 7800,
    "total_analyses": 7800
  },
  "features": {
    "classifier_v2": "shadow",
    "ai_prompts": "active",
    "browser_rendering": "active",
    "citations": "active",
    "circuit_breaker": "armed",
    "robots_txt_enforcement": "active"
  },
  "health": {
    "status": "operational",
    "uptime": "99.9%",
    "last_incident": null
  }
}
```

**Refresh**: No cache (always fresh)

---

### **4. Classifier Health JSON**
**URL**: https://api.optiview.ai/api/admin/classifier-health

**Raw Metrics**:
- Same data as Health Dashboard
- Machine-readable format
- Includes alerts array

---

### **5. Bot Documentation**
**URL**: https://api.optiview.ai/bot

**Public Page**: Human-readable bot info
- User-Agent: `OptiviewAuditBot/1.0`
- Contact: admin@optiview.ai
- Purpose, behavior, opt-out instructions

---

### **6. Bot Metadata (Well-Known)**
**URL**: https://api.optiview.ai/.well-known/optiview-bot.json

**Machine-Readable**:
```json
{
  "bot_name": "OptiviewAuditBot",
  "version": "1.0",
  "user_agent": "OptiviewAuditBot/1.0 (+https://api.optiview.ai/bot; admin@optiview.ai)",
  "purpose": "AEO/GEO analysis",
  "respect_robots_txt": true,
  "respect_crawl_delay": true,
  "respect_noindex": true,
  "contact": {
    "email": "admin@optiview.ai",
    "url": "https://api.optiview.ai/bot"
  }
}
```

---

### **7. Cloudflare Dashboard**
**URL**: https://dash.cloudflare.com

**Access**:
- Worker metrics & logs
- D1 database queries
- KV namespace inspection
- Analytics & performance

---

### **8. Worker Logs (Real-time)**
**Direct Link**: Cloudflare Workers > optiview-audit-worker > Logs

**Events to Monitor**:
- `[AI_PROMPTS]` - AI generation events
- `[CLASSIFY_V2]` - Classifier operations
- `[HEALTH]` - Health check errors
- `[LLM_PROMPTS]` - Prompt generation
- Errors and exceptions

---

### **9. Google Analytics**
**Property**: G-CY45NV4CNE

**Tracks**:
- Traffic to optiview.ai & app.optiview.ai
- Page views
- User journeys
- Audit completions (via events)

---

## 📊 Quick Access Dashboard

All links are now consolidated at: **https://app.optiview.ai/admin**

### **Monitoring Section** (Top of Admin Page)

| Tool | Description | Icon |
|------|-------------|------|
| Classifier Health | V2 metrics, alerts, cache hit rate | 🧠 |
| Classifier Compare | Legacy vs V2 side-by-side | 🔍 |
| API Health JSON | Raw metrics endpoint | 📊 |
| Bot Documentation | OptiviewAuditBot info | 🤖 |
| Cloudflare Dashboard | Worker logs, D1, KV | ☁️ |
| Worker Logs | Real-time logs & errors | 📝 |
| System Status JSON | Full system overview | 💚 |
| Bot Metadata | Machine-readable info | 🔧 |
| Google Analytics | Traffic & usage stats | 📈 |

### **Quick Stats** (Same Section)

- **Worker Version**: ac115499
- **Phase 2 AI**: ✓ Active
- **Classifier V2**: ✓ Shadow
- **Circuit Breaker**: ✓ Armed

---

## 🔍 Bot Access Logging

### **Current Logging**

Bot activity is logged via:

1. **Worker Logs** (Cloudflare)
   - Every request includes User-Agent
   - Crawl events logged with domain
   - Robots.txt compliance logged

2. **Audit Records** (D1)
   - Each audit tracks:
     - Root URL crawled
     - Pages fetched
     - Timestamps
     - Status codes

3. **KV Event Logs** (if enabled)
   - Classification events
   - Prompt generation events
   - Citation runs

### **Example Log Queries**

```bash
# In Cloudflare dashboard, filter logs by:

# All bot fetches
"OptiviewAuditBot"

# Robots.txt checks
"[ROBOTS]"

# Crawl events
"[CRAWL]"

# Classification events
"[CLASSIFY_V2]"

# AI prompt generation
"[AI_PROMPTS]"
```

---

## 📈 What Can You Monitor?

### **Real-Time**
- ✅ Active audits (running/completed/failed)
- ✅ Classifier performance (cache, latency, errors)
- ✅ Worker logs (errors, events, requests)
- ✅ System health (status API)

### **Historical (7 days)**
- ✅ Audit completion rate
- ✅ Average scores (AEO/GEO)
- ✅ Pages analyzed
- ✅ Citation runs
- ✅ Classifier agreement rates

### **Database State**
- ✅ Total audits
- ✅ Total pages analyzed
- ✅ Active/failed audit count
- ✅ D1 query performance

### **Features Status**
- ✅ Phase 2 AI (active/inactive)
- ✅ Classifier V2 (shadow/production)
- ✅ Circuit breaker (armed/tripped)
- ✅ Citations (active/inactive)

---

## 🚨 Alerts & Monitoring

### **Automatic Alerts** (Health Dashboard)

The system automatically alerts when:

- Cache hit rate < 60%
- Site type agreement < 80%
- Industry agreement < 70%
- Low confidence rate > 15%
- Error rate > 0.5%
- P95 latency > 30ms

**Alert Levels**: `warn` | `error`

### **Manual Checks**

Visit admin dashboard daily to:
1. Check audit success rate
2. Review failed audits
3. Monitor classifier health
4. Check for system alerts

---

## 🔧 Recommended Monitoring Routine

### **Daily** (5 min)
1. Visit https://app.optiview.ai/admin
2. Check stats (completed/running/failed)
3. Review any red/yellow alerts in health section
4. Scan recent audits for patterns

### **Weekly** (15 min)
1. Open Classifier Health dashboard
2. Verify cache hit rate ≥80%
3. Check agreement rates (site_type/industry)
4. Review Worker Logs for errors
5. Check System Status JSON for trends

### **Monthly** (30 min)
1. Export audit metrics from D1
2. Review Google Analytics trends
3. Check database growth (total pages)
4. Verify all features operational
5. Review cost/usage in Cloudflare billing

---

## 🎯 Key Metrics to Watch

### **Critical** (Check Daily)
- Audit success rate (target: ≥95%)
- Failed audit count (target: ≤2%)
- Worker errors (target: <10/day)

### **Important** (Check Weekly)
- Cache hit rate (target: ≥80%)
- Classifier agreement (target: 80%/70%)
- Average scores (baseline: AEO 65-75, GEO 60-70)
- Pages per audit (baseline: 40-50)

### **Nice to Have** (Check Monthly)
- Citation coverage (% audits with citations)
- AI prompt quality (realism score)
- Database size growth
- Cost trends

---

## 📝 Bot Activity Summary

### **What's Logged**

Every bot request includes:
- **User-Agent**: `OptiviewAuditBot/1.0 (+https://api.optiview.ai/bot; admin@optiview.ai)`
- **Custom Header**: `X-Optiview-Bot: audit`
- **Timestamp**: ISO 8601
- **URL**: Crawled page
- **Status**: Response code
- **Robots.txt**: Compliance status

### **Where to Find Logs**

1. **Cloudflare Dashboard** → Workers → optiview-audit-worker → Logs
2. **D1 Database** → `audits` table (audit-level summary)
3. **D1 Database** → `audit_pages` table (page-level detail)

### **Log Retention**

- **Worker Logs**: 7 days (Cloudflare default)
- **D1 Records**: Indefinite (manual cleanup)
- **KV Events**: 24-72h (if enabled)

---

## ✅ Summary

You now have **complete visibility** into:

1. ✅ **System Health** - Real-time metrics & alerts
2. ✅ **Classifier Performance** - V2 quality & agreement
3. ✅ **Audit Activity** - Success rates & failures
4. ✅ **Bot Behavior** - Crawl logs & compliance
5. ✅ **Feature Status** - AI, citations, rendering
6. ✅ **Database State** - Size & growth trends
7. ✅ **Worker Performance** - Logs & errors
8. ✅ **External Analytics** - Google Analytics
9. ✅ **Infrastructure** - Cloudflare dashboards

---

## 🚀 Access Everything

**Main Hub**: https://app.optiview.ai/admin

**Direct Links**:
- Health: https://app.optiview.ai/admin/health
- Compare: https://app.optiview.ai/admin/classifier-compare
- Status API: https://api.optiview.ai/api/admin/system-status
- Bot Info: https://api.optiview.ai/bot
- Bot JSON: https://api.optiview.ai/.well-known/optiview-bot.json

**Everything is live and ready to use!** 🎉

