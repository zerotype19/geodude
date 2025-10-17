import React from 'react';
import { Link } from 'react-router-dom';

const citationsGuideContent = `# Citations Guide

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

1. **Query Generation**: We create 8-12 targeted queries based on:
   - Your domain and brand name
   - Top page titles from recent audits
   - Industry-relevant search terms

2. **AI Querying**: Each query is sent to all configured AI sources

3. **Citation Detection**: We extract and normalize URLs from AI responses

4. **Domain Matching**: URLs are matched against your domain (including www/non-www variants)

5. **Scoring**: Cited percentage = (queries that cited you) / (total queries) × 100

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

- \`POST /api/citations/run\`: Trigger manual citation runs
- \`GET /api/citations/summary\`: Get aggregated metrics
- \`GET /api/citations/list\`: Retrieve detailed results
- \`GET /api/insights\`: Combined scoring + citations analysis

### Weekly Automation

Citations are automatically run weekly (Mondays at 14:00 UTC) for:
- Recent audits (last 30 days)
- Completed audits with analyzed pages
- Up to 10 domains per run

This ensures ongoing visibility monitoring without manual intervention.

---

*For technical support or questions about citations, contact the Optiview team.*`;

export default function CitationsGuide() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link to="/audits" className="text-blue-600 hover:text-blue-800 mb-2 inline-block">
            ← Back to Audits
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Citations Guide</h1>
          <p className="mt-2 text-gray-600">
            Understanding AI visibility and citation metrics
          </p>
        </div>

        {/* Content */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-8">
            <div className="prose prose-lg max-w-none">
              {citationsGuideContent.split('\n').map((line, index) => {
                if (line.startsWith('# ')) {
                  return <h1 key={index} className="text-2xl font-bold text-gray-900 mb-4">{line.substring(2)}</h1>;
                } else if (line.startsWith('## ')) {
                  return <h2 key={index} className="text-xl font-semibold text-gray-900 mt-6 mb-3">{line.substring(3)}</h2>;
                } else if (line.startsWith('### ')) {
                  return <h3 key={index} className="text-lg font-medium text-gray-900 mt-4 mb-2">{line.substring(4)}</h3>;
                } else if (line.startsWith('**') && line.endsWith('**')) {
                  return <p key={index} className="font-semibold text-gray-900 mt-3 mb-1">{line.substring(2, line.length - 2)}</p>;
                } else if (line.startsWith('- ')) {
                  return <li key={index} className="text-gray-700 mb-1">{line.substring(2)}</li>;
                } else if (line.trim() === '') {
                  return <br key={index} />;
                } else if (line.startsWith('*') && line.endsWith('*')) {
                  return <p key={index} className="text-sm text-gray-500 italic mt-4">{line.substring(1, line.length - 1)}</p>;
                } else {
                  return <p key={index} className="text-gray-700 mb-3">{line}</p>;
                }
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
