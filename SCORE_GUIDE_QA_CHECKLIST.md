# Score Guide QA Checklist

## 📊 Analytics Validation (Check GA4)

### Events to Verify:
- [ ] **scoreguide_open** is firing
  - Check for: `check_id`, `slug`, `audit_id`, `page_id`, `from` parameters
  - Test: Click any CheckPill from an audit page
  - Expected: Event logs with all 5 parameters

- [ ] **scoreguide_copy** is firing  
  - Check for: `check_id`, `code_type` parameters
  - Test: Click "Copy" button on any code example
  - Expected: Event logs with check_id (e.g., "A1") and code_type (e.g., "html")

- [ ] **scoreguide_nav_back** is firing
  - Check for: `audit_id`, `page_id`, `check_id` parameters
  - Test: Click "Back to audit page" link
  - Expected: Event logs when arriving from audit context

### How to Check GA4:
1. Go to GA4 → Reports → Events
2. Filter for events starting with "scoreguide_"
3. Click each event → View details
4. Verify parameters are populated

---

## 🔗 Deep-Link Spot Checks

Test these specific checks (variety of categories):

### AEO Checks:
- [ ] **A1** (Structure) - `/score-guide/answer-first-design`
  - Opens in new tab? ✓
  - Mini-TOC works? ✓
  - Anchors scroll correctly? ✓
  - Code copy works? ✓

- [ ] **A5** (Schema) - `/score-guide/schema-accuracy`
  - JSON examples render? ✓
  - Copy button works for JSON? ✓

- [ ] **A7** (UX) - `/score-guide/mobile-ux`
  - Mobile responsive? ✓
  - Touch targets adequate? ✓

### GEO Checks:
- [ ] **G4** (Crawl) - `/score-guide/crawlability-and-access`
  - Google-Extended tooltip shows? ✓
  - Special detection notes visible? ✓

- [ ] **G10** (Technical) - `/score-guide/contextual-linking`
  - All sections render? ✓

---

## 🔄 Full User Flow Test

### Flow 1: From Audit → Guide → Back
1. [ ] Go to any completed audit
2. [ ] Find a check with score < 3 in "Top Blockers"
3. [ ] Click the CheckPill
4. [ ] Verify: Opens in **new tab**
5. [ ] Verify: URL contains `?from=audits&check=...&auditId=...&pageId=...`
6. [ ] Verify: "Back to audit page" link is visible
7. [ ] Click "Back to audit page"
8. [ ] Verify: Returns to exact same page (audit still open in original tab)

### Flow 2: Direct Access
1. [ ] Go directly to `/score-guide`
2. [ ] Search for "schema"
3. [ ] Verify: Filters to A5, G8, etc.
4. [ ] Click "View examples →" on A5
5. [ ] Verify: Opens detail page
6. [ ] Verify: No "Back to audit page" link (since not from audit)

### Flow 3: Anchor Navigation
1. [ ] Open any check detail page
2. [ ] Click mini-TOC link "→ Implementation"
3. [ ] Verify: Scrolls to Implementation section smoothly
4. [ ] Hover over "Implementation" heading
5. [ ] Verify: "#" anchor link appears
6. [ ] Click "#"
7. [ ] Verify: URL copied to clipboard
8. [ ] Paste URL in new tab
9. [ ] Verify: Jumps directly to Implementation section

---

## 📱 Mobile Responsiveness

Test on mobile device or browser dev tools (375px width):

- [ ] Search field doesn't get covered by keyboard
- [ ] Examples grid stacks vertically (not side-by-side)
- [ ] Code blocks scroll horizontally (no overflow)
- [ ] Mini-TOC wraps to multiple lines
- [ ] "View examples →" buttons don't wrap awkwardly
- [ ] Touch targets are 44x44px minimum

---

## 🎨 Visual Consistency

- [ ] Light theme matches rest of app (gray-50 background)
- [ ] Blue links are consistent (blue-600)
- [ ] Shadows and borders match other pages
- [ ] No dark mode remnants (neutral-950, etc.)
- [ ] Code blocks are readable (gray-50 bg, gray-900 text)

---

## ⚠️ Edge Cases

- [ ] Invalid slug (e.g., `/score-guide/fake-check`) shows "Not found"
- [ ] Missing detection notes → section hidden (no empty list)
- [ ] Empty search → "No checks match your search"
- [ ] CheckPill without auditId/pageId → no query params in URL

---

## 📈 Expected Metrics (After 24-48 Hours)

Track in GA4:

| Metric | Expected Range | Notes |
|--------|---------------|-------|
| scoreguide_open events | 10-50+ per day | Depends on audit volume |
| Copy rate (copies / opens) | 15-40% | Indicates implementation intent |
| Back-to-audit rate | 60-80% | Measures contextual usefulness |
| Top 5 viewed checks | A1, A5, G4, A10, G1 | Structural/schema checks typically most viewed |

---

## ✅ Sign-Off

**Tested by**: _______________  
**Date**: _______________  
**Status**: ⬜ Pass  ⬜ Issues found (see below)  

**Issues found**:
- 
- 
- 

**Ready for Phase 2?**: ⬜ Yes  ⬜ No (needs fixes)

