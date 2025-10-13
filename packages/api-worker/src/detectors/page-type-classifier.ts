/**
 * Page Type Classifier - Phase Next
 * Heuristic classifier for page types based on URL patterns and DOM signals
 */

export type PageType = 'article' | 'product' | 'faq' | 'howto' | 'about' | 'qapage' | 'other';

export interface PageTypeResult {
  type: PageType;
  confidence: number; // 0-100%
  signals: {
    urlPattern: boolean;
    domSignals: boolean;
    contentSignals: boolean;
  };
}

export function classifyPageType(
  url: string,
  html: string,
  title?: string,
  h1?: string
): PageTypeResult {
  const signals = {
    urlPattern: false,
    domSignals: false,
    contentSignals: false
  };
  
  let confidence = 0;
  let type: PageType = 'other';
  
  // URL pattern analysis
  const urlType = analyzeUrlPattern(url);
  if (urlType !== 'other') {
    signals.urlPattern = true;
    confidence += 30;
    type = urlType;
  }
  
  // DOM signal analysis
  const domType = analyzeDomSignals(html);
  if (domType !== 'other') {
    signals.domSignals = true;
    confidence += 40;
    if (type === 'other' || confidence > 50) {
      type = domType;
    }
  }
  
  // Content signal analysis
  const contentType = analyzeContentSignals(html, title, h1);
  if (contentType !== 'other') {
    signals.contentSignals = true;
    confidence += 30;
    if (type === 'other' || confidence > 60) {
      type = contentType;
    }
  }
  
  return {
    type,
    confidence: Math.min(100, confidence),
    signals
  };
}

function analyzeUrlPattern(url: string): PageType {
  const path = new URL(url).pathname.toLowerCase();
  
  // FAQ patterns
  if (path.includes('/faq') || path.includes('/frequently-asked')) {
    return 'faq';
  }
  
  // Product patterns
  if (path.includes('/product') || path.includes('/shop') || path.includes('/buy')) {
    return 'product';
  }
  
  // How-to patterns
  if (path.includes('/how-to') || path.includes('/tutorial') || path.includes('/guide')) {
    return 'howto';
  }
  
  // About patterns
  if (path.includes('/about') || path.includes('/company') || path.includes('/team')) {
    return 'about';
  }
  
  // Article patterns
  if (path.includes('/article') || path.includes('/blog') || path.includes('/news')) {
    return 'article';
  }
  
  return 'other';
}

function analyzeDomSignals(html: string): PageType {
  const lowerHtml = html.toLowerCase();
  
  // FAQ signals
  if (lowerHtml.includes('faq') || 
      lowerHtml.includes('frequently asked') ||
      html.includes('itemprop="question"') ||
      html.includes('itemprop="answer"')) {
    return 'faq';
  }
  
  // Product signals
  if (lowerHtml.includes('price') || 
      lowerHtml.includes('add to cart') ||
      lowerHtml.includes('buy now') ||
      html.includes('itemprop="offers"') ||
      html.includes('itemprop="price"')) {
    return 'product';
  }
  
  // How-to signals
  if (lowerHtml.includes('step') || 
      lowerHtml.includes('tutorial') ||
      lowerHtml.includes('how to') ||
      html.includes('itemprop="step"') ||
      html.includes('itemprop="instruction"')) {
    return 'howto';
  }
  
  // Article signals
  if (html.includes('<article>') || 
      html.includes('itemprop="articleBody"') ||
      html.includes('itemprop="headline"') ||
      lowerHtml.includes('published') ||
      lowerHtml.includes('author')) {
    return 'article';
  }
  
  // About signals
  if (lowerHtml.includes('about us') || 
      lowerHtml.includes('our company') ||
      lowerHtml.includes('our team') ||
      lowerHtml.includes('contact us')) {
    return 'about';
  }
  
  return 'other';
}

function analyzeContentSignals(html: string, title?: string, h1?: string): PageType {
  const content = (title || '') + ' ' + (h1 || '') + ' ' + html;
  const lowerContent = content.toLowerCase();
  
  // FAQ content signals
  if (lowerContent.includes('what is') || 
      lowerContent.includes('how do i') ||
      lowerContent.includes('can i') ||
      lowerContent.includes('why does')) {
    return 'faq';
  }
  
  // Product content signals
  if (lowerContent.includes('$') || 
      lowerContent.includes('price') ||
      lowerContent.includes('buy') ||
      lowerContent.includes('purchase')) {
    return 'product';
  }
  
  // How-to content signals
  if (lowerContent.includes('step 1') || 
      lowerContent.includes('first') ||
      lowerContent.includes('then') ||
      lowerContent.includes('finally')) {
    return 'howto';
  }
  
  // Article content signals
  if (lowerContent.includes('according to') || 
      lowerContent.includes('research shows') ||
      lowerContent.includes('studies indicate') ||
      lowerContent.includes('experts say')) {
    return 'article';
  }
  
  return 'other';
}
