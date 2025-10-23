import React from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

const citationsGuideContent = `## How We Measure AI Visibility

The Citations system reveals how frequently your domain is referenced across major AI platforms-using **human-realistic query patterns** that mirror what real users actually ask. Unlike generic testing tools, Optiview's citation engine uses **self-learning context extraction** to generate queries that evolve with your content.

### What We Track

**AI Sources:**
- **ChatGPT** (OpenAI): GPT-4 responses that cite your content
- **Claude** (Anthropic): Claude's answers referencing your domain
- **Perplexity**: AI search results that link to your pages
- **Brave Search**: AI-powered search results (AEO coverage)

**Metrics:**
- **Cited Percentage by Source**: % of queries where each AI source referenced your domain
- **Citation Count**: Total number of times your URLs appear across all sources
- **Top Cited URLs**: Your pages most frequently referenced by AI systems
- **Query Performance**: Which searches lead to citations, with per-source breakdown

### How Citations Are Calculated

#### 1. Adaptive Query Intelligence (v4-llm)

Optiview doesn't use fixed templates. Instead, we've built a **context-aware prompt generation system** that learns from your actual site content to produce queries indistinguishable from real user searches:

**What Makes Our Queries Unique:**

✨ **Human-realistic patterns**: Our query engine analyzes your homepage, meta descriptions, and site structure to generate questions that match natural language patterns-no awkward grammar, no "cruises cruises" repetition, no generic templates.

🧠 **Self-learning context extraction**: After every audit, the system automatically:
- Extracts your brand identity with intelligent camelCase and compound-word splitting
- Identifies primary entities and 2-word semantic phrases
- Classifies your site type (e-commerce, media, corporate, software, nonprofit)
- Maps competitive positioning and category relationships
- Updates a **Prompt Intelligence Index** that improves with each audit

🎯 **Intent diversity**: Queries span multiple user journeys-comparison, informational, evaluative, commercial, and navigational-ensuring comprehensive coverage of how real users discover and evaluate your content.

🔄 **Dynamic adaptation**: The system continuously refines its understanding of your domain, detecting brand aliases, filtering meta-noise, and ensuring query realism through multi-layer quality gates.

**The result?** Queries that AI platforms process as genuine user questions, giving you accurate visibility into how your content performs when people are actually searching.

**How It Works (High-Level):**

Our proprietary query engine combines:
- **Contextual grounding**: Analyzes your homepage title, H1, meta description, and site structure
- **Entity intelligence**: Extracts brand name, primary topics, and semantic relationships
- **Intent modeling**: Maps your content to real user search behaviors
- **Quality filtering**: Multi-stage validation ensures queries read like authentic user questions
- **Competitive awareness**: Understands category positioning without explicit input

**Query Types Generated:**

**🏷️ Branded Queries (~10 per run):**

Questions that test brand recognition and direct discovery:
- Identity queries ("What is [Brand]?")
- Service/product inquiries
- Trust and safety questions
- Contact and support searches
- Comparative positioning
- Brand-specific FAQs

**🌐 Non-Branded Queries (~18 per run):**

Category-level questions that test topical authority across multiple intent types:

- **🔍 Discovery**: "Best [category] options", "Top [services] to consider"
- **📚 Informational**: "How does [technology] work?", "What are [services]?"
- **⚖️ Evaluative**: "Pros and cons of [category]", "Is [service] worth it?"
- **💰 Commercial**: "How much does [service] cost?", "[Category] pricing guide"
- **🔄 Alternatives**: "Alternatives to [category]", "[Service] competitors"
- **🎯 Problem-solving**: "How to [accomplish goal] with [category]"

**Linguistic Quality Assurance:**

Every query passes through intelligent filters that ensure:
- ✅ Natural grammar and syntax
- ✅ No brand leakage into non-branded queries
- ✅ No repetitive phrases or awkward constructions
- ✅ Appropriate verb conjugation and pluralization
- ✅ Intent-appropriate phrasing

The system learns from each audit, refining its understanding of your domain to produce increasingly accurate, human-like queries.

---

#### 2. Self-Learning Intelligence Index

The true power of Optiview's citation system is its **continuous learning architecture**. After every audit and citation run, the system automatically:

**📊 Builds Domain Intelligence:**

- Extracts and normalizes your brand identity across name variants
- Maps primary entities and semantic relationships (2-word phrases, category terms)
- Classifies site type and competitive positioning
- Tracks citation performance trends over time

**🔄 Improves Future Queries:**

- Updates entity frequency models based on what AI platforms respond to
- Refines brand detection logic using real citation outcomes
- Discovers new category relationships through cross-domain pattern matching
- Adapts query diversity based on what produces meaningful answers

**🎯 Enables Semantic Discovery:**

The **Prompt Intelligence Index** powers entity-based search, allowing you to discover:

- Which domains rank for similar entities (competitive intelligence)
- How your citation coverage compares to category peers
- Which entities drive the highest AI visibility
- Emerging topic trends across your industry

This creates a **flywheel effect**: Each audit makes the next one smarter. The system learns which query patterns yield genuine citations, which brand formulations AI platforms recognize, and which content structures maximize visibility-then applies those insights across all future audits.

---

#### 3. Multi-Source AI Querying

Each query is sent in parallel to all configured AI sources (ChatGPT, Claude, Perplexity, Brave) with:
- **Context envelope**: Summary of your site for grounding
- **Concurrent execution**: Up to 3 queries per source at once
- **Rate limiting**: 400ms throttle between requests
- **Error handling**: Automatic retry with exponential backoff

---

#### 4. Citation Detection & Extraction

We parse each AI response to extract:
- **Direct URL citations**: Links to your domain
- **Answer excerpts**: Up to 5000 characters per source
- **Match counts**: How many of your URLs appear in each answer
- **Query type**: Tagged as "branded" or "non-branded" for analysis

---

#### 5. Domain Matching

URLs are normalized and matched against your domain:
- Protocol normalization (http/https)
- www/non-www variants
- Subdomain handling
- Path and query string stripping for deduplication

---

#### 6. Aggregation & Analytics

Results are aggregated by:
- **By Source**: Total citations and cited percentage per AI platform
- **By Query Type**: Branded vs non-branded citation performance
- **By URL**: Which of your pages are most cited
- **By Query**: Which queries produce citations, with all source-specific answers grouped together
- **By Entity**: Intelligence index updated for Agent semantic search

### Improving Your Citations

**High-Impact Strategies:**

**1. Optimize for G1 (Citable Facts Block)**
- Create dedicated "Key Facts" sections
- Use clear, atomic statements
- Include specific numbers, dates, and data points

**2. Enhance G2 (Provenance Schema)**
- Add JSON-LD with \`isBasedOn\`, \`citation\`, \`license\` properties
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
- **0-10%**: Low visibility across that AI platform - focus on G1 (Citable Facts), G2 (Provenance), and G4 (Crawler Access)
- **10-25%**: Moderate visibility - optimize G5 (Chunkability) and A10 (Citations & Sources)
- **25-50%**: Strong visibility - expand content depth and maintain quality
- **50%+**: Excellent visibility - you're a trusted source for this AI platform

**Query Type Performance (Branded vs Non-Branded):**

This breakdown shows how well you're cited when your brand is mentioned vs when users search for topics/categories:

- **🏷️ Branded Queries**: Tests brand awareness - "What is [YourBrand]?", "How do I contact [YourBrand]?"
  - High citation rate (>80%) = Strong brand recognition
  - Low citation rate (<50%) = AI systems don't have good information about your brand
  
- **🌐 Non-Branded Queries**: Tests category authority - "Best ways to [your service]", "How does [your technology] work?"
  - High citation rate (>50%) = You're a trusted authority in your category
  - Low citation rate (<30%) = Opportunity to create more educational/topic-focused content

**Query Results Table:**
Each query shows:
- **Query text**: The question or search prompt
- **Sources**: Badges for each AI platform that was queried (no duplicates)
- **Total Citations**: Sum of citations across all sources for this query
- **View Details button**: Opens a modal with full query details

**View Details Modal:**
Click "View Details" to see:
- Full query text
- All AI sources used
- Total citation count
- Sample answer excerpt (scrollable, up to 5000 characters)
- Last tested timestamp
- **Answers by Source**: Expandable cards for each AI platform showing:
  - Source-specific answer excerpt
  - Citation count for that source
  - Up to 5 cited URLs from that source

**Common Patterns:**
- **Homepage citations**: Brand recognition and "What is [company]?" queries
- **Deep page citations**: Topic-specific authority and niche expertise
- **Zero citations**: May indicate crawlability issues (G4), content gaps, or new domain with low authority

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

### Running Citations

**Manual Citation Runs:**
1. Navigate to any completed audit
2. Click the "Citations" tab
3. Click "Run Citations" button
4. Select which AI sources to query (ChatGPT, Claude, Perplexity, Brave)
5. Optionally edit the generated queries
6. Click "Start Run"

**What Happens:**
- Queries are generated based on your site description + homepage metadata
- Each query is sent to selected AI sources in parallel
- Results are stored in the database with full answer excerpts
- Summary cards and tables are updated in real-time
- All results are cached for historical comparison

**Rate Limits:**
- Max 3 concurrent API calls per source
- 400ms throttle between requests
- Respects each AI platform's rate limits

### Intelligent Caching & Real-Time Adaptation

Optiview's citation system uses a **three-tier intelligent caching architecture** that balances speed with freshness:

**⚡ Tier 1: Hot Cache (KV Store)**

- **5-10ms response time**
- Project-namespaced for multi-tenant isolation
- 7-day TTL with smart invalidation
- Serves 90% of requests instantly

**📦 Tier 2: Canonical Store (D1 SQL)**

- **50-100ms response time**
- Durable backup with full query history
- Version tracking (v2-contextual → v3-archetypes → v4-llm)
- Enables historical trend analysis

**🔨 Tier 3: Fresh Build (On-Demand)**

- **300-500ms response time**
- Triggered by cache miss or audit completion
- Applies latest prompt intelligence models
- Results automatically cached for future use

---

**🔄 Automatic Learning Cycle:**

The system continuously refines itself through:

- **Post-Audit Updates**: Brand, entities, and site type immediately indexed
- **Hourly Refresh Jobs**: Updates 100 least-recently-refreshed domains with latest intelligence
- **Citation Feedback Loop**: Analyzes which queries produce citations, feeding back into query generation
- **Cross-Domain Pattern Mining**: Learns from successful query patterns across thousands of audits

---

**Intelligence Index Architecture:**

Every domain in Optiview has a living intelligence profile:

- **Brand Identity**: Normalized name, variants, and aliases
- **Entity Graph**: Primary topics, semantic phrases, category memberships
- **Site Classification**: E-commerce, corporate, media, software, nonprofit
- **Performance Metrics**: Avg citation %, total citations, last run timestamp
- **Query Effectiveness**: Which prompt patterns work best for your domain type

---

**Semantic Discovery & Competitive Intelligence:**

The intelligence index enables powerful cross-domain insights:

- Find competitors by entity overlap
- Benchmark citation performance against category peers
- Discover emerging topic trends in your industry
- Identify content gaps where competitors are cited but you're not

This creates a **network effect**: As more domains are audited, the system learns universal patterns about what makes content citable, which it applies to improve every future audit.

### API Access

The Citations system provides programmatic access through:

**Query & Prompt Endpoints:**
- \`GET /api/llm/prompts?domain=example.com\`: Get cached branded/non-branded queries with metadata
- \`GET /api/prompts/related?entity=cruise&limit=20\`: Find related domains by entity for competitive intelligence

**Citation Endpoints:**
- \`POST /api/citations/run\`: Trigger manual citation runs with custom queries and source selection
- \`GET /api/citations/summary\`: Get aggregated metrics (by source, top URLs, top queries with per-source answers)
- \`GET /api/citations/list\`: Retrieve detailed citation records
- \`GET /api/insights/:domain\`: Combined AEO/GEO scoring + citations analysis

**Performance:**
- Cache hit rate: ~98% (90% KV, 8% D1)
- Avg response time: <20ms for cached queries
- Supports 10K-100K domains/day scalability

### Weekly Automation

Citations are automatically run weekly (Mondays at 14:00 UTC) for:
- Recent audits (last 30 days)
- Completed audits with analyzed pages
- Up to 10 domains per run
- All configured AI sources

This ensures ongoing visibility monitoring without manual intervention.

---

## Why Optiview's Citation System Is Different

**Traditional citation tools** use static templates and fixed queries that feel robotic-AI platforms recognize them as synthetic and may respond differently than they would to genuine user queries.

**Optiview's approach** is fundamentally different:

**✨ Learns from your actual content**

No two domains get the same queries-each audit produces unique, contextually grounded questions based on *your* homepage, *your* brand, and *your* positioning.

**🧠 Self-improving intelligence**

The system gets smarter with every audit, learning which query patterns, entity combinations, and linguistic structures produce genuine AI citations across different site types and industries.

**🎯 Human-realistic at scale**

Our multi-layer quality filtering ensures queries read like authentic user questions-proper grammar, natural phrasing, intent-appropriate language-so AI platforms treat them as real searches.

**🔄 Cross-domain learning**

Insights from thousands of audits feed back into the prompt generation engine, creating a network effect where every new audit improves the system for everyone.

**📊 Actionable intelligence**

Beyond citation counts, you get entity-level insights, competitive benchmarking, and trend analysis-powered by the same intelligence index that generates your queries.

**The result?** Citation metrics you can trust, based on queries that mirror what real users actually ask-giving you genuine insight into how AI platforms will surface your content when it matters most.

---

*For technical support or questions about citations, contact the Optiview team.*`;

export default function CitationsGuide() {
  return (
    <div className="min-h-screen bg-surface-2">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link to="/audits" className="text-brand hover:text-brand mb-2 inline-block">
            ← Back to Audits
          </Link>
          <h1 className="text-3xl font-bold ">Citations Guide</h1>
          <p className="mt-2 muted">
            Self-learning citation intelligence powered by human-realistic query generation
          </p>
        </div>

        {/* Content */}
        <div className="bg-surface-1 shadow rounded-lg">
          <div className="px-6 py-8">
            <div className="prose prose-lg max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                  // Style h1
                  h1: ({ node, ...props }) => (
                    <h1 className="text-4xl font-bold  mb-8 mt-0" {...props} />
                  ),
                  // Style h2
                  h2: ({ node, ...props }) => (
                    <h2 className="text-3xl font-bold  first:mt-0 mt-16 mb-6 pb-3 border-b-2 border-border" {...props} />
                  ),
                  // Style h3
                  h3: ({ node, ...props }) => (
                    <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-8" {...props} />
                  ),
                  // Style h4 (for numbered sections)
                  h4: ({ node, ...props }) => (
                    <h4 className="text-2xl font-bold  mb-4 mt-10 pb-2 border-b border-border" {...props} />
                  ),
                  // Style lists with proper indentation
                  ul: ({ node, ...props }) => (
                    <ul className="list-disc ml-6 space-y-2 muted my-4 [&_ul]:ml-6 [&_ul]:mt-2" {...props} />
                  ),
                  ol: ({ node, ...props }) => (
                    <ol className="list-decimal ml-6 space-y-2 muted my-4 [&_ol]:ml-6 [&_ol]:mt-2" {...props} />
                  ),
                  li: ({ node, ...props }) => (
                    <li className="leading-relaxed" {...props} />
                  ),
                  // Style paragraphs
                  p: ({ node, ...props }) => (
                    <p className="muted leading-relaxed my-3" {...props} />
                  ),
                  // Style code blocks
                  code: ({ node, inline, className, children, ...props }) => {
                    const isInline = inline !== false;
                    return isInline ? (
                      <code 
                        className="inline-block bg-gray-800 text-green-400 px-2 py-0.5 mx-0.5 rounded text-sm font-mono align-baseline"
                        {...props}
                      >
                        {children}
                      </code>
                    ) : (
                      <code 
                        className="block bg-gray-800 text-green-400 p-4 rounded text-sm overflow-x-auto my-4 font-mono"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                  // Style strong (bold) text
                  strong: ({ node, ...props }) => (
                    <strong className="font-semibold " {...props} />
                  ),
                  // Style emphasis (italic) text
                  em: ({ node, ...props }) => (
                    <em className="italic muted" {...props} />
                  ),
                }}
              >
                {citationsGuideContent}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
