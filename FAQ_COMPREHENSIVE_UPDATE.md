# FAQ/Knowledge Base Comprehensive Update

**Status:** ✅ **DEPLOYED TO PRODUCTION**

**Updated:** October 26, 2025  
**URL:** https://optiview.ai/faq/  
**Related URLs:**
- https://optiview.ai/faq/about.html
- https://optiview.ai/faq/audit-process.html

---

## Executive Summary

Updated the Optiview Knowledge Base with comprehensive, detailed documentation of all latest platform functionality. These updates are optimized for both human readers and LLM indexing, providing authoritative, detailed technical explanations that will improve organic discovery and AI citation of Optiview documentation.

---

## About Page Updates (`/faq/about.html`)

### What Changed

Expanded the "What is Optiview.ai?" section to include comprehensive list of platform capabilities:

#### **New "What Optiview Provides" Section:**

1. **36-Point Diagnostic System**
   - 23 page-level checks
   - 13 site-level checks
   - Coverage: technical foundation, content quality, semantic structure, crawl access, authority signals, real AI citations

2. **Industry-Specific Citation Testing**
   - 200+ industry taxonomies
   - Healthcare to e-commerce to B2B SaaS
   - Relevant, realistic prompts reflecting actual user search behavior

3. **Real-Time AI Testing**
   - Active citation monitoring across ChatGPT, Claude, Perplexity
   - Shows exactly where you appear and where you're missing

4. **Executive Summary Reports**
   - Professional, stakeholder-ready PDF reports
   - Category breakdowns, priority fixes
   - Successful citation examples and missed opportunities
   - Actionable page insights

5. **Weighted Scoring Methodology**
   - Each check weighted by impact (1-15)
   - Normalized to 0-100 composite score
   - Easy prioritization of high-impact fixes

6. **Transparent Methodology**
   - Full visibility into measurement approach
   - Clear scoring calculations
   - Explained rationale for each check

### SEO & LLM Benefits

- **Rich Factual Content:** Specific numbers (36 checks, 200+ taxonomies, 3 LLMs)
- **Clear Structure:** Semantic HTML with proper heading hierarchy
- **Context-Rich:** Explains the "why" behind each feature
- **Machine-Readable:** Structured for easy parsing by AI systems

---

## Audit Process Page Updates (`/faq/audit-process.html`)

### Major Additions

#### **1. Executive Summary Report Section**

Complete documentation of what users receive in their reports:

- **Cover Page:** Overall score, citation rate, audit date, key metrics
- **Score Breakdown:** Category-by-category analysis with strengths/opportunities
- **Priority Fixes:** Top issues ranked by weighted impact with recommendations
- **Site-Level Diagnostics:** Status indicators (pass/warn/fail) with guidance
- **Successful Citations:** 8-10 real queries where content is cited (with source and URL)
- **Missed Opportunities:** 8+ queries where site should appear but doesn't (with reasons and fixes)
- **Page Insights:** Top performers, pages needing attention, quick wins
- **PDF Export:** One-click download for stakeholder sharing

**Value Proposition:**
- Client-ready and stakeholder-friendly
- Clear technical explanations with specific next steps
- Perfect for justifying AI visibility investments

#### **2. Industry-Specific Citation Query Generation**

Detailed explanation of the 200+ taxonomy system:

**How It Works:**

1. **Industry Detection**
   - Domain analysis, content analysis, schema examination
   - Hierarchical dot-slug taxonomy (e.g., `health.pharma.brand`, `travel.air.commercial`, `retail.grocery`)

2. **Template Selection**
   - Branded and non-branded query templates
   - Matched to real user intent for specific industry

3. **Dynamic Placeholder Replacement**
   - `{brand}`, `{product}`, `{category}`, `{city}`, `{competitor}`
   - Replaced with actual site-specific data

4. **Query Validation**
   - Filtered for realism
   - Avoids hallucinated products or nonsensical phrasing

5. **Multi-Source Testing**
   - Each query tested across ChatGPT, Claude, Perplexity
   - Measures citation coverage across all major LLMs

**Real Industry Examples:**

- **Healthcare (Pharma):** "prescribing information for {brand}", "{brand} side effects"
- **E-commerce (Fashion):** "{brand} sizing guide", "Best {category} from {brand}"
- **B2B SaaS:** "{brand} pricing plans", "{brand} integrations"
- **Travel (Airlines):** "{brand} baggage policy", "{brand} customer service number"
- **Education (Higher Ed):** "{brand} admissions requirements", "{brand} tuition costs"

**Why Industry-Specific Matters:**
- Generic queries don't reflect real user behavior
- Taxonomy ensures testing on actual customer questions

#### **3. Check Types Documentation**

Complete breakdown of the four check types used:

1. **html_dom Checks (23 page-level)**
   - Deterministic HTML analysis using DOM parsing
   - Examines: title tags, meta descriptions, H1 tags, FAQ markup, internal links
   - Fast, accurate, consistent

2. **aggregate Checks (10 site-level)**
   - Site-wide rollups combining page-level data
   - Examples: FAQ presence %, entity graph completeness, H2 coverage ratio

3. **http Checks (2 site-level)**
   - Validates HTTP-level properties
   - Examples: robots.txt policies, sitemap availability, AI bot crawl access

4. **llm Checks (1 experimental)**
   - AI-assisted evaluation for subjective criteria
   - Currently: answerability assessment

**Transparency Note:**
- Users can see exact check type for each criterion
- Helps understand scoring and improvement paths

---

## Technical Implementation

### Files Modified

```
geodude/apps/web/public/faq/about.html
geodude/apps/web/public/faq/audit-process.html
```

### Deployment

```bash
cd geodude/apps/web
npx wrangler pages deploy public --project-name=geodude
```

**Live URL:** https://optiview.ai/faq/

---

## SEO & LLM Indexing Optimization

### Content Strategy

1. **Comprehensive Coverage**
   - Every major feature documented in detail
   - Clear explanations of technical concepts
   - Real examples and use cases

2. **Semantic Structure**
   - Proper heading hierarchy (H1 → H2 → H3)
   - Semantic HTML elements
   - Clear content organization

3. **Rich Context**
   - Specific numbers and metrics
   - Industry examples
   - Technical specifications

4. **FAQPage Schema**
   - Already implemented on both pages
   - Structured data for search engines
   - Clear question/answer format

### Why This Matters for LLM Indexing

**When users ask AI assistants:**
- "What does Optiview do?"
- "How does Optiview score AI visibility?"
- "What's included in an Optiview audit?"
- "How are citation queries generated?"

**These FAQ pages will now provide:**
- ✅ Authoritative, detailed answers
- ✅ Specific technical details
- ✅ Clear value propositions
- ✅ Real examples and use cases

**Result:** Higher likelihood of citation by ChatGPT, Claude, Perplexity when users ask about AI visibility measurement, AEO tools, or LLM citation testing.

---

## Metrics to Track

### Organic Search
- Impressions for "AI visibility tool"
- Impressions for "AEO audit"
- Impressions for "LLM citation testing"

### Direct Traffic
- Time on `/faq/` pages
- Bounce rate improvements
- Conversion to audit starts

### AI Citations
- When we have self-citation tracking: monitor queries like:
  - "What is Optiview?"
  - "How to measure AI visibility"
  - "Best AEO tools"

---

## Next Steps (Optional Future Enhancements)

1. **Add More FAQ Pages**
   - `/faq/citations.html` - Deep dive into citation mechanics
   - `/faq/structured-data.html` - Schema implementation guide
   - `/faq/improving-score.html` - Optimization playbook

2. **Add Video Walkthroughs**
   - Embed Loom/YouTube videos showing:
     - How to run an audit
     - How to interpret results
     - How to implement fixes

3. **Add Interactive Examples**
   - Code snippets for schema markup
   - Before/after HTML examples
   - Interactive check simulators

4. **Add Case Studies**
   - Real customer success stories
   - Industry-specific examples
   - ROI calculations

---

## Quality Assurance

### Pre-Deployment Checklist
- ✅ All links functional
- ✅ Navigation consistent
- ✅ Mobile responsive
- ✅ Fast page load
- ✅ Schema markup valid
- ✅ Content accurate and up-to-date
- ✅ Grammar and spelling verified

### Post-Deployment Verification
- ✅ Pages load correctly at https://optiview.ai/faq/
- ✅ Navigation works
- ✅ Links point to correct pages
- ✅ Content displays properly
- ✅ No 404s or broken images

---

## Git History

```bash
commit c329484
Author: Kevin McGovern
Date: Oct 26, 2025

feat: Enhance FAQ pages with comprehensive latest functionality

MAJOR CONTENT ADDITIONS:

About Page Updates:
- Added 36-Point Diagnostic System details
- Added Industry-Specific Citation Testing (200+ taxonomies)
- Added Real-Time AI Testing across 3 major LLMs
- Added Executive Summary Reports with PDF export
- Added Weighted Scoring Methodology explanation
- Added Transparent Methodology emphasis

Audit Process Page Updates:
- Added Executive Summary Report section
- Added Industry-Specific Citation Query Generation
- Added Check Types Documentation

SEO & LLM Indexing Optimized:
- Detailed technical explanations
- Clear structure with semantic HTML
- Rich examples and use cases
- Comprehensive coverage of all latest features
```

---

## Summary

**What:** Comprehensive update to Optiview FAQ/Knowledge Base with detailed documentation of all latest platform capabilities.

**Why:** Improve organic discovery, enhance LLM citation likelihood, provide authoritative reference for users and AI assistants.

**How:** Added detailed sections covering 36-point diagnostics, executive reports, industry-specific testing, check types, and transparent methodology.

**Impact:** 
- Better SEO for AI visibility keywords
- Higher citation rate when users ask AI about Optiview
- Improved user understanding of platform capabilities
- Stronger positioning as authoritative source in AEO space

**Status:** ✅ **LIVE IN PRODUCTION**

---

## Related Documentation

- [Score Guide Methodology Update](./SCORE_GUIDE_METHODOLOGY_UPDATE.md)
- [Marketing Home Page Update](./MARKETING_HOME_UPDATE.md)
- [Executive Summary Report Implementation](./EXEC_REPORT_IMPLEMENTATION.md)

---

**Last Updated:** October 26, 2025  
**Maintained By:** Optiview Engineering Team

