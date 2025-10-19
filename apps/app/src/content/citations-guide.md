# Citations Guide

## How We Measure AI Visibility

The Citations system tracks how frequently your domain is referenced across major AI platforms, providing insights into your content's visibility in the age of AI-powered search and assistance.

### What We Track

**AI Sources:**
- **ChatGPT** (OpenAI): GPT-4 responses that cite your content
- **Claude** (Anthropic): Claude's answers referencing your domain
- **Perplexity**: AI search results that link to your pages
- **Brave Search**: Traditional search engine rankings (AEO coverage)

**Metrics:**
- **Cited Percentage**: % of queries that reference your domain
- **Citation Count**: Total number of times your URLs appear
- **Top Cited URLs**: Your pages most frequently referenced
- **Query Performance**: Which searches lead to citations

### How Citations Are Calculated

Our citation system uses **context-aware AI prompts** to generate queries that mirror real user behavior:

1. **Intelligent Query Generation**: We generate 28-30 queries per domain using:
   - **Brand Analysis**: Official brand name, common nicknames, and industry context
   - **Audience Personas**: Consumer, merchant, developer, and investor perspectives
   - **Intent Coverage**: 8 categories (trust, cost, features, comparison, acceptance, support, eligibility, rewards)
   - **Industry Intelligence**: Specialized quotas for finance (networks vs banks), retail, software, insurance, automotive
   - **Real-Time Context**: Homepage metadata, navigation structure, and site purpose

2. **Natural Language AI**: Queries are crafted to sound human, not robotic:
   - Varied verbs and question structures
   - 6-12 word queries (typical user length)
   - Mixed branded (40%) and non-branded (60%) searches
   - Persona-appropriate phrasing (e.g., merchants ask about integration, consumers about security)

3. **Multi-Source Querying**: Each query is sent to all configured AI sources:
   - **ChatGPT** (GPT-4): General knowledge and recommendations
   - **Claude**: In-depth analysis and comparisons
   - **Perplexity**: Real-time web search citations
   - **Brave Search**: Traditional search visibility

4. **Citation Detection**: We extract and normalize URLs from AI responses

5. **Domain Matching**: URLs are matched against your domain (including www/non-www variants)

6. **Scoring**: Cited percentage = (queries that cited you) / (total queries) × 100

### Why Our Queries Are More Realistic

Traditional citation tools use generic templates like "best [brand]" or "[brand] vs competitor". Our system learns from your actual site:

- **Adaptive Context**: We analyze your homepage, navigation, and industry to understand your business model
- **Persona Detection**: Automatically detects whether to ask consumer, merchant, developer, or investor questions
- **Cold-Start Ready**: Even for brand new domains, we fetch your homepage live to build context
- **Confidence-Aware**: When classification confidence is low, queries shift to safer, more generic intents
- **Self-Improving**: As you run audits, our system learns more about your domain and generates better queries

**Example Evolution:**
- **Generic approach**: "american express reviews", "american express customer service"
- **Our approach**: "Is Amex widely accepted by ecommerce sites?", "Amex Platinum vs Chase Sapphire Reserve for airport lounge access", "What credit score do I need for Amex Gold?"

This means your citation results reflect **real-world visibility**, not artificial test queries.

### Improving Your Citations

**High-Impact Strategies:**

**1. Optimize for G1 (Citable Facts Block)**
- Create dedicated "Key Facts" sections
- Use clear, atomic statements
- Include specific numbers, dates, and data points

**2. Enhance G2 (Provenance Schema)**
- Add JSON-LD with `isBasedOn`, `citation`, `license` properties
- Include author attribution and publication dates
- Mark content with appropriate Creative Commons licenses

**3. Ensure G4 (AI Crawler Access)**
- Fix robots.txt to allow AI crawlers
- Ensure SPA parity (content accessible without JavaScript)
- Test with various user agents

**4. Structure for G5 (Chunkability)**
- Use clear headings (H1, H2, H3)
- Break content into digestible sections
- Include bullet points and numbered lists

**5. Create G6 (Canonical Fact URLs)**
- Give each key fact its own stable URL
- Use descriptive, permanent URLs
- Avoid query parameters for core content

### Understanding Your Results

**Citation Percentage by Source:**
- **0-10%**: Low visibility, focus on G1/G2 improvements
- **10-25%**: Moderate visibility, optimize G4/G5
- **25%+**: Strong visibility, maintain and expand

**Common Patterns:**
- **Homepage citations**: Brand recognition queries
- **Deep page citations**: Topic-specific authority
- **Zero citations**: May indicate crawlability issues (G4)

### Best Practices

**Content Strategy:**
- Write comprehensive, authoritative content
- Include original research and data
- Provide clear, actionable information
- Update content regularly

**Technical Optimization:**
- Ensure fast loading times
- Use semantic HTML structure
- Implement proper meta tags
- Test across devices and browsers

**Schema Markup:**
- Add Organization and Person schemas
- Include Article and FAQPage markup
- Implement BreadcrumbList navigation
- Use Review and Rating schemas where applicable

### Troubleshooting Low Citations

**If your cited percentage is low:**

1. **Check G4 scores**: Ensure AI crawlers can access your content
2. **Review G1 implementation**: Add clear facts blocks
3. **Verify G2 schema**: Include proper attribution markup
4. **Test content quality**: Ensure information is unique and valuable
5. **Monitor competitors**: See what they're doing differently

**Common Issues:**
- **JavaScript-heavy content**: AI crawlers may not execute JS
- **Paywalls or login requirements**: Block AI access
- **Duplicate content**: Reduces authority and uniqueness
- **Poor mobile experience**: Affects overall crawlability

### API Access

The Citations system provides programmatic access through:

- `POST /api/citations/run`: Trigger manual citation runs
- `GET /api/citations/summary`: Get aggregated metrics
- `GET /api/citations/list`: Retrieve detailed results
- `GET /api/insights`: Combined scoring + citations analysis

### Weekly Automation

Citations are automatically run weekly (Mondays at 14:00 UTC) for:
- Recent audits (last 30 days)
- Completed audits with analyzed pages
- Up to 10 domains per run

This ensures ongoing visibility monitoring without manual intervention.

---

*For technical support or questions about citations, contact the Optiview team.*
