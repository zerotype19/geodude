/**
 * Per-Page Recommendations Engine
 * Deterministic schema & content suggestions based on page signals
 */

export interface PageSignals {
  url: string;
  title: string | null;
  h1: string | null;
  words: number;
  jsonLdCount: number;
  jsonLdTypes: string[];  // Existing schema types found on page
  faqPresent: boolean;
  hasPrice: boolean;
  hasAddress: boolean;
  hasPhone: boolean;
  hasList: boolean;
  hasHowTo: boolean;
  pathSegments: string[];
}

export interface RecommendationOutput {
  inferredType: string;  // Primary content type
  missingSchemas: string[];  // Schema types to add
  suggestedJsonLd: Array<{
    type: string;
    json: any;
    copyButton: string;  // Label for copy button
  }>;
  copyBlocks: Array<{
    label: string;
    content: string;
  }>;
  priority: 'high' | 'medium' | 'low';
  rationale: string;
}

/**
 * Infer page intent from URL path and content signals
 */
export function inferPageIntent(signals: PageSignals): string {
  const path = signals.url.toLowerCase();
  const pathLower = signals.pathSegments.join('/').toLowerCase();
  
  // FAQ detection
  if (pathLower.includes('faq') || pathLower.includes('questions') || signals.faqPresent) {
    return 'FAQPage';
  }
  
  // Article/Blog detection
  if (pathLower.match(/\/(blog|article|post|news|guide|tutorial)/)) {
    return 'Article';
  }
  
  // How-to detection
  if (pathLower.match(/\/(how-to|howto|guide|tutorial|steps)/) || signals.hasHowTo) {
    return 'HowTo';
  }
  
  // Product detection
  if (pathLower.match(/\/(product|item|buy|shop|price)/) || signals.hasPrice) {
    return 'Product';
  }
  
  // Local business detection
  if ((signals.hasAddress && signals.hasPhone) || pathLower.match(/\/(location|contact|store|branch)/)) {
    return 'LocalBusiness';
  }
  
  // Organization/About detection
  if (pathLower.match(/\/(about|company|team|mission)/)) {
    return 'Organization';
  }
  
  // Default to WebPage
  return 'WebPage';
}

/**
 * Build JSON-LD schema stub with placeholders from page content
 */
export function buildJsonLd(intent: string, signals: PageSignals): any {
  const baseContext = 'https://schema.org';
  
  switch (intent) {
    case 'FAQPage':
      return {
        '@context': baseContext,
        '@type': 'FAQPage',
        'mainEntity': [
          {
            '@type': 'Question',
            'name': '[Question from page H2/H3]',
            'acceptedAnswer': {
              '@type': 'Answer',
              'text': '[Answer text from following paragraph]'
            }
          }
        ]
      };
      
    case 'Article':
      return {
        '@context': baseContext,
        '@type': 'Article',
        'headline': signals.title || signals.h1 || '[Article headline]',
        'author': {
          '@type': 'Organization',
          'name': '[Your organization name]'
        },
        'datePublished': '[YYYY-MM-DD]',
        'dateModified': '[YYYY-MM-DD]',
        'image': '[Featured image URL]',
        'publisher': {
          '@type': 'Organization',
          'name': '[Your organization name]',
          'logo': {
            '@type': 'ImageObject',
            'url': '[Logo URL]'
          }
        },
        'description': '[Article description/excerpt]'
      };
      
    case 'HowTo':
      return {
        '@context': baseContext,
        '@type': 'HowTo',
        'name': signals.title || signals.h1 || '[How-to title]',
        'description': '[Brief description of the process]',
        'step': [
          {
            '@type': 'HowToStep',
            'name': '[Step 1 name]',
            'text': '[Step 1 instructions]'
          },
          {
            '@type': 'HowToStep',
            'name': '[Step 2 name]',
            'text': '[Step 2 instructions]'
          }
        ]
      };
      
    case 'Product':
      return {
        '@context': baseContext,
        '@type': 'Product',
        'name': signals.title || signals.h1 || '[Product name]',
        'image': '[Product image URL]',
        'description': '[Product description]',
        'offers': {
          '@type': 'Offer',
          'price': '[Price]',
          'priceCurrency': 'USD',
          'availability': 'https://schema.org/InStock'
        }
      };
      
    case 'LocalBusiness':
      return {
        '@context': baseContext,
        '@type': 'LocalBusiness',
        'name': '[Business name]',
        'address': {
          '@type': 'PostalAddress',
          'streetAddress': '[Street address]',
          'addressLocality': '[City]',
          'addressRegion': '[State]',
          'postalCode': '[Zip]',
          'addressCountry': '[Country]'
        },
        'telephone': '[Phone number]',
        'openingHours': '[Opening hours]'
      };
      
    case 'Organization':
      return {
        '@context': baseContext,
        '@type': 'Organization',
        'name': '[Organization name]',
        'url': '[Website URL]',
        'logo': '[Logo URL]',
        'description': '[Organization description]',
        'sameAs': [
          '[Social media profile URLs]'
        ]
      };
      
    default:  // WebPage
      return {
        '@context': baseContext,
        '@type': 'WebPage',
        'name': signals.title || signals.h1 || '[Page name]',
        'description': '[Page description]',
        'url': signals.url
      };
  }
}

/**
 * Generate copy blocks for manual content improvements
 */
export function buildCopyBlocks(intent: string, signals: PageSignals): Array<{ label: string; content: string }> {
  const blocks: Array<{ label: string; content: string }> = [];
  
  // Word count suggestions
  if (signals.words < 300) {
    blocks.push({
      label: 'Content Expansion',
      content: `This page has only ${signals.words} words. For better search visibility and AI understanding, consider expanding to 500-1000 words with detailed information about: ${signals.title || 'this topic'}.`
    });
  }
  
  // FAQ-specific suggestions
  if (intent === 'FAQPage' && !signals.faqPresent) {
    blocks.push({
      label: 'FAQ Structure',
      content: 'Structure your content as Q&A pairs with clear question headings (H2/H3) followed by detailed answers. This helps AI systems extract and cite your responses.'
    });
  }
  
  // Article-specific suggestions
  if (intent === 'Article') {
    blocks.push({
      label: 'Article Metadata',
      content: 'Include clear author attribution, publication date, and last updated date. Add a compelling meta description (150-160 chars) that summarizes the article.'
    });
  }
  
  // How-to specific suggestions
  if (intent === 'HowTo' || signals.hasHowTo) {
    blocks.push({
      label: 'Step-by-Step Instructions',
      content: 'Break down the process into numbered steps with clear headings. Each step should have a descriptive title and detailed instructions.'
    });
  }
  
  return blocks;
}

/**
 * Determine priority based on page importance and missing schema
 */
function calculatePriority(signals: PageSignals, intent: string): 'high' | 'medium' | 'low' {
  // High priority: Key pages with no schema
  if (signals.jsonLdCount === 0) {
    const highValueIntents = ['FAQPage', 'Article', 'Product', 'LocalBusiness'];
    if (highValueIntents.includes(intent)) {
      return 'high';
    }
  }
  
  // Medium priority: Has some schema but missing key types
  if (signals.jsonLdCount > 0 && signals.jsonLdCount < 3) {
    return 'medium';
  }
  
  // Low priority: Already has good schema coverage
  return 'low';
}

/**
 * Generate rationale explaining why these recommendations apply
 */
function buildRationale(intent: string, signals: PageSignals): string {
  const reasons: string[] = [];
  
  // Path-based inference
  const pathLower = signals.pathSegments.join('/').toLowerCase();
  if (pathLower.includes('faq')) {
    reasons.push('URL path contains "faq"');
  }
  if (pathLower.match(/\/(blog|article|post)/)) {
    reasons.push('URL path indicates article content');
  }
  if (pathLower.match(/\/(how-to|guide|tutorial)/)) {
    reasons.push('URL path indicates instructional content');
  }
  
  // Content-based signals
  if (signals.faqPresent) {
    reasons.push('page contains FAQ markup');
  }
  if (signals.hasPrice) {
    reasons.push('price information detected');
  }
  if (signals.hasAddress && signals.hasPhone) {
    reasons.push('location and contact info present');
  }
  
  // Schema gap analysis
  if (signals.jsonLdCount === 0) {
    reasons.push(`no structured data found (${intent} schema recommended)`);
  } else {
    reasons.push(`found ${signals.jsonLdCount} existing schema(s), suggesting augmentation`);
  }
  
  return reasons.length > 0
    ? `Recommendation based on: ${reasons.join(', ')}.`
    : `Page appears to be a ${intent} based on content analysis.`;
}

/**
 * Main recommendations generator
 */
export function getRecommendations(signals: PageSignals): RecommendationOutput {
  const intent = inferPageIntent(signals);
  const priority = calculatePriority(signals, intent);
  const rationale = buildRationale(intent, signals);
  
  // Determine missing schemas
  const missingSchemas: string[] = [];
  if (!signals.jsonLdTypes.includes(intent)) {
    missingSchemas.push(intent);
  }
  
  // Always suggest WebPage if not present and not already the primary type
  if (intent !== 'WebPage' && !signals.jsonLdTypes.includes('WebPage')) {
    missingSchemas.push('WebPage');
  }
  
  // Build JSON-LD suggestions
  const suggestedJsonLd = missingSchemas.map(schemaType => ({
    type: schemaType,
    json: buildJsonLd(schemaType, signals),
    copyButton: `Copy ${schemaType} JSON-LD`
  }));
  
  // Build copy blocks
  const copyBlocks = buildCopyBlocks(intent, signals);
  
  return {
    inferredType: intent,
    missingSchemas,
    suggestedJsonLd,
    copyBlocks,
    priority,
    rationale
  };
}

