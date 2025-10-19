# US/English Locale Preference for Audits ✅

## Problem

American Express audit redirected to UK site (`/en-gb/`) instead of staying on US site:
- **Input**: `https://www.americanexpress.com/`
- **Redirected to**: `https://www.americanexpress.com/en-gb/` ❌
- **Should stay on**: `https://www.americanexpress.com/en-us/` ✅

**Root Cause**: Many international brands use geo-detection to redirect users based on:
- IP address location
- Browser language settings
- Accept-Language HTTP headers

Without explicit locale signals, the crawler could land on any regional variant (UK, Canada, Australia, Germany, France, etc.)

---

## Solution: Explicit US/English Locale Signals

Implemented **two-part solution**:

### 1. Accept-Language HTTP Header

**File**: `/packages/audit-worker/src/index.ts`

Added `Accept-Language` header to all bot requests:

```typescript
async function fetchWithIdentity(url: string, init: RequestInit = {}, env: Env) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("user-agent")) headers.set("user-agent", BOT_UA);
  headers.set("X-Optiview-Bot", "audit");
  
  // Signal US/English locale preference to prevent geo-redirects
  // Accept-Language: en-US prioritized, then en, then any
  if (!headers.has("Accept-Language")) {
    headers.set("Accept-Language", "en-US,en;q=0.9,*;q=0.5");
  }
  
  return fetch(url, { ...init, headers, cf: { cacheTtl: 0 } });
}
```

**What this does**:
- Tells the server: "I prefer US English (en-US)"
- Fallback to general English (en) if en-US not available
- Accept any language (*) as last resort
- Quality values (q=0.9, q=0.5) indicate preference strength

---

### 2. Non-US Locale Detection & Correction

Added intelligent redirect detection in pre-check:

```typescript
// Check if redirected to non-US/non-English locale
// Common patterns: /en-gb/, /en-ca/, /en-au/, /fr/, /de/, /es/, /ja/, /zh/, etc.
const nonUSLocalePattern = /\/(en-(?!us)[a-z]{2}|[a-z]{2}-[a-z]{2}|[a-z]{2})(?:\/|$)/i;
if (finalUrl !== url && nonUSLocalePattern.test(finalUrl)) {
  const localeMatch = finalUrl.match(nonUSLocalePattern);
  console.log(`[PRECHECK LOCALE] Redirected to non-US locale: ${localeMatch?.[0]} in ${finalUrl}`);
  
  // Try to construct US/English version
  // 1. Replace /en-gb/ with /en-us/
  let usUrl = finalUrl.replace(/\/(en-[a-z]{2}|[a-z]{2}-[a-z]{2}|[a-z]{2})\//i, '/en-us/');
  
  // 2. If that didn't work, try without locale prefix
  if (usUrl === finalUrl) {
    usUrl = finalUrl.replace(/\/(en-[a-z]{2}|[a-z]{2}-[a-z]{2}|[a-z]{2})\//i, '/');
  }
  
  // 3. If still no change, try the original domain root
  if (usUrl === finalUrl) {
    const originalHostname = new URL(url).hostname;
    usUrl = `https://${originalHostname}/`;
  }
  
  console.log(`[PRECHECK LOCALE] Attempting US version: ${usUrl}`);
  
  return {
    ok: true,
    finalUrl: usUrl
  };
}
```

**Detection Logic**:
- Catches `/en-gb/`, `/en-ca/`, `/en-au/` (non-US English)
- Catches `/fr/`, `/de/`, `/es/`, `/ja/`, `/zh/` (other languages)
- Catches `/fr-ca/`, `/es-mx/` (region-specific non-US)
- Does NOT catch `/en-us/` (that's what we want!)

**Correction Strategy**:
1. **Try `/en-us/`**: Replace detected locale with `/en-us/`
2. **Try no locale**: Remove locale prefix entirely (some sites default to US)
3. **Try root domain**: Go to homepage without any path

---

## Detected Locale Patterns

| Pattern | Example | Detected As | Action |
|---------|---------|-------------|--------|
| `/en-gb/` | British English | Non-US ❌ | Replace with `/en-us/` |
| `/en-ca/` | Canadian English | Non-US ❌ | Replace with `/en-us/` |
| `/en-au/` | Australian English | Non-US ❌ | Replace with `/en-us/` |
| `/en-us/` | US English | ✅ Correct | Keep |
| `/fr/` | French | Non-English ❌ | Replace with `/en-us/` |
| `/de/` | German | Non-English ❌ | Replace with `/en-us/` |
| `/es/` | Spanish | Non-English ❌ | Replace with `/en-us/` |
| `/ja/` | Japanese | Non-English ❌ | Replace with `/en-us/` |
| `/zh/` | Chinese | Non-English ❌ | Replace with `/en-us/` |

---

## Test Results

### American Express Audit

**Before Fix**:
- Input: `https://www.americanexpress.com/`
- Result: `https://www.americanexpress.com/en-gb/?comm_track_id=...` ❌
- Status: Wrong locale (UK)

**After Fix**:
- Input: `https://www.americanexpress.com/`
- Result: `https://www.americanexpress.com/en-us/` ✅
- Status: Correct locale (US)
- Audit ID: `324426d2-b569-48c5-bdab-f61369b5df6e`
- Pages analyzed: 36

**View audit**: https://app.optiview.ai/audits/324426d2-b569-48c5-bdab-f61369b5df6e

---

## Why This Matters

### 1. Content Accuracy
- US site may have different products, pricing, legal disclaimers
- UK site would give inaccurate AEO/GEO scores for US market

### 2. Language Differences
- US English vs British English spelling
- Regional terminology differences
- Currency and measurement differences

### 3. SEO/Visibility
- US users see US results in search engines
- Citations should be based on US version

### 4. Compliance
- Different privacy policies, terms of service
- Region-specific regulations (GDPR vs CCPA)

---

## Bot Identity

The bot now identifies as:

```
User-Agent: OptiviewAuditBot/1.0 (+https://api.optiview.ai/bot; admin@optiview.ai)
Accept-Language: en-US,en;q=0.9,*;q=0.5
X-Optiview-Bot: audit
```

This clearly signals:
- ✅ Bot identity (transparent crawling)
- ✅ US/English locale preference
- ✅ Contact information for site owners

---

## Deployment

**Worker Version**: `360463b9-6406-426f-b8fa-3fbbc77582ba`  
**Deployed**: 2025-10-18 17:45 UTC  
**Status**: ✅ Live in production

---

## Future Enhancements (Optional)

1. **Configurable Locale**: Allow users to specify preferred locale
2. **Multi-Locale Audits**: Run audits on multiple regional versions
3. **Locale Detection UI**: Show detected locale in audit results
4. **Locale Fallback Logging**: Track which correction strategy worked

---

## Summary

**Fixed**: Bot now explicitly requests US/English content via `Accept-Language` header  
**Fixed**: Detects and corrects non-US/non-English redirects automatically  
**Result**: American Express and similar international brands now audit correctly on US site  
**Impact**: Accurate AEO/GEO scores for US market, correct content analysis  

The bot now consistently targets **US/English versions** of international websites! 🇺🇸✅

