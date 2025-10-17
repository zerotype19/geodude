/**
 * Example-first Scoring Guide
 * Structured content for all AEO/GEO checks with examples
 */

export type CheckDoc = {
  id: string;                            // "A1", "A2", etc.
  slug: string;                          // URL-friendly slug
  title: string;                         // Display title
  category: 'Structure' | 'Authority' | 'Schema' | 'Crawl' | 'UX';
  weight: number;                        // Scoring weight
  summary: string;                       // What it is (1-2 lines)
  whyItMatters: string;                  // AEO/GEO impact
  detectionNotes?: string[];             // How the engine scores this
  examples: {
    good: { caption: string; html?: string; text?: string; schema?: string }[];
    bad: { caption: string; html?: string; text?: string; schema?: string }[];
  };
  implementation: string[];              // Exact steps to fix/ship
  qaChecklist: string[];                 // Verify list
  links?: { label: string; href: string }[];
};

export const CHECKS: CheckDoc[] = [
  // ============================================================================
  // AEO CHECKS
  // ============================================================================
  
  {
    id: 'A1',
    slug: 'answer-first-design',
    title: 'Answer-first design (A1)',
    category: 'Structure',
    weight: 15,
    summary: 'Concise answer at the top that directly addresses the user\'s primary intent.',
    whyItMatters: 'Answer engines extract the first, clearest answer. A strong "lead" improves citation odds and reduces ambiguity.',
    detectionNotes: [
      'Looks for a short paragraph (≤ 40–60 words) or bullets near top',
      'Checks headings like H1/H2 that match query intent',
      'Prefers clean HTML (no hidden/duplicated elements)'
    ],
    examples: {
      good: [
        {
          caption: 'Short lead paragraph',
          text: 'PayPal Digital Wallet lets you pay in apps and online without exposing your card details. Link cards or bank once, then checkout fast and securely across millions of sites.'
        },
        {
          caption: 'Bullet-based answer',
          html: `<h1>What is a Digital Wallet?</h1>
<p>A digital wallet stores payment methods securely for fast online checkout:</p>
<ul>
  <li>Link cards or bank accounts once</li>
  <li>Pay without re-entering details</li>
  <li>Works across millions of merchants</li>
</ul>`
        }
      ],
      bad: [
        {
          caption: 'Burying the answer',
          text: 'Welcome to our digital wallet experience. We\'ve been innovating since 19XX. Our mission is to reimagine payments for everyone... (answer appears 7 paragraphs down)'
        },
        {
          caption: 'No clear lead',
          html: `<h1>Digital Wallet Solutions</h1>
<img src="hero.jpg" alt="...">
<p>Explore our products...</p>`
        }
      ]
    },
    implementation: [
      'Add a 40–60 word answer paragraph directly under the H1',
      'Use one H1 that mirrors the page\'s core intent',
      'If useful, include a 2-4 item bullet list with key benefits/features',
      'Ensure the answer is in static HTML (not lazy-loaded by JS)'
    ],
    qaChecklist: [
      'Is there a 40–60 word lead that answers the main intent?',
      'Is the answer above the fold in raw HTML?',
      'Does the H1 reflect the same intent as the lead?',
      'Can you read the answer with JS disabled?'
    ],
    links: [
      { label: 'View examples', href: '#examples' }
    ]
  },

  {
    id: 'A2',
    slug: 'topical-cluster-integrity',
    title: 'Topical cluster integrity (A2)',
    category: 'Structure',
    weight: 10,
    summary: 'Internal links connect related content into cohesive topic clusters.',
    whyItMatters: 'Answer engines favor sites with clear topical authority. Clusters signal comprehensive coverage and help engines understand relationships.',
    detectionNotes: [
      'Checks for 3+ internal links to related pages',
      'Validates anchor text is descriptive (not "click here")',
      'Prefers contextual links within body content'
    ],
    examples: {
      good: [
        {
          caption: 'Contextual cluster links',
          html: `<p>Our <a href="/products/business-wallet">Business Wallet</a> offers advanced features like invoice generation and multi-user access. For personal use, see our <a href="/products/personal-wallet">Personal Wallet</a> or learn about <a href="/security/buyer-protection">Buyer Protection</a>.</p>`
        }
      ],
      bad: [
        {
          caption: 'Generic anchor text',
          html: `<p>We offer business solutions. <a href="/products/business">Learn more</a>.</p>`
        },
        {
          caption: 'No internal links',
          text: 'Single-page site with no related content links'
        }
      ]
    },
    implementation: [
      'Identify 3-5 related pages for each topic hub',
      'Add descriptive contextual links within body content',
      'Use keyword-rich anchor text that describes the destination',
      'Create a /resources/ or /learn/ hub to interconnect related guides'
    ],
    qaChecklist: [
      'Does each pillar page link to 3+ related pages?',
      'Are anchor texts descriptive (not "click here" or "read more")?',
      'Do links appear in body content (not just nav/footer)?'
    ]
  },

  {
    id: 'A3',
    slug: 'author-attribution',
    title: 'Author attribution (A3)',
    category: 'Authority',
    weight: 8,
    summary: 'Clear author byline with credentials for content requiring expertise.',
    whyItMatters: 'E-E-A-T signal for answer engines. Author attribution builds trust and helps engines verify expertise.',
    detectionNotes: [
      'Looks for <meta name="author"> or visible byline',
      'Checks for author bio or credentials',
      'Prefers Person schema with name and credentials'
    ],
    examples: {
      good: [
        {
          caption: 'Author byline with bio',
          html: `<article>
  <h1>How to Secure Your Digital Wallet</h1>
  <div class="author">
    <img src="/authors/jane-smith.jpg" alt="Jane Smith">
    <div>
      <strong>Jane Smith</strong>
      <p>Security Engineer with 10+ years in payment systems. CISSP certified.</p>
    </div>
  </div>
  <p>Digital wallets store sensitive payment data...</p>
</article>`
        },
        {
          caption: 'Person schema',
          schema: `{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "How to Secure Your Digital Wallet",
  "author": {
    "@type": "Person",
    "name": "Jane Smith",
    "jobTitle": "Security Engineer",
    "credential": "CISSP"
  }
}`
        }
      ],
      bad: [
        {
          caption: 'No author attribution',
          html: `<article>
  <h1>Security Tips</h1>
  <p>Here are some tips...</p>
</article>`
        },
        {
          caption: 'Generic attribution',
          html: `<p>By: Marketing Team</p>`
        }
      ]
    },
    implementation: [
      'Add visible author byline with name and photo',
      'Include 1-2 sentence bio highlighting relevant expertise',
      'Add Person schema in JSON-LD with name, jobTitle, credential',
      'Link to author profile page if available',
      'Use <meta name="author" content="..."> in HTML head'
    ],
    qaChecklist: [
      'Is there a visible author name near the top?',
      'Does the author bio demonstrate relevant expertise?',
      'Is Person schema present in JSON-LD?',
      'Are credentials or qualifications mentioned?'
    ]
  },

  {
    id: 'A4',
    slug: 'cite-credible-sources',
    title: 'Cite credible sources (A4)',
    category: 'Authority',
    weight: 12,
    summary: 'External citations to authoritative sources validate claims.',
    whyItMatters: 'Answer engines check references to verify factual accuracy. Citations reduce hallucination risk and build trust.',
    detectionNotes: [
      'Looks for 1+ external links to authoritative domains',
      'Checks for "Sources" or "References" section',
      'Prefers citations for factual claims or statistics'
    ],
    examples: {
      good: [
        {
          caption: 'Sources section',
          html: `<h2>Sources</h2>
<ul>
  <li><a href="https://www.federalreserve.gov/paymentsystems.htm" rel="noopener">Federal Reserve Payment Systems</a></li>
  <li><a href="https://www.ftc.gov/identity-theft-and-online-security" rel="noopener">FTC Identity Theft Guidelines</a></li>
</ul>`
        },
        {
          caption: 'Inline citation',
          html: `<p>According to the <a href="https://www.federalreserve.gov/..." rel="noopener">Federal Reserve</a>, digital payment adoption increased 45% in 2023.</p>`
        }
      ],
      bad: [
        {
          caption: 'No external citations',
          text: 'Makes factual claims without references'
        },
        {
          caption: 'Only promotional links',
          html: `<p>Sources: <a href="/our-press-releases">Our Press Releases</a></p>`
        }
      ]
    },
    implementation: [
      'Add a "Sources" or "References" section at the end',
      'Link 2-4 authoritative external sources (.gov, .edu, industry leaders)',
      'Use rel="noopener" for external links',
      'Cite sources inline for specific claims or statistics',
      'Prefer recent sources (within 1-2 years for time-sensitive topics)'
    ],
    qaChecklist: [
      'Are there 1+ external links to authoritative sources?',
      'Is there a dedicated "Sources" section?',
      'Do citations support key factual claims?',
      'Are external links using rel="noopener"?'
    ]
  },

  {
    id: 'A5',
    slug: 'schema-accuracy',
    title: 'Schema accuracy (A5)',
    category: 'Schema',
    weight: 10,
    summary: 'Valid JSON-LD for the page type with properties aligned to visible content.',
    whyItMatters: 'Accurate schema increases extractability and reduces hallucination risk in answer engines.',
    detectionNotes: [
      'Parses JSON-LD and checks @type vs. page intent',
      'Validates required fields for target types (FAQPage/Product/HowTo)',
      'Flags mismatches between visible text and schema values'
    ],
    examples: {
      good: [
        {
          caption: 'FAQPage minimal',
          schema: `{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Is PayPal free?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Personal transfers may be free; merchants pay fees."
      }
    }
  ]
}`
        },
        {
          caption: 'Product with offers',
          schema: `{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Business Wallet",
  "description": "Digital wallet for businesses",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  }
}`
        }
      ],
      bad: [
        {
          caption: 'Wrong type',
          schema: `{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Digital Wallet Guide"
}`
        },
        {
          caption: 'Missing required fields',
          schema: `{
  "@context": "https://schema.org",
  "@type": "FAQPage"
}`
        }
      ]
    },
    implementation: [
      'Choose the page-appropriate @type (WebPage/Product/FAQPage/HowTo/Article)',
      'Generate JSON-LD server-side; inject as <script type="application/ld+json">',
      'Ensure fields match on-page copy (name, description, FAQ text)',
      'Validate with Google Rich Results Test + schema.org validator',
      'Use one JSON-LD block per type; avoid conflicting types'
    ],
    qaChecklist: [
      'Does @type match the page intent?',
      'Are required fields present and accurate?',
      'Do schema values match visible content?',
      'Is there one clear primary type (no conflicts)?'
    ]
  },

  {
    id: 'A6',
    slug: 'crawlable-urls',
    title: 'Crawlable URLs (A6)',
    category: 'Crawl',
    weight: 10,
    summary: 'Clean, semantic URLs discoverable via sitemap and internal links.',
    whyItMatters: 'Answer engine bots must discover and crawl content. Poor URL structure limits visibility.',
    detectionNotes: [
      'Checks for sitemap.xml presence',
      'Validates URLs are in sitemap',
      'Looks for clean paths (not /page?id=123)'
    ],
    examples: {
      good: [
        {
          caption: 'Semantic URLs',
          text: '/products/business-wallet\n/learn/security-tips\n/support/faq'
        },
        {
          caption: 'Sitemap entry',
          html: `<url>
  <loc>https://example.com/products/business-wallet</loc>
  <lastmod>2025-01-15</lastmod>
  <priority>0.8</priority>
</url>`
        }
      ],
      bad: [
        {
          caption: 'Query parameters',
          text: '/page?id=123&type=product&ref=home'
        },
        {
          caption: 'No sitemap',
          text: 'Content not listed in sitemap.xml'
        }
      ]
    },
    implementation: [
      'Generate sitemap.xml with all public pages',
      'Use semantic URL patterns: /category/page-name',
      'Avoid query parameters for primary content URLs',
      'Submit sitemap in robots.txt: Sitemap: https://example.com/sitemap.xml',
      'Update sitemap when adding/removing pages'
    ],
    qaChecklist: [
      'Does sitemap.xml exist and load?',
      'Are all key pages in the sitemap?',
      'Are URLs semantic (not /page?id=X)?',
      'Is sitemap referenced in robots.txt?'
    ]
  },

  {
    id: 'A7',
    slug: 'mobile-ux',
    title: 'Mobile UX (A7)',
    category: 'UX',
    weight: 8,
    summary: 'Content readable on mobile without zooming or horizontal scroll.',
    whyItMatters: 'Answer engines prioritize mobile-friendly content. Poor mobile UX reduces citation odds.',
    detectionNotes: [
      'Checks for viewport meta tag',
      'Validates text size ≥ 16px',
      'Looks for responsive images'
    ],
    examples: {
      good: [
        {
          caption: 'Viewport meta',
          html: `<meta name="viewport" content="width=device-width, initial-scale=1">`
        },
        {
          caption: 'Responsive text',
          html: `<style>
  body { font-size: 16px; line-height: 1.5; }
  @media (max-width: 768px) {
    body { font-size: 18px; }
  }
</style>`
        }
      ],
      bad: [
        {
          caption: 'No viewport',
          html: `<!-- Missing viewport meta -->`
        },
        {
          caption: 'Tiny text',
          html: `<style>body { font-size: 10px; }</style>`
        }
      ]
    },
    implementation: [
      'Add viewport meta tag to <head>',
      'Set base font-size ≥ 16px',
      'Use responsive units (rem, em, %) instead of fixed px',
      'Test on real mobile devices or Chrome DevTools mobile emulation',
      'Ensure tap targets are ≥ 48x48px'
    ],
    qaChecklist: [
      'Is viewport meta tag present?',
      'Is text readable without zooming?',
      'Do buttons/links have adequate tap targets?',
      'Does content fit screen width (no horizontal scroll)?'
    ]
  },

  {
    id: 'A8',
    slug: 'page-speed',
    title: 'Page speed (A8)',
    category: 'UX',
    weight: 7,
    summary: 'Fast page load (LCP < 2.5s) with efficient resource delivery.',
    whyItMatters: 'Slow pages frustrate users and reduce crawl budget. Speed impacts answer engine rankings.',
    detectionNotes: [
      'Measures LCP (Largest Contentful Paint)',
      'Checks for lazy-loaded images',
      'Validates resource compression'
    ],
    examples: {
      good: [
        {
          caption: 'Lazy-loaded images',
          html: `<img src="hero.jpg" alt="..." loading="lazy" width="800" height="600">`
        },
        {
          caption: 'Preconnect to CDN',
          html: `<link rel="preconnect" href="https://cdn.example.com">`
        }
      ],
      bad: [
        {
          caption: 'No lazy loading',
          html: `<img src="large-image.jpg" alt="...">`
        },
        {
          caption: 'Unoptimized assets',
          text: 'Large images without compression or modern formats'
        }
      ]
    },
    implementation: [
      'Add loading="lazy" to below-fold images',
      'Use modern image formats (WebP, AVIF) with fallbacks',
      'Preload critical resources with <link rel="preload">',
      'Enable gzip/brotli compression',
      'Minimize JS/CSS; defer non-critical scripts',
      'Use a CDN for static assets'
    ],
    qaChecklist: [
      'Is LCP < 2.5s (test with PageSpeed Insights)?',
      'Are images lazy-loaded and optimized?',
      'Are critical resources preloaded?',
      'Is compression enabled (gzip/brotli)?'
    ]
  },

  {
    id: 'A9',
    slug: 'structured-content',
    title: 'Structured content (A9)',
    category: 'Structure',
    weight: 8,
    summary: 'Clear headings (H1-H3), lists, and tables that organize information hierarchically.',
    whyItMatters: 'Answer engines parse HTML structure to understand content hierarchy. Clear markup improves extraction.',
    detectionNotes: [
      'Checks for proper heading hierarchy (H1 → H2 → H3)',
      'Looks for lists (ul/ol) for enumerated content',
      'Validates tables for tabular data'
    ],
    examples: {
      good: [
        {
          caption: 'Proper hierarchy',
          html: `<h1>Digital Wallet Guide</h1>
<h2>Features</h2>
<ul>
  <li>Secure storage</li>
  <li>Fast checkout</li>
</ul>
<h2>Pricing</h2>
<table>
  <tr><td>Personal</td><td>Free</td></tr>
  <tr><td>Business</td><td>$9.99/mo</td></tr>
</table>`
        }
      ],
      bad: [
        {
          caption: 'Skipped headings',
          html: `<h1>Guide</h1>
<h4>Features</h4>`
        },
        {
          caption: 'No semantic markup',
          html: `<div class="title">Features</div>
<div>Feature 1</div>
<div>Feature 2</div>`
        }
      ]
    },
    implementation: [
      'Use one H1 per page for the main topic',
      'Follow heading hierarchy: H1 → H2 → H3 (no skipping)',
      'Use <ul>/<ol> for lists instead of <div> or <p>',
      'Use <table> for tabular data (not for layout)',
      'Ensure headings describe the content that follows'
    ],
    qaChecklist: [
      'Is there exactly one H1?',
      'Do headings follow hierarchy (no skips)?',
      'Are lists using <ul>/<ol>?',
      'Are tables used for data (not layout)?'
    ]
  },

  {
    id: 'A10',
    slug: 'citations-and-sources',
    title: 'Citations and sources (A10)',
    category: 'Authority',
    weight: 10,
    summary: 'Short "Sources" section with credible outbound references.',
    whyItMatters: 'AI models prefer content that cites sources. Citations reduce hallucination and build trust. Note: AIO behavior is still evolving.',
    detectionNotes: [
      'Looks for outbound links in content or dedicated sources section',
      'Checks domain authority of linked sources',
      'Prefers .gov, .edu, or established industry sources'
    ],
    examples: {
      good: [
        {
          caption: 'Sources section',
          html: `<h2>Sources</h2>
<ul>
  <li><a href="https://www.ftc.gov/online-security" rel="noopener">FTC Online Security Guidelines</a></li>
  <li><a href="https://www.federalreserve.gov/payment-systems" rel="noopener">Federal Reserve Payment Systems</a></li>
</ul>`
        }
      ],
      bad: [
        {
          caption: 'No sources',
          text: 'Makes claims without external references'
        }
      ]
    },
    implementation: [
      'Add a "Sources" or "References" section at the end',
      'Include 2-4 authoritative external links',
      'Prefer government, academic, or industry-leading sources',
      'Use rel="noopener" for security',
      'Update sources periodically to keep current'
    ],
    qaChecklist: [
      'Is there a dedicated sources section?',
      'Are 2+ credible external sources linked?',
      'Are sources relevant to the content claims?'
    ]
  },

  {
    id: 'A11',
    slug: 'render-visibility',
    title: 'Render visibility (SPA Risk) (A11)',
    category: 'Crawl',
    weight: 10,
    summary: 'Content visible in static HTML, not dependent on JavaScript rendering.',
    whyItMatters: 'Answer engines may not execute JavaScript. JS-dependent content risks being invisible to crawlers.',
    detectionNotes: [
      'Compares static HTML vs. rendered DOM',
      'Calculates render gap ratio (static/rendered)',
      'Flags pages with <30% static visibility'
    ],
    examples: {
      good: [
        {
          caption: 'Server-rendered HTML',
          html: `<article>
  <h1>Digital Wallet Guide</h1>
  <p>A digital wallet stores payment methods...</p>
</article>`
        }
      ],
      bad: [
        {
          caption: 'JS-dependent',
          html: `<div id="root"></div>
<script>
  // Content rendered by React/Vue/Angular
</script>`
        }
      ]
    },
    implementation: [
      'Use server-side rendering (SSR) for content pages',
      'Ensure core content is in static HTML (view source)',
      'Test with JS disabled to verify visibility',
      'If using SPA, implement SSR or pre-rendering',
      'Avoid lazy-loading critical content'
    ],
    qaChecklist: [
      'Is content visible in "View Source" (not just "Inspect Element")?',
      'Does page work with JavaScript disabled?',
      'Is render gap ratio > 50% (more than half visible statically)?'
    ]
  },

  // ============================================================================
  // GEO CHECKS
  // ============================================================================

  {
    id: 'G1',
    slug: 'clear-entity-definition',
    title: 'Clear entity definition (G1)',
    category: 'Structure',
    weight: 12,
    summary: 'First paragraph defines the main entity (brand, product, concept) clearly.',
    whyItMatters: 'LLMs extract entity definitions for knowledge graphs. Clear definitions improve training data quality.',
    detectionNotes: [
      'Looks for definition in first 200 characters',
      'Checks for entity name in first paragraph',
      'Prefers "X is a Y that Z" pattern'
    ],
    examples: {
      good: [
        {
          caption: 'Clear definition',
          text: 'PayPal is a digital payment platform that enables online money transfers between individuals and businesses worldwide.'
        }
      ],
      bad: [
        {
          caption: 'Vague intro',
          text: 'Welcome to our platform. We offer innovative solutions for modern commerce.'
        }
      ]
    },
    implementation: [
      'Start with "X is a Y that Z" pattern in first paragraph',
      'Include the entity name (brand/product) explicitly',
      'Define in 1-2 sentences',
      'Place definition before marketing copy'
    ],
    qaChecklist: [
      'Does first paragraph define the main entity?',
      'Is the definition clear and factual?',
      'Is entity name used in definition?'
    ]
  },

  {
    id: 'G2',
    slug: 'comprehensive-coverage',
    title: 'Comprehensive coverage (G2)',
    category: 'Structure',
    weight: 10,
    summary: 'In-depth content covering multiple facets of the topic (300+ words).',
    whyItMatters: 'LLMs prefer comprehensive sources for training. Shallow content is less useful for model grounding.',
    detectionNotes: [
      'Checks word count ≥ 300',
      'Looks for multiple H2 sections',
      'Validates content depth with entity/keyword coverage'
    ],
    examples: {
      good: [
        {
          caption: 'Multi-faceted coverage',
          html: `<h1>Digital Wallets</h1>
<h2>How They Work</h2>
<p>300+ words explaining mechanics...</p>
<h2>Security</h2>
<p>Details on encryption, authentication...</p>
<h2>Use Cases</h2>
<p>Online shopping, peer-to-peer, subscriptions...</p>`
        }
      ],
      bad: [
        {
          caption: 'Shallow content',
          html: `<h1>Digital Wallets</h1>
<p>Digital wallets are convenient. Sign up today!</p>`
        }
      ]
    },
    implementation: [
      'Write 300+ words covering multiple angles',
      'Use 3+ H2 sections for different facets',
      'Include examples, use cases, and details',
      'Cover "how it works," "benefits," and "when to use"'
    ],
    qaChecklist: [
      'Is content ≥ 300 words?',
      'Are there 3+ H2 sections?',
      'Does content cover multiple aspects of the topic?'
    ]
  },

  {
    id: 'G3',
    slug: 'natural-language',
    title: 'Natural language (G3)',
    category: 'Structure',
    weight: 8,
    summary: 'Conversational tone with varied sentence structure (not keyword-stuffed).',
    whyItMatters: 'LLMs trained on natural text penalize awkward phrasing. Natural language improves training utility.',
    detectionNotes: [
      'Checks for keyword density < 3%',
      'Validates sentence variety',
      'Flags repetitive phrasing'
    ],
    examples: {
      good: [
        {
          caption: 'Natural flow',
          text: 'Digital wallets simplify online payments. Instead of entering card details every time, you store them securely once. This speeds up checkout and reduces fraud risk.'
        }
      ],
      bad: [
        {
          caption: 'Keyword stuffing',
          text: 'Digital wallet digital payments digital wallet secure digital wallet online digital wallet fast digital wallet.'
        }
      ]
    },
    implementation: [
      'Write as if explaining to a colleague',
      'Vary sentence length and structure',
      'Use transitions (however, meanwhile, in contrast)',
      'Avoid repeating exact phrases',
      'Read aloud to check for awkwardness'
    ],
    qaChecklist: [
      'Does content sound natural when read aloud?',
      'Is keyword density < 3%?',
      'Are sentences varied in length?'
    ]
  },

  {
    id: 'G4',
    slug: 'crawlability-and-access',
    title: 'Crawlability and access (G4)',
    category: 'Crawl',
    weight: 15,
    summary: 'Allow AI crawlers (GPTBot, Claude-Web, PerplexityBot) while blocking training crawlers if desired.',
    whyItMatters: 'LLM vendors crawl for training data and real-time answers. Blocking all bots limits visibility.',
    detectionNotes: [
      'Checks robots.txt for GPTBot, Claude-Web, PerplexityBot',
      'Looks for Google-Extended (training) blocks',
      'Validates no blanket Disallow rules'
    ],
    examples: {
      good: [
        {
          caption: 'Allow answer bots, block training',
          text: `User-agent: GPTBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Disallow: /`
        }
      ],
      bad: [
        {
          caption: 'Block all bots',
          text: `User-agent: *
Disallow: /`
        }
      ]
    },
    implementation: [
      'Allow GPTBot, Claude-Web, PerplexityBot in robots.txt',
      'Block Google-Extended if you don\'t want training data use',
      'Test with robots.txt validator',
      'Ensure Disallow rules don\'t block critical content',
      'Note: Compliance varies; some crawlers may ignore rules'
    ],
    qaChecklist: [
      'Are answer bots (GPTBot, Claude, Perplexity) allowed?',
      'Is Google-Extended blocked if desired?',
      'Do Disallow rules not block key content?'
    ],
    links: [
      { label: 'Google-Extended info', href: 'https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers' }
    ]
  },

  {
    id: 'G5',
    slug: 'entity-relationships',
    title: 'Entity relationships (G5)',
    category: 'Schema',
    weight: 10,
    summary: 'Schema.org markup showing relationships between entities (Organization, Product, Person).',
    whyItMatters: 'LLMs use structured relationships for knowledge graphs. Rich schema improves entity understanding.',
    detectionNotes: [
      'Checks for Organization schema with nested entities',
      'Validates relationships (maker, author, publisher)',
      'Looks for sameAs links to external profiles'
    ],
    examples: {
      good: [
        {
          caption: 'Organization with products',
          schema: `{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "PayPal",
  "url": "https://www.paypal.com",
  "sameAs": [
    "https://en.wikipedia.org/wiki/PayPal",
    "https://www.linkedin.com/company/paypal"
  ],
  "owns": {
    "@type": "Product",
    "name": "Business Wallet"
  }
}`
        }
      ],
      bad: [
        {
          caption: 'Flat schema',
          schema: `{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "PayPal"
}`
        }
      ]
    },
    implementation: [
      'Add Organization schema to homepage',
      'Include sameAs links to Wikipedia, LinkedIn, Crunchbase',
      'Nest Product or Service entities under Organization',
      'Use author/publisher for articles',
      'Validate with Google Rich Results Test'
    ],
    qaChecklist: [
      'Is Organization schema present?',
      'Are sameAs links to external profiles included?',
      'Are nested entities (products, services) defined?'
    ]
  },

  {
    id: 'G6',
    slug: 'factual-accuracy',
    title: 'Factual accuracy (G6)',
    category: 'Authority',
    weight: 12,
    summary: 'Verifiable claims with no contradictions or outdated information.',
    whyItMatters: 'LLMs trained on inaccurate data perpetuate errors. Accuracy is critical for responsible AI training.',
    detectionNotes: [
      'Checks for date stamps on time-sensitive content',
      'Looks for sources/references',
      'Flags contradictory statements'
    ],
    examples: {
      good: [
        {
          caption: 'Dated, sourced claim',
          html: `<p>As of January 2025, PayPal serves over 400 million active accounts <a href="https://investor.pypl.com/...">(Source: PayPal Q4 2024 Report)</a>.</p>`
        }
      ],
      bad: [
        {
          caption: 'Outdated claim',
          text: 'PayPal has 100 million users. (Actual: 400M+ as of 2025)'
        }
      ]
    },
    implementation: [
      'Add publication/update dates to content',
      'Cite sources for statistics and claims',
      'Review annually to update outdated facts',
      'Avoid superlatives without proof (e.g., "the best")',
      'Use "as of [date]" for time-sensitive data'
    ],
    qaChecklist: [
      'Are time-sensitive claims dated?',
      'Are facts cited with sources?',
      'Has content been reviewed in the last 12 months?'
    ]
  },

  {
    id: 'G7',
    slug: 'brand-consistency',
    title: 'Brand consistency (G7)',
    category: 'Authority',
    weight: 8,
    summary: 'Consistent brand name, logo, and messaging across pages.',
    whyItMatters: 'LLMs build entity representations from repeated signals. Inconsistency weakens entity identity.',
    detectionNotes: [
      'Checks for consistent brand name usage',
      'Validates logo presence and alt text',
      'Looks for Organization schema on all pages'
    ],
    examples: {
      good: [
        {
          caption: 'Consistent branding',
          html: `<header>
  <img src="/logo.png" alt="PayPal">
  <nav>...</nav>
</header>`
        }
      ],
      bad: [
        {
          caption: 'Inconsistent naming',
          text: 'Page 1: "PayPal"\nPage 2: "Pay Pal"\nPage 3: "Paypal.com"'
        }
      ]
    },
    implementation: [
      'Use exact brand name consistently (including capitalization)',
      'Add logo to all pages with consistent alt text',
      'Include Organization schema sitewide',
      'Use same brand name in meta tags, schema, and content'
    ],
    qaChecklist: [
      'Is brand name spelled identically across pages?',
      'Is logo present with proper alt text?',
      'Is Organization schema on all pages?'
    ]
  },

  {
    id: 'G8',
    slug: 'semantic-html',
    title: 'Semantic HTML (G8)',
    category: 'Structure',
    weight: 8,
    summary: 'Use semantic tags (<article>, <section>, <nav>) instead of generic <div>.',
    whyItMatters: 'Semantic HTML helps LLMs understand page structure and content roles.',
    detectionNotes: [
      'Checks for <article>, <section>, <nav> usage',
      'Validates proper nesting',
      'Prefers semantic tags over <div> for content'
    ],
    examples: {
      good: [
        {
          caption: 'Semantic structure',
          html: `<article>
  <header>
    <h1>Digital Wallet Guide</h1>
  </header>
  <section>
    <h2>Features</h2>
    <p>...</p>
  </section>
  <footer>
    <p>Published: 2025-01-15</p>
  </footer>
</article>`
        }
      ],
      bad: [
        {
          caption: 'Generic divs',
          html: `<div class="article">
  <div class="header">
    <div class="title">Guide</div>
  </div>
  <div class="content">...</div>
</div>`
        }
      ]
    },
    implementation: [
      'Use <article> for main content blocks',
      'Use <section> for thematic groupings',
      'Use <nav> for navigation menus',
      'Use <header>/<footer> for page/section headers/footers',
      'Reserve <div> for styling containers only'
    ],
    qaChecklist: [
      'Are <article>/<section> used for content?',
      'Is <nav> used for navigation?',
      'Are semantic tags preferred over <div> where appropriate?'
    ]
  },

  {
    id: 'G9',
    slug: 'content-freshness',
    title: 'Content freshness (G9)',
    category: 'Authority',
    weight: 7,
    summary: 'Publication and update dates visible, with regular content reviews.',
    whyItMatters: 'LLMs prioritize recent information. Dated content signals relevance and maintenance.',
    detectionNotes: [
      'Looks for datePublished/dateModified in schema',
      'Checks for visible date stamps',
      'Prefers updates within last 12 months'
    ],
    examples: {
      good: [
        {
          caption: 'Visible dates',
          html: `<article>
  <h1>Digital Wallet Guide</h1>
  <p class="meta">Published: January 15, 2025 | Updated: January 17, 2025</p>
  <p>Content...</p>
</article>`
        },
        {
          caption: 'Schema dates',
          schema: `{
  "@context": "https://schema.org",
  "@type": "Article",
  "datePublished": "2025-01-15",
  "dateModified": "2025-01-17"
}`
        }
      ],
      bad: [
        {
          caption: 'No dates',
          html: `<article>
  <h1>Guide</h1>
  <p>Content...</p>
</article>`
        }
      ]
    },
    implementation: [
      'Add visible publication date near title',
      'Show "Last updated" date for evergreen content',
      'Include datePublished/dateModified in Article schema',
      'Review and update content annually',
      'Update the dateModified when refreshing content'
    ],
    qaChecklist: [
      'Is publication date visible?',
      'Is "last updated" shown for older content?',
      'Are dates included in Article schema?'
    ]
  },

  {
    id: 'G10',
    slug: 'contextual-linking',
    title: 'Contextual linking (G10)',
    category: 'Structure',
    weight: 8,
    summary: 'Internal links with descriptive anchor text that provides context.',
    whyItMatters: 'LLMs use link context to understand relationships. Descriptive anchors improve entity graphs.',
    detectionNotes: [
      'Checks for contextual internal links',
      'Validates anchor text is descriptive',
      'Prefers links within content body'
    ],
    examples: {
      good: [
        {
          caption: 'Descriptive anchors',
          html: `<p>Our <a href="/products/business-wallet">Business Wallet offers invoice generation</a> for merchants, while the <a href="/products/personal-wallet">Personal Wallet focuses on peer-to-peer transfers</a>.</p>`
        }
      ],
      bad: [
        {
          caption: 'Generic anchors',
          html: `<p>Check out our products. <a href="/products/business">Click here</a> or <a href="/products/personal">read more</a>.</p>`
        }
      ]
    },
    implementation: [
      'Use descriptive anchor text (not "click here")',
      'Include context in surrounding text',
      'Link to related pages within content body',
      'Ensure anchor text describes the destination',
      'Aim for 3-5 contextual links per page'
    ],
    qaChecklist: [
      'Are anchor texts descriptive?',
      'Do links appear within content (not just nav/footer)?',
      'Does surrounding text provide context for links?'
    ]
  }
];

// ID to slug mapping for deep-linking
export const ID_TO_SLUG: Record<string, string> = 
  Object.fromEntries(CHECKS.map(c => [c.id, c.slug]));

// Helper to get check by ID
export function getCheckById(id: string): CheckDoc | undefined {
  return CHECKS.find(c => c.id === id);
}

// Helper to get check by slug
export function getCheckBySlug(slug: string): CheckDoc | undefined {
  return CHECKS.find(c => c.slug === slug);
}

// Group checks by category
export function groupChecksByCategory() {
  const grouped: Record<string, CheckDoc[]> = {};
  for (const check of CHECKS) {
    if (!grouped[check.category]) grouped[check.category] = [];
    grouped[check.category].push(check);
  }
  return grouped;
}

