# 🧪 Test Audits - Phase 3 Citation System

**Created:** October 25, 2025  
**Worker Version:** `cf2d2c93-ef72-42ae-9105-849b109cd8c5`  
**Purpose:** Validate Phase 3 citation enhancements (official docs + navigation)

---

## 🎯 **Test Audits Created**

### **1. Pfizer** (Pharmaceutical)
**Audit ID:** `e533fa91-54af-443a-8096-76d12980fbfa`  
**URL:** https://app.optiview.ai/audits/e533fa91-54af-443a-8096-76d12980fbfa  
**Domain:** https://www.pfizer.com  
**Industry:** `health.pharma.brand`

**What to Test:**
- ✅ PI PDF citations (Prescribing Information)
- ✅ REMS requirements
- ✅ Medication Guide PDFs
- ✅ HCP vs Patient site links
- ✅ Storage and handling instructions
- ✅ "How supplied" (strengths, NDC codes)
- ✅ Citation-seeking variants: "...and include the official Pfizer URL you used."

**Expected Citation Queries:**
```
Pfizer [product] Prescribing Information (PI) PDF and Medication Guide
Pfizer [product] REMS requirements (official REMS or brand site)
Pfizer [product] Medication Guide PDF (patient version)
Pfizer [product] storage and handling instructions (official label)
Pfizer [product] how supplied (strengths, NDC codes)
Pfizer [product] HCP vs Patient site—official links
```

**Success Criteria:**
- [ ] ≥50% of PI/REMS queries yield citations to pfizer.com
- [ ] ≥80% of citations link to official Pfizer documents (PDFs, label pages)
- [ ] At least 5 different Pfizer products cited
- [ ] HCP site and Patient site both cited separately

---

### **2. Chase Bank** (Banking/Finance)
**Audit ID:** `5f7a15d5-9423-4063-9b05-b85e13fd9447`  
**URL:** https://app.optiview.ai/audits/5f7a15d5-9423-4063-9b05-b85e13fd9447  
**Domain:** https://www.chase.com  
**Industry:** `finance.bank`

**What to Test:**
- ✅ Fee schedule PDFs
- ✅ Reg E disclosures
- ✅ Routing number lookup
- ✅ Funds availability policy
- ✅ Zelle limits and eligibility
- ✅ Branch locator (navigational anchor)
- ✅ Login/online banking (navigational anchor)
- ✅ Customer service phone number

**Expected Citation Queries:**
```
Chase fee schedule PDF (checking/savings)
Chase electronic funds transfer (EFT)/Reg E disclosures
Chase routing number and wire instructions
Chase funds availability policy
Chase Zelle limits and eligibility (official page)
Chase branch locator
Chase login / online banking sign in
Chase customer service phone number
```

**Success Criteria:**
- [ ] ≥60% of regulatory doc queries yield citations to chase.com
- [ ] ≥90% of navigational queries (login, branch locator) yield chase.com
- [ ] Fee schedule PDF is cited (not just homepage)
- [ ] Reg E disclosure page is cited
- [ ] Routing number page is cited

---

### **3. Delta Airlines** (Travel/Airlines)
**Audit ID:** `47517b98-ef52-42b0-8fab-e319d6db7f83`  
**URL:** https://app.optiview.ai/audits/47517b98-ef52-42b0-8fab-e319d6db7f83  
**Domain:** https://www.delta.com  
**Industry:** `travel.air`

**What to Test:**
- ✅ Contract of carriage PDF
- ✅ Baggage fee chart
- ✅ Tarmac delay policy
- ✅ Pet policy and carrier requirements
- ✅ Route map (official)
- ✅ Login/check-in (navigational anchor)
- ✅ Customer service phone number

**Expected Citation Queries:**
```
Delta contract of carriage (official PDF)
Delta baggage fee chart (official page/PDF)
Delta tarmac delay policy
Delta pet policy and carrier requirements
Delta route map (official)
Delta login / check-in online
Delta customer service phone number
```

**Success Criteria:**
- [ ] ≥50% of regulatory doc queries yield citations to delta.com
- [ ] ≥90% of navigational queries (login, check-in) yield delta.com
- [ ] Contract of carriage PDF is cited (DOT-required document)
- [ ] Baggage fee chart is cited
- [ ] Pet policy page is cited

---

## ⏱️ **Expected Timeline**

| Time | Event |
|------|-------|
| **0:00** | Audits created (all 3 started) |
| **0:05** | First cron run - URL discovery begins |
| **0:10** | Second cron run - Page fetching starts |
| **0:15** | Third cron run - More page fetching |
| **0:20** | Fourth cron run - Audits likely complete (~60-80 pages each) |
| **0:25** | Fifth cron run - Citations queued automatically |
| **0:30** | Sixth cron run - Citations begin processing |
| **0:40** | Citations complete (~30-50 queries × 4 sources = 120-200 results) |

**Total Time:** ~40 minutes from creation to full citation results

---

## 📊 **Metrics to Track**

### **Overall Metrics:**
- **Citation Rate:** % of queries that yield at least one brand citation
  - **Target:** 45-55% (Phase 3 goal)
  - **Baseline:** 27% (pre-enhancement)
  
- **Official Domain %:** % of citations from official brand domain
  - **Target:** 85%+
  - **Baseline:** ~60%

- **Document Citations:** % of citations to PDFs or specific documents
  - **Target:** 30%+
  - **Baseline:** ~10%

### **Query Type Breakdown:**

| Query Type | Target Citation Rate | Example |
|------------|---------------------|---------|
| **Official Docs** | 50-60% | PI PDFs, fee schedules, contract of carriage |
| **Navigational** | 80-90% | Login, branch locator, check-in |
| **Citation-Seeking** | 60-70% | "...and include the official URL" |
| **Standard Branded** | 40-50% | Regular branded queries |

### **Industry-Specific:**

**Pfizer (Pharma):**
- PI PDF citations: 60%+ (regulatory gold)
- REMS page citations: 50%+
- HCP site citations: 70%+

**Chase (Banking):**
- Fee schedule PDF: 60%+
- Reg E disclosure: 50%+
- Routing number page: 70%+
- Branch locator: 90%+
- Login page: 95%+

**Delta (Airlines):**
- Contract of carriage PDF: 50%+
- Baggage fee chart: 60%+
- Check-in/login: 95%+
- Customer service: 80%+

---

## 🔍 **Verification Steps**

### **Step 1: Check Audit Completion** (15-20 min after creation)
```bash
# Check status
curl -s "https://api.optiview.ai/api/audits/e533fa91-54af-443a-8096-76d12980fbfa" \
  -H "Cookie: ov_sess=..." | jq '.status, .pages_analyzed'
```

**Expected:**
- Status: `completed`
- Pages analyzed: 60-80 per audit

### **Step 2: Check Citations Queued** (20-25 min after creation)
```bash
# Check citations status
curl -s "https://api.optiview.ai/api/audits/e533fa91-54af-443a-8096-76d12980fbfa" \
  -H "Cookie: ov_sess=..." | jq '.citations_status, .citations_queued_at'
```

**Expected:**
- citations_status: `queued` or `running`
- citations_queued_at: timestamp

### **Step 3: Check Citation Results** (40-50 min after creation)
```bash
# Check citation count
curl -s "https://api.optiview.ai/api/citations/list?audit_id=e533fa91-54af-443a-8096-76d12980fbfa&limit=100" \
  -H "Cookie: ov_sess=..." | jq '.citations | length'
```

**Expected:**
- 30-50 unique queries tested
- 120-200 total citation results (4 sources × 30-50 queries)
- 40-60 cited results (40-50% citation rate)

### **Step 4: Analyze Citation Quality**
For each audit, check:
- [ ] What % of queries cited the official domain?
- [ ] What % of citations link to PDFs/documents?
- [ ] What % of navigational queries succeeded?
- [ ] Did citation-seeking variants work?

---

## 📝 **Sample Citation Analysis Queries**

### **Pfizer - Check for PI PDF Citations:**
```sql
SELECT 
  query,
  ai_source,
  cited_match_count,
  cited_url
FROM ai_citations 
WHERE audit_id = 'e533fa91-54af-443a-8096-76d12980fbfa'
  AND query LIKE '%Prescribing Information%'
  AND cited_match_count > 0
ORDER BY cited_match_count DESC;
```

### **Chase - Check for Navigational Success:**
```sql
SELECT 
  query,
  ai_source,
  cited_match_count,
  cited_url
FROM ai_citations 
WHERE audit_id = '5f7a15d5-9423-4063-9b05-b85e13fd9447'
  AND (query LIKE '%login%' OR query LIKE '%branch locator%')
  AND cited_match_count > 0;
```

### **Delta - Check for Official Doc Citations:**
```sql
SELECT 
  query,
  ai_source,
  cited_match_count,
  cited_url
FROM ai_citations 
WHERE audit_id = '47517b98-ef52-42b0-8fab-e319d6db7f83'
  AND (query LIKE '%contract of carriage%' OR query LIKE '%baggage fee%')
  AND cited_match_count > 0;
```

---

## 🎯 **Success Criteria Summary**

| Metric | Target | How to Verify |
|--------|--------|---------------|
| **Overall Citation Rate** | 45-55% | Count cited_match_count > 0 / total queries |
| **Official Domain %** | 85%+ | Count citations with brand domain in cited_url |
| **Document Citations** | 30%+ | Count citations with .pdf or /documents/ in URL |
| **Navigational Success** | 80-90% | Check login/locator queries specifically |
| **Citation-Seeking Boost** | +10-15% | Compare queries with "official URL" suffix vs without |

---

## 📈 **Next Steps After Results**

### **If Success (Targets Met):**
1. ✅ Document Phase 3 success metrics
2. ✅ Begin planning Phase 2 (link hygiene, comparison prompts)
3. ✅ Expand official doc templates to more industries
4. ✅ Add A/B testing infrastructure

### **If Mixed Results:**
1. 🔍 Analyze which query types performed well
2. 🔍 Identify which industries need template improvements
3. 🔍 Check if citation-seeking variants helped or hurt
4. 🔍 Adjust templates based on data

### **If Below Target:**
1. ⚠️ Check if industry classification was correct
2. ⚠️ Check if placeholders were replaced correctly
3. ⚠️ Review query logs for quality issues
4. ⚠️ Test with manual queries to validate templates

---

## 🔗 **Quick Links**

**Audit URLs:**
- Pfizer: https://app.optiview.ai/audits/e533fa91-54af-443a-8096-76d12980fbfa
- Chase: https://app.optiview.ai/audits/5f7a15d5-9423-4063-9b05-b85e13fd9447
- Delta: https://app.optiview.ai/audits/47517b98-ef52-42b0-8fab-e319d6db7f83

**Citations URLs:**
- Pfizer: https://app.optiview.ai/audits/e533fa91-54af-443a-8096-76d12980fbfa?tab=citations
- Chase: https://app.optiview.ai/audits/5f7a15d5-9423-4063-9b05-b85e13fd9447?tab=citations
- Delta: https://app.optiview.ai/audits/47517b98-ef52-42b0-8fab-e319d6db7f83?tab=citations

---

**Status:** 🟢 Audits Created & Running  
**Next Check:** 40 minutes (for full citation results)

