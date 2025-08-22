# Filter Parity Verification Checklist

This document provides a comprehensive verification process to ensure that the Events and Content pages maintain perfect semantic parity in their filtering capabilities.

## 🔧 Quick Start

```bash
# Lightweight spot check (3 basic tests)
./scripts/test-filter-parity-quick.sh

# Full parity test suite (8 comprehensive tests)  
./scripts/verify-filter-parity.sh [staging|prod] [project_id]
```

**Note**: Tests can be run ad-hoc by engineers; no automated GitHub Actions pipeline is configured.

## 🎯 Overview

**Goal**: Verify that selecting the same filters on Events and Content pages yields reconcilable data where:
- Events total (chart count) ≈ sum of "Traffic (window)" across Content rows
- AI Referrals sum = Events total when filtering for `human_via_ai` class
- All filter combinations work identically on both pages

## 🚀 Pre-Verification Setup

1. **Environment**: Ensure you're testing on the correct environment (staging/prod)
2. **Project**: Use a project with sufficient data for meaningful testing
3. **Browser**: Clear cache and use incognito/private mode
4. **Time**: Allow 2-3 minutes between filter changes for data consistency

## ✅ Manual Verification Checklist

### **1. Default Parity Test**
**Setup**: Both pages set to 24h, All classes, All AI sources, All bots

**Actions**:
- [ ] Navigate to `/events` → set 24h, All classes, All sources, All bots
- [ ] Note the total events count from the chart
- [ ] Navigate to `/content` → set 24h, All classes, All sources, All bots
- [ ] Page through all Content rows (if paginated)
- [ ] Sum all "Traffic (24h)" values

**Expected Result**: 
```
Events total (chart) ≈ Σ Content Traffic (24h) across all rows
Tolerance: ±1% or ±5 events (whichever is higher)
```

### **2. Human via AI Slice Test**
**Setup**: Traffic Class → Human via AI only

**Actions**:
- [ ] On `/events` → select "Human via AI" only
- [ ] Note the total events count
- [ ] On `/content` → select "Human via AI" only
- [ ] Sum all "AI Referrals" values across visible rows

**Expected Result**:
```
Content AI Referrals sum = Events total events
(Since we're filtering for human_via_ai class only)
```

### **3. Per-Source Slice Test**
**Setup**: Select specific AI sources

**Actions**:
- [ ] On `/events` → select AI Source "Google" only
- [ ] Note the total events count
- [ ] On `/content` → select AI Source "Google" only
- [ ] Verify "Top Sources" column shows only Google
- [ ] Sum all "Traffic (24h)" values

**Expected Result**:
```
Events total = Content Traffic (24h) sum
Top Sources column displays only "Google"
```

**Repeat for**:
- [ ] Perplexity only
- [ ] Microsoft Bing only
- [ ] Multiple sources (Google + Perplexity)

### **4. Crawler Slice Test**
**Setup**: Traffic Class → Crawler, Bot Category → AI Training

**Actions**:
- [ ] On `/events` → select "Crawler" + "AI Training"
- [ ] Note the total events count
- [ ] On `/content` → select "Crawler" + "AI Training"
- [ ] Sum all "Traffic (24h)" values
- [ ] Verify all "AI Referrals" = 0 (crawlers aren't AI referrals)

**Expected Result**:
```
Events total = Content Traffic (24h) sum
All AI Referrals = 0 (crawlers don't count as AI referrals)
```

### **5. AI Traffic Only Toggle Test**
**Setup**: Human via AI + Perplexity selected

**Actions**:
- [ ] On `/content` → select "Human via AI" + "Perplexity"
- [ ] Note total rows without AI Traffic Only
- [ ] Toggle "AI Traffic Only" ON
- [ ] Verify every visible row has AI Referrals > 0
- [ ] Toggle "AI Traffic Only" OFF
- [ ] Verify zero-AI rows reappear

**Expected Result**:
```
AI Traffic Only ON: Every row has AI Referrals > 0
AI Traffic Only OFF: Zero-AI rows visible again
Total rows with AI Only ≤ Total rows without AI Only
```

### **6. Search Filter Test**
**Setup**: Enter specific URL substring

**Actions**:
- [ ] On `/events` → search for a specific URL substring (e.g., "awards")
- [ ] Note the filtered events count
- [ ] On `/content` → search for the same URL substring
- [ ] Verify the same subset of content appears
- [ ] Sum "Traffic (24h)" across filtered rows

**Expected Result**:
```
Same subset of content/events appears on both pages
Content Traffic (24h) sum ≈ Events filtered count
```

### **7. Window Label Test**
**Setup**: Switch between time windows

**Actions**:
- [ ] On `/content` → switch to 15m window
- [ ] Verify column header shows "Traffic (15m)"
- [ ] Switch to 7d window
- [ ] Verify column header shows "Traffic (7d)"
- [ ] Verify values change appropriately for each window

**Expected Result**:
```
Column header dynamically updates: "Traffic (15m)", "Traffic (24h)", "Traffic (7d)"
Values change appropriately for each time window
```

## 🔧 API Verification (Copy-Paste Curls)

### **Test Case 1: Human via AI + Perplexity (24h)**

```bash
# Events slice
curl "$API/events/summary?project_id=$PROJECT_ID&window=24h&traffic_class=human_via_ai&ai_source=perplexity"

# Content slice  
curl "$API/content?project_id=$PROJECT_ID&window=24h&q=&type=&aiOnly=false&page=1&pageSize=50&class=human_via_ai&source=perplexity"
```

**Expected**:
```
Sum(traffic_count) ≈ Events total
Sum(ai_referrals) = Events total (since class is human_via_ai)
```

### **Test Case 2: Crawler + AI Training (24h)**

```bash
# Events slice
curl "$API/events/summary?project_id=$PROJECT_ID&window=24h&traffic_class=crawler&bot_category=ai_training"

# Content slice
curl "$API/content?project_id=$PROJECT_ID&window=24h&q=&type=&aiOnly=false&page=1&pageSize=50&class=crawler&botCategory=ai_training"
```

**Expected**:
```
Sum(traffic_count) ≈ Events total
Sum(ai_referrals) = 0 (crawlers aren't AI referrals)
```

## 🚨 Edge Cases to Test

### **1. Zero-Row Results**
- [ ] Select "Human via AI" + a source with no traffic
- [ ] Verify Content shows empty state
- [ ] Verify Events shows 0 total

### **2. Multiple Sources Selected**
- [ ] Select (Google, Perplexity) simultaneously
- [ ] Verify Content "Top Sources" displays only those sources
- [ ] Verify totals reconcile between pages

### **3. Pagination Handling**
- [ ] Set page size to 10 on Content
- [ ] Verify sum across all pages matches Events total
- [ ] Test with different page sizes (25, 50, 100)

## 📊 Acceptance Criteria

**Green Light Requirements**:

1. **All 7 manual checks pass** on staging and production
2. **API verification passes** for all test cases
3. **Edge cases handled correctly**
4. **Performance acceptable** (< 3 seconds for complex filters)
5. **UI consistency** maintained across both pages
6. **Automated scripts pass** when run manually

## 🚀 Manual Testing Scripts

### **Available Test Scripts**
```bash
# Lightweight spot check (3 basic tests)
./scripts/test-filter-parity-quick.sh

# Full parity test suite (8 comprehensive tests)
./scripts/verify-filter-parity.sh [staging|prod] [project_id]
```

### **Health Monitoring Endpoint**
```bash
# Check filter parity health via API (optional monitoring)
curl "$API_BASE/api/health/filter-parity?project_id=$PROJECT_ID&window=24h"
```

**Note**: Tests can be run ad-hoc by engineers; no automated GitHub Actions pipeline is configured.

## 🔍 Troubleshooting

### **Common Issues**

1. **Counts don't match**: Check time window alignment, ensure both pages use same project
2. **Filters not working**: Verify URL parameters are being sent correctly
3. **Performance issues**: Check database indexes, consider reducing page size
4. **Empty results**: Verify filter combinations are valid, check data exists

### **Debug Steps**

1. **Check browser console** for JavaScript errors
2. **Verify API responses** match expected format
3. **Check database queries** for performance issues
4. **Compare filter parameters** between Events and Content requests

## 📝 Verification Log

**Date**: _______________
**Environment**: _______________
**Project ID**: _______________
**Tester**: _______________

**Results**:
- [ ] Default parity: PASS/FAIL
- [ ] Human via AI slice: PASS/FAIL  
- [ ] Per-source slice: PASS/FAIL
- [ ] Crawler slice: PASS/FAIL
- [ ] AI Traffic Only toggle: PASS/FAIL
- [ ] Search filter: PASS/FAIL
- [ ] Window label: PASS/FAIL
- [ ] Edge cases: PASS/FAIL

**Overall Status**: ✅ PASS / ❌ FAIL

**Notes**: _______________

---

**Last Updated**: 2025-08-22
**Version**: 1.0
**Maintainer**: Engineering Team
