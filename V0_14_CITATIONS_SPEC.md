# v0.14 - Real Citations Specification

**Goal**: Replace stub with TOS-safe citations source  
**Timeline**: 1-2 days  
**Priority**: Medium (enhances value)

---

## 🎯 OBJECTIVES

1. Integrate Bing Web Search API (Azure)
2. Query brand/domain variations
3. Parse and store real citations
4. Display in Citations tab
5. Maintain TOS compliance

---

## 🔌 BING WEB SEARCH API

### **Setup**
1. Create Azure Cognitive Services account
2. Get Bing Search API key
3. Add to Cloudflare Worker secrets:
   ```bash
   wrangler secret put BING_SEARCH_KEY
   wrangler secret put BING_SEARCH_ENDPOINT
   ```

### **API Details**
- **Endpoint**: `https://api.bing.microsoft.com/v7.0/search`
- **Auth**: Header `Ocp-Apim-Subscription-Key: {key}`
- **Query**: `?q={query}&count=20&mkt=en-US`
- **Rate Limit**: 3 calls/second, 1000 calls/month (Free tier)

### **Response Structure**
```json
{
  "webPages": {
    "value": [
      {
        "name": "Page Title",
        "url": "https://example.com/page",
        "snippet": "Description..."
      }
    ]
  }
}
```

---

## 🔧 IMPLEMENTATION

### **New File: `packages/api-worker/src/citations-bing.ts`**

```typescript
interface BingSearchResult {
  name: string;
  url: string;
  snippet: string;
}

interface BingSearchResponse {
  webPages?: {
    value: BingSearchResult[];
  };
}

export async function fetchCitationsBing(
  env: Env,
  domain: string,
  orgName?: string
): Promise<Array<{engine: string; query: string; url: string; title: string}>> {
  const queries = generateQueries(domain, orgName);
  const citations: Array<any> = [];
  
  for (const query of queries) {
    try {
      const response = await fetch(
        `${env.BING_SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}&count=20&mkt=en-US`,
        {
          headers: {
            'Ocp-Apim-Subscription-Key': env.BING_SEARCH_KEY,
          },
        }
      );
      
      if (!response.ok) continue;
      
      const data: BingSearchResponse = await response.json();
      const results = data.webPages?.value || [];
      
      // Filter for citations pointing to our domain
      for (const result of results) {
        const resultHost = new URL(result.url).hostname;
        const targetHost = domain.replace(/^www\./, '');
        
        if (resultHost.endsWith(targetHost)) {
          citations.push({
            engine: 'bing',
            query,
            url: result.url,
            title: result.name,
          });
        }
      }
      
      // Rate limit: 3 calls/sec
      await new Promise(resolve => setTimeout(resolve, 350));
    } catch (error) {
      console.error('Bing search error:', error);
    }
  }
  
  return citations;
}

function generateQueries(domain: string, orgName?: string): string[] {
  const cleanDomain = domain.replace(/^www\./, '').split('.')[0];
  const name = orgName || cleanDomain;
  
  return [
    `"${name}"`,                           // Exact brand name
    `${name} company`,                     // Brand + company
    `${name} official site`,               // Brand + official
    `about ${name}`,                       // About pages
    `${name} ${cleanDomain}`,              // Brand + domain slug
  ].slice(0, 3); // Limit to 3 queries to stay under rate limit
}
```

### **Update: `packages/api-worker/src/citations.ts`**

```typescript
import { fetchCitationsBing } from './citations-bing';

export async function fetchCitations(
  env: Env,
  auditId: string,
  domain: string,
  orgName?: string
): Promise<Citation[]> {
  // Check if we already have citations for this audit
  const existing = await env.DB.prepare(
    `SELECT engine, query, url, title, cited_at
     FROM citations
     WHERE audit_id = ?
     ORDER BY cited_at DESC`
  ).bind(auditId).all<Citation>();

  if (existing.results && existing.results.length > 0) {
    return existing.results;
  }

  // Fetch new citations from Bing
  if (env.BING_SEARCH_KEY && env.BING_SEARCH_ENDPOINT) {
    try {
      const bingCitations = await fetchCitationsBing(env, domain, orgName);
      
      // Store citations
      for (const citation of bingCitations) {
        await storeCitation(env, auditId, citation);
      }
      
      return bingCitations.map(c => ({
        ...c,
        cited_at: Date.now(),
      }));
    } catch (error) {
      console.error('Failed to fetch Bing citations:', error);
    }
  }

  // Return empty array if no API key or error
  return [];
}
```

### **Update: `packages/api-worker/src/index.ts`**

```typescript
// In GET /v1/audits/:id, pass orgName to fetchCitations
const property = await env.DB.prepare(
  'SELECT domain, name FROM properties WHERE id = ?'
).bind(audit.property_id).first<{ domain: string; name?: string }>();

if (property) {
  const citations = await fetchCitations(
    env, 
    auditId, 
    property.domain,
    property.name // Pass org name for better queries
  );
  // ... rest of code
}
```

### **Add to `wrangler.toml`**

```toml
[env.production.vars]
BING_SEARCH_ENDPOINT = "https://api.bing.microsoft.com/v7.0/search"

# Add secrets via CLI:
# wrangler secret put BING_SEARCH_KEY --env production
```

---

## 🎨 UI UPDATES

### **Update: `apps/app/src/components/Citations.tsx`**

```tsx
export default function Citations({ citations }: Props) {
  if (!citations || citations.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 48, opacity: 0.7 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
        <h3 style={{ margin: '0 0 8px 0' }}>No Citations Found</h3>
        <p style={{ margin: 0, fontSize: 14 }}>
          Your domain hasn't appeared in Bing search results for brand queries yet.
          Try implementing entity graph recommendations to improve visibility.
        </p>
      </div>
    );
  }

  // Group by query
  const byQuery = citations.reduce((acc, c) => {
    if (!acc[c.query]) acc[c.query] = [];
    acc[c.query].push(c);
    return acc;
  }, {} as Record<string, Citation[]>);

  return (
    <div>
      <p style={{ marginTop: 0, opacity: 0.9, fontSize: 14 }}>
        Found {citations.length} citation{citations.length !== 1 ? 's' : ''} 
        where your domain appears in Bing search results:
      </p>
      
      {Object.entries(byQuery).map(([query, results]) => (
        <div key={query} style={{ marginBottom: 24 }}>
          <h4 style={{ 
            margin: '12px 0 8px 0', 
            fontSize: 14, 
            opacity: 0.8,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <span className="pill info">Bing</span>
            Query: "{query}"
          </h4>
          
          <div style={{ paddingLeft: 16 }}>
            {results.map((citation, idx) => (
              <div 
                key={idx} 
                style={{ 
                  padding: 12, 
                  background: '#1a1b1e', 
                  borderRadius: 8,
                  marginBottom: 8,
                  border: '1px solid #2a2b2e'
                }}
              >
                <a 
                  href={citation.url} 
                  target="_blank" 
                  rel="noreferrer"
                  style={{ 
                    fontWeight: 500, 
                    fontSize: 15,
                    textDecoration: 'none'
                  }}
                >
                  {citation.title || citation.url}
                </a>
                <div style={{ 
                  fontSize: 12, 
                  opacity: 0.6, 
                  marginTop: 4,
                  wordBreak: 'break-all'
                }}>
                  {citation.url}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## 🧪 TESTING

### **1. Setup Bing API**
```bash
# Create Azure account (free tier)
# Create Cognitive Services resource
# Get API key

# Add to Worker
wrangler secret put BING_SEARCH_KEY --env production
# Paste API key when prompted
```

### **2. Test Locally**
```bash
# Set local env
export BING_SEARCH_KEY="your_key_here"
export BING_SEARCH_ENDPOINT="https://api.bing.microsoft.com/v7.0/search"

# Test search
curl "https://api.bing.microsoft.com/v7.0/search?q=optiview&count=20" \
  -H "Ocp-Apim-Subscription-Key: $BING_SEARCH_KEY"
```

### **3. Test Integration**
```bash
# Run audit
AID=$(curl -s -X POST https://api.optiview.ai/v1/audits/start \
  -H "x-api-key: prj_live_8c5e1556810d52f8d5e8b179" \
  -d '{"property_id":"prop_demo"}' | jq -r '.id')

# Check citations
curl -s "https://api.optiview.ai/v1/audits/$AID" | jq '.citations'

# Open in UI
open "https://app.optiview.ai/a/$AID"
```

---

## 📋 ACCEPTANCE CRITERIA

- [ ] Bing Web Search API integrated
- [ ] 3 queries generated per domain
- [ ] Citations filtered to match target domain
- [ ] Citations stored in database
- [ ] Citations display in UI with query grouping
- [ ] Empty state shows helpful message
- [ ] Rate limits respected (3/sec, 1000/month)
- [ ] Errors handled gracefully
- [ ] No TOS violations

---

## 🎯 SUCCESS METRICS

- 🎯 1+ domain shows citations in tab
- 🎯 Average 1-3 citations per audit
- 🎯 Zero API errors
- 🎯 Zero TOS violations
- 🎯 <500ms citation fetch time

---

## 🚀 DEPLOYMENT

```bash
# 1. Add secrets
wrangler secret put BING_SEARCH_KEY --env production

# 2. Deploy worker
cd packages/api-worker
npx wrangler deploy

# 3. Deploy dashboard
cd ../../apps/app
pnpm build
npx wrangler pages deploy dist --project-name=geodude-app --branch=main

# 4. Test
curl -s "https://api.optiview.ai/v1/audits/{audit_id}" | jq '.citations'
```

---

## 📝 CURSOR PROMPTS

### **Prompt A: Bing Integration**
```
Create packages/api-worker/src/citations-bing.ts with fetchCitationsBing(env, domain, orgName).
Generate 3 queries (brand name, "brand company", "about brand").
Query Bing Web Search API, filter results where URL hostname ends with target domain.
Return array of {engine:'bing', query, url, title}.
Add BING_SEARCH_KEY and BING_SEARCH_ENDPOINT to Env interface.
```

### **Prompt B: Update Citations Logic**
```
Update packages/api-worker/src/citations.ts fetchCitations():
- Check for existing citations first
- If none, call fetchCitationsBing()
- Store results using storeCitation()
- Return citations array

Update index.ts GET /v1/audits/:id to pass orgName to fetchCitations.
```

### **Prompt C: UI Improvements**
```
Update apps/app/src/components/Citations.tsx:
- Group citations by query
- Show query as heading with "Bing" badge
- Display each citation as card with title + URL
- Update empty state message to mention Bing
```

---

**Status**: Ready to implement (after v0.13)  
**Estimated Time**: 4-6 hours  
**Complexity**: Medium  
**Dependencies**: Azure Cognitive Services account (free tier OK)

