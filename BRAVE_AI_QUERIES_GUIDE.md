# Brave AI Queries Modal — User Guide

## **What You're Looking At**

The **Brave AI Queries Modal** shows the **actual search queries** we sent to Brave's Search API during the audit, **NOT** the final citations/results.

Think of it as the "query log" or "execution report" — what we asked Brave, how long it took, and whether we got results.

---

## **Modal Columns Explained**

### **QUERY**
The exact search term we sent to Brave.

**Examples:**
- `site:cologuard.com` — Basic brand query
- `cologuard faq` — Natural language query
- `how to use cologuard` — How-to query
- `cologuard vs fit test` — Competitive comparison

### **BUCKET**
The **intent category** (why we generated this query):

| Bucket | Purpose | Example Queries |
|--------|---------|----------------|
| `brand_core` | Basic brand/domain queries | `cologuard`, `site:cologuard.com` |
| `product_how_to` | How-to and usage questions | `how to use cologuard`, `cologuard setup` |
| `jobs_to_be_done` | User intent queries | `cologuard benefits`, `why use cologuard` |
| `schema_probes` | FAQ/structured data discovery | `cologuard frequently asked questions`, `cologuard eligibility` |
| `content_seeds` | H1-driven queries (from your pages) | Uses actual H1 text from crawled pages |
| `competitive` | Comparison queries (if enabled) | `cologuard vs colonoscopy`, `cologuard alternatives` |

### **MODE**
The Brave API endpoint used:

- **`search`** = Brave Web Search API (with `summary=1` parameter)
- **`summarizer`** = Brave Summarizer API (deprecated, rarely used now)

### **RESULTS**
The **number of sources** Brave returned for that query.

- `10` = Brave returned 10 web sources
- `0` = Brave found nothing (status will show `empty`)

### **STATUS**
The outcome of the query:

| Status | Meaning | Action Needed? |
|--------|---------|----------------|
| `ok` | ✅ Query succeeded, got results | None — working as expected |
| `empty` | ⚪ Query succeeded but Brave had no answers | Normal — not every query has results |
| `rate_limited` | ⚠️ Brave API rate limit (429 error) | Reduce query count or upgrade Brave plan |
| `error` | ❌ HTTP error (5xx or other) | Check API key, retry logic, or Brave status |
| `timeout` | ⏱️ Query took too long (>7s default) | Increase `BRAVE_TIMEOUT_MS` or optimize query |

### **MS** (Milliseconds)
How long the query took to complete.

- `200-500ms` = Fast ✅
- `500-2000ms` = Normal
- `>3000ms` = Slow (check network/Brave API)

---

## **What's the Difference Between This and Citations?**

| Feature | Brave AI Queries Modal | Citations Tab |
|---------|----------------------|--------------|
| **What it shows** | Queries we **sent** to Brave | Results/pages Brave **returned** |
| **Purpose** | Audit transparency, debugging | Actual AEO evidence |
| **Data source** | `audits.brave_ai_json` (query logs) | `citations` table (parsed sources) |
| **Filter by** | Bucket, Status | Citation Type (AEO/GEO/Organic), Provider |

---

## **How to Interpret the Results**

### **✅ Good Audit**
```
30 OK • 0 No Answer • 0 Rate-Limited • 0 Error • 0 Timeout
```
- All queries returned results
- No rate limiting or errors
- **20 pages cited** = Brave found your content in 20 different pages

### **⚠️ Partially Rate-Limited**
```
25 OK • 5 No Answer • 5 Rate-Limited • 0 Error • 0 Timeout
```
- Most queries succeeded
- **5 queries hit rate limit** → Brave API free tier maxed out
- **Solution**: Reduce `BRAVE_MAX_QUERIES` to 20-30 or upgrade to Brave paid plan

### **❌ Broken Audit**
```
0 OK • 0 No Answer • 30 Rate-Limited • 0 Error • 0 Timeout
```
- All queries were rate-limited
- **Cause**: API key quota exceeded or invalid key
- **Solution**: Check `BRAVE_SEARCH_AI` secret, verify Brave dashboard quota

---

## **Common Questions**

### **Q: Why do I see 30 queries but only 12 citations?**
**A:** Not every query generates citations. Some queries:
- Return 0 results (`empty` status)
- Return results that **don't link to your domain** (e.g., competitor pages)
- Are filtered out by our citation parser (e.g., ads, low-quality sources)

### **Q: What does "20 pages cited" mean?**
**A:** Across all 30 queries, Brave returned results pointing to **20 unique pages** on your domain (e.g., `/faq`, `/how-to-use`, `/pricing`, etc.).

You can see which pages by:
1. Go to **Pages tab**
2. Look at the **AI (Brave)** column
3. Hover for a tooltip showing the top 3 queries that cited that page

### **Q: Why are all my queries in the `brand_core` bucket?**
**A:** This happens when:
- Your site has very few pages (< 5)
- Your pages have short/generic H1s
- The audit ran with `BRAVE_QUERY_STRATEGY=basic` (default is `smart`)

**Solution**: Wait for a full crawl (more pages = more diverse queries) or manually set `BRAVE_QUERY_STRATEGY=aggressive` in `wrangler.toml`.

### **Q: Can I run more queries on demand?**
**A:** Yes! Click the **"Run +10 More"** button (coming soon) to:
- Generate 10 additional smart queries
- Append them to the existing query log
- Update the "pages cited" count

### **Q: How do I add custom queries?**
**A:** In the modal, use the **"Add terms"** field (coming soon) to input free-text terms like:
```
cologuard insurance coverage
cologuard Medicare
cologuard doctor recommendation
```

---

## **Troubleshooting**

### **🐛 Modal is empty or shows 0 queries**
**Possible causes:**
1. Brave API key not set (`BRAVE_SEARCH_AI` secret missing)
2. Audit was run before Phase F+ deployment
3. Rate limit hit immediately (all queries failed)

**Fix**: Re-run the audit with the button on the audit page.

### **🐛 "Run +10 More" button doesn't work**
**Possible causes:**
1. Backend error (`display_name` column issue — now fixed!)
2. Brave API rate limit
3. Network timeout

**Fix**: Check browser console for errors, then check Cloudflare Workers logs (`wrangler tail geodude-api`).

### **🐛 All queries show `rate_limited`**
**Cause**: Brave API free tier allows ~100 requests/day. With 30 queries/audit, you hit the limit after ~3 audits.

**Fix**:
1. **Short-term**: Reduce `BRAVE_MAX_QUERIES` to 10-15
2. **Long-term**: Upgrade to [Brave Search API paid plan](https://brave.com/search/api/) (2000+ queries/month)

---

## **Next Steps**

1. ✅ **Check the Citations tab** to see what Brave actually returned (the "AEO evidence")
2. ✅ **Go to Pages tab** and hover the "AI (Brave)" column to see which queries cited each page
3. ✅ **Filter by bucket** in the modal to see query distribution (Brand vs. How-to vs. Schema, etc.)
4. ⏳ **Run +10 More** (button coming soon) to expand coverage

---

## **Technical Details**

- **API Used**: [Brave Web Search API](https://brave.com/search/api/) with `summary=1` parameter
- **Query Generation**: `buildSmartQueries()` in `packages/api-worker/src/brave/queryBuilder.ts`
- **Storage**: `audits.brave_ai_json` column (full query logs)
- **Rate Limiting**: Built-in retry logic (1 retry on 5xx, exponential backoff on 429)
- **Concurrency**: Max 2 queries in parallel (`BRAVE_MAX_CONCURRENT=2`)
- **Timeout**: 7 seconds per query (`BRAVE_TIMEOUT_MS=7000`)

---

**Need help?** Check the [Phase F+ Implementation Plan](/PHASE_F_PLUS_H_SPIKE.md) or ping Kevin.

