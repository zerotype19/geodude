/**
 * Universal Classification v1.0 - Language & Region Detection
 * Detects language and region from HTML, URL, and content signals
 */

// Currency symbols and their regions
const CURRENCY_REGIONS: Record<string, string> = {
  '$': 'US',
  '€': 'EU',
  '£': 'GB',
  '¥': 'JP',
  '₹': 'IN',
  'CAD': 'CA',
  'AUD': 'AU',
  'NZD': 'NZ',
  'CHF': 'CH',
  'CNY': 'CN',
  'KRW': 'KR'
};

// ccTLD to region mapping
const CCTLD_REGIONS: Record<string, string> = {
  '.uk': 'GB',
  '.fr': 'FR',
  '.de': 'DE',
  '.es': 'ES',
  '.it': 'IT',
  '.jp': 'JP',
  '.cn': 'CN',
  '.kr': 'KR',
  '.au': 'AU',
  '.ca': 'CA',
  '.mx': 'MX',
  '.br': 'BR',
  '.in': 'IN',
  '.ru': 'RU',
  '.nl': 'NL',
  '.se': 'SE',
  '.no': 'NO',
  '.dk': 'DK',
  '.fi': 'FI',
  '.pl': 'PL',
  '.ch': 'CH',
  '.at': 'AT',
  '.be': 'BE',
  '.ie': 'IE',
  '.nz': 'NZ',
  '.sg': 'SG',
  '.hk': 'HK',
  '.tw': 'TW',
  '.th': 'TH',
  '.id': 'ID',
  '.my': 'MY',
  '.ph': 'PH',
  '.vn': 'VN',
  '.za': 'ZA',
  '.ae': 'AE',
  '.sa': 'SA',
  '.eg': 'EG',
  '.ar': 'AR',
  '.cl': 'CL',
  '.co': 'CO',
  '.pe': 'PE',
  '.ve': 'VE'
};

/**
 * Extract language from <html lang="..."> or other HTML attributes
 */
function extractHtmlLang(html: string): string | null {
  // Match <html lang="en">, <html lang="en-US">, etc.
  const match = html.match(/<html[^>]+lang\s*=\s*["']([a-z]{2}(?:-[A-Z]{2})?)['"]/i);
  if (match) {
    const lang = match[1].toLowerCase().split('-')[0]; // Extract primary language code
    return lang;
  }
  return null;
}

/**
 * Extract region from <html lang="en-US"> style attributes
 */
function extractHtmlRegion(html: string): string | null {
  const match = html.match(/<html[^>]+lang\s*=\s*["'][a-z]{2}-([A-Z]{2})['"]/i);
  if (match) {
    return match[1].toUpperCase();
  }
  return null;
}

/**
 * Detect currency symbols or codes in content
 */
function detectCurrency(content: string): string | null {
  // Check for currency symbols
  for (const [symbol, region] of Object.entries(CURRENCY_REGIONS)) {
    if (content.includes(symbol)) {
      return region;
    }
  }
  return null;
}

/**
 * Extract ccTLD from hostname
 */
function extractCcTLD(hostname: string): string | null {
  for (const [tld, region] of Object.entries(CCTLD_REGIONS)) {
    if (hostname.endsWith(tld)) {
      return region;
    }
  }
  return null;
}

/**
 * Extract locale from URL path segments (e.g., /en-us/, /fr/, /es-mx/)
 */
function extractLocaleFromPath(url: string): { lang: string | null; region: string | null } {
  // Match patterns like /en-us/, /fr/, /es-mx/, /ja-jp/
  const match = url.match(/\/([a-z]{2})(?:-([a-z]{2}))?(?:\/|$)/i);
  if (match) {
    const lang = match[1].toLowerCase();
    const region = match[2]?.toUpperCase() || null;
    return { lang, region };
  }
  return { lang: null, region: null };
}

/**
 * Main detection function - combines all signals
 */
export function detectLangRegion(params: {
  html: string;
  url: string;
  hostname: string;
  title?: string;
  metaDescription?: string;
}): { lang: string | null; region: string | null; notes: string[] } {
  const { html, url, hostname, title = '', metaDescription = '' } = params;
  const notes: string[] = [];
  
  // 1. HTML lang attribute (highest priority)
  let lang = extractHtmlLang(html);
  let region = extractHtmlRegion(html);
  
  if (lang) {
    notes.push(`lang from <html>: ${lang}`);
  }
  if (region) {
    notes.push(`region from <html>: ${region}`);
  }
  
  // 2. URL path locale
  const pathLocale = extractLocaleFromPath(url);
  if (pathLocale.lang && !lang) {
    lang = pathLocale.lang;
    notes.push(`lang from path: ${lang}`);
  }
  if (pathLocale.region && !region) {
    region = pathLocale.region;
    notes.push(`region from path: ${region}`);
  }
  
  // 3. ccTLD
  const ccTldRegion = extractCcTLD(hostname);
  if (ccTldRegion && !region) {
    region = ccTldRegion;
    notes.push(`region from ccTLD: ${region}`);
  }
  
  // 4. Currency detection (as last resort for region)
  if (!region) {
    const content = `${title} ${metaDescription} ${html.substring(0, 2000)}`;
    const currencyRegion = detectCurrency(content);
    if (currencyRegion) {
      region = currencyRegion;
      notes.push(`region from currency: ${region}`);
    }
  }
  
  // 5. Default fallbacks
  if (!lang) {
    lang = 'en'; // Default to English
    notes.push('lang defaulted to en');
  }
  
  if (!region && lang === 'en') {
    region = 'US'; // Default English to US
    notes.push('region defaulted to US for English');
  }
  
  return { lang, region, notes };
}

/**
 * Check if detected locale is non-US/non-English
 */
export function isNonUSLocale(lang: string | null, region: string | null): boolean {
  if (lang && lang !== 'en') return true;
  if (region && region !== 'US') return true;
  return false;
}

/**
 * Attempt to construct US/English URL variant
 */
export function suggestUSEnglishURL(url: string, hostname: string): string | null {
  // Try to replace non-US locale path with /en-us/
  if (url.match(/\/([a-z]{2})(?:-([a-z]{2}))?(?:\/|$)/i)) {
    const usUrl = url.replace(/\/[a-z]{2}(?:-[a-z]{2})?(?:\/|$)/i, '/en-us/');
    if (usUrl !== url) {
      return usUrl;
    }
  }
  
  // Try root domain without locale
  if (url.match(/\/[a-z]{2}(?:-[a-z]{2})?(?:\/|$)/i)) {
    const rootUrl = url.replace(/\/[a-z]{2}(?:-[a-z]{2})?(?:\/|$)/i, '/');
    if (rootUrl !== url) {
      return rootUrl;
    }
  }
  
  return null;
}

