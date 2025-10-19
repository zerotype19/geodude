/**
 * Universal Classification v1.0 - URL Mode & Brand Kind Detection
 * Infers site_mode and brand_kind from URL patterns and content signals
 */

import type { SiteMode, BrandKind, Purpose } from '../types/classification';

/**
 * Detect site_mode from URL subdomain and path patterns
 */
export function detectSiteMode(params: {
  url: string;
  hostname: string;
  pathname: string;
  navTerms: string[];
  hasCart?: boolean;
  hasCheckout?: boolean;
}): SiteMode | null {
  const { hostname, pathname, navTerms, hasCart = false, hasCheckout = false } = params;
  const lowerPath = pathname.toLowerCase();
  const lowerHostname = hostname.toLowerCase();
  const navText = navTerms.join(' ').toLowerCase();
  
  // Docs site (docs.*, /docs/, /api/, developer portal)
  if (
    lowerHostname.startsWith('docs.') || 
    lowerHostname.startsWith('developers.') ||
    lowerHostname.startsWith('api.') ||
    lowerPath.includes('/docs/') ||
    lowerPath.includes('/api/') ||
    /\b(documentation|api reference|sdk)\b/.test(navText)
  ) {
    return 'docs_site';
  }
  
  // Support site (support.*, help.*, /support/, /faq/)
  if (
    lowerHostname.startsWith('support.') || 
    lowerHostname.startsWith('help.') ||
    lowerPath.includes('/support/') ||
    lowerPath.includes('/help/') ||
    lowerPath.includes('/faq/') ||
    /\b(knowledge base|contact support|help center)\b/.test(navText)
  ) {
    return 'support_site';
  }
  
  // Careers site (careers.*, jobs.*, /careers/)
  if (
    lowerHostname.startsWith('careers.') || 
    lowerHostname.startsWith('jobs.') ||
    lowerPath.includes('/careers/') ||
    lowerPath.includes('/jobs/') ||
    /\b(join our team|open positions|job openings)\b/.test(navText)
  ) {
    return 'careers_site';
  }
  
  // Investor relations (ir.*, investor.*, /investors/, /ir/)
  if (
    lowerHostname.startsWith('ir.') || 
    lowerHostname.startsWith('investor.') ||
    lowerPath.includes('/investors/') ||
    lowerPath.includes('/ir/') ||
    /\b(financial reports|earnings|sec filings)\b/.test(navText)
  ) {
    return 'ir_site';
  }
  
  // E-commerce: has cart/checkout functionality
  if (hasCart || hasCheckout) {
    // Check if marketplace (multi-seller) vs single brand store
    if (/\b(sold by|seller|marketplace|vendors?)\b/.test(navText)) {
      return 'retail_marketplace';
    }
    return 'brand_store';
  }
  
  // Default: brand marketing site
  return 'brand_marketing';
}

/**
 * Detect brand_kind from content signals
 */
export function detectBrandKind(params: {
  html: string;
  navTerms: string[];
  siteMode: SiteMode | null;
}): BrandKind {
  const { html, navTerms, siteMode } = params;
  const lowerHtml = html.toLowerCase();
  const navText = navTerms.join(' ').toLowerCase();
  
  // Marketplace indicators
  if (
    siteMode === 'retail_marketplace' ||
    /\b(sold by|seller|multiple sellers|marketplace|vendors?|third[- ]party)\b/.test(lowerHtml) ||
    /\b(seller rating|seller feedback|verified seller)\b/.test(navText)
  ) {
    return 'marketplace';
  }
  
  // Manufacturer indicators
  if (
    /\b(official site|official store|authorized dealer|find a (dealer|retailer)|where to buy)\b/.test(lowerHtml) ||
    /\b(custom shop|factory|made in|manufacturing|craftsmanship|heritage)\b/.test(lowerHtml) ||
    /\b(dealer locator|authorized retailers?|find a store)\b/.test(navText)
  ) {
    return 'manufacturer';
  }
  
  // Retailer indicators (single seller, not manufacturer)
  if (
    siteMode === 'brand_store' ||
    /\b(free shipping|in stock|add to cart|buy now|shop (now|online))\b/.test(lowerHtml)
  ) {
    return 'retailer';
  }
  
  return null;
}

/**
 * Infer purpose from site_mode and industry
 */
export function inferPurpose(siteMode: SiteMode | null, industry: string | null): Purpose {
  if (siteMode === "brand_store" || siteMode === "retail_marketplace") return "sell";
  if (siteMode === "support_site" || siteMode === "docs_site") return "assist";
  if (siteMode === "ir_site") return "investor";
  if (industry === "finance" || industry === "insurance") return "convert";
  return "inform";
}

/**
 * Check if URL has cart/checkout indicators
 */
export function hasCommerceIndicators(html: string): { hasCart: boolean; hasCheckout: boolean } {
  const lower = html.toLowerCase();
  return {
    hasCart: /\b(cart|shopping bag|basket)\b/.test(lower),
    hasCheckout: /\b(checkout|payment|billing|shipping address)\b/.test(lower)
  };
}

