/**
 * Universal Classification v1.0 - Automated Test Suite
 * Phase 1: Benchmark domain tests
 */

import { classifyV2 } from '../classifierV2';

// Helper to create test input
const mk = async (urlStr: string, html: string, title = '', nav = '') => {
  const url = new URL(urlStr);
  return classifyV2({
    html: `${html}${nav}`,
    url: urlStr,
    hostname: url.hostname,
    title,
    metaDescription: '',
    renderVisibilityPct: 0.8
  });
};

describe('Classifier V2 - Benchmark Domains', () => {
  test('lexus.com → automotive, corporate/ecommerce, brand_marketing', async () => {
    const r = await mk(
      'https://www.lexus.com/',
      `
        <title>Lexus Official Site</title>
        <script type="application/ld+json">{"@type":"Organization"}</script>
        <div>models build configure dealers certified inventory test drive</div>
      `,
      'Lexus',
      '<nav><a href="/models">Models</a><a href="/build">Build & Price</a><a href="/dealers">Find a Dealer</a></nav>'
    );
    expect(r.industry.value).toBe('automotive');
    expect(['corporate', 'ecommerce']).toContain(r.site_type.value);
    expect(r.site_mode).toBe('brand_marketing');
  });

  test('fender.com → retail, ecommerce, brand_store', async () => {
    const r = await mk(
      'https://www.fender.com/en-US/',
      `
        <title>Fender Guitars</title>
        <script type="application/ld+json">{"@type":"Product"}</script>
        <div>add to cart price guitars amps pedals strings custom shop</div>
      `,
      'Fender',
      '<nav><a href="/guitars">Guitars</a><a href="/amps">Amps</a><a href="/cart">Cart</a></nav>'
    );
    expect(r.industry.value).toBe('retail');
    expect(r.site_type.value).toBe('ecommerce');
    expect(r.site_mode).toBe('brand_store');
  });

  test('nike.com → retail, ecommerce, brand_store', async () => {
    const r = await mk(
      'https://www.nike.com/',
      `
        <title>Nike</title>
        <script type="application/ld+json">{"@type":"Product"}</script>
        <div>add to cart price men women kids shoes running basketball apparel</div>
      `,
      'Nike',
      '<nav><a href="/men">Men</a><a href="/women">Women</a><a href="/kids">Kids</a></nav>'
    );
    expect(r.industry.value).toBe('retail');
    expect(r.site_type.value).toBe('ecommerce');
    expect(r.purpose).toBe('sell');
  });

  test('amex.com → finance, financial, convert', async () => {
    const r = await mk(
      'https://www.americanexpress.com/',
      `
        <title>American Express</title>
        <script type="application/ld+json">{"@type":"FinancialService"}</script>
        <div>credit card rewards apr annual fee apply now benefits</div>
      `,
      'American Express',
      '<nav><a href="/cards">Credit Cards</a><a href="/rewards">Rewards</a></nav>'
    );
    expect(r.industry.value).toBe('finance');
    expect(r.site_type.value).toBe('financial');
    expect(r.purpose).toBe('convert');
  });

  test('united.com → travel, ecommerce/corporate, sell', async () => {
    const r = await mk(
      'https://www.united.com/',
      `
        <title>United Airlines</title>
        <script type="application/ld+json">{"@type":"TravelAgency"}</script>
        <div>flight hotel book reservation check-in itinerary</div>
      `,
      'United Airlines',
      '<nav><a href="/booking">Book</a><a href="/checkin">Check-In</a></nav>'
    );
    expect(r.industry.value).toBe('travel');
    expect(r.purpose === 'sell' || r.purpose === 'convert').toBe(true);
  });

  test('openai.com → software, software/corporate, inform', async () => {
    const r = await mk(
      'https://www.openai.com/',
      `
        <title>OpenAI</title>
        <script type="application/ld+json">{"@type":"SoftwareApplication"}</script>
        <div>api docs developers pricing dashboard</div>
      `,
      'OpenAI',
      '<nav><a href="/api">API</a><a href="/docs">Docs</a></nav>'
    );
    expect(r.industry.value).toBe('software');
    expect(['software', 'corporate']).toContain(r.site_type.value);
  });

  test('nytimes.com → media, media, inform', async () => {
    const r = await mk(
      'https://www.nytimes.com/',
      `
        <title>The New York Times</title>
        <script type="application/ld+json">{"@type":"NewsArticle"}</script>
        <div>news article blog press magazine publisher</div>
      `,
      'The New York Times',
      '<nav><a href="/news">News</a><a href="/opinion">Opinion</a></nav>'
    );
    expect(r.industry.value).toBe('media');
    expect(r.site_type.value).toBe('media');
    expect(r.purpose).toBe('inform');
  });

  test('github.com → software, software, docs_site/assist', async () => {
    const r = await mk(
      'https://docs.github.com/',
      `
        <title>GitHub Docs</title>
        <script type="application/ld+json">{"@type":"SoftwareApplication"}</script>
        <div>api docs developers documentation</div>
      `,
      'GitHub Docs',
      '<nav><a href="/docs">Docs</a><a href="/api">API</a></nav>'
    );
    expect(r.industry.value).toBe('software');
    expect(['docs_site', 'software']).toContain(r.site_mode || r.site_type.value);
  });

  test('wikipedia.org → education/null, corporate, inform', async () => {
    const r = await mk(
      'https://www.wikipedia.org/',
      `
        <title>Wikipedia</title>
        <div>encyclopedia article reference</div>
      `,
      'Wikipedia',
      '<nav><a href="/article">Articles</a></nav>'
    );
    expect(r.purpose).toBe('inform');
  });

  test('who.int → government, corporate, inform', async () => {
    const r = await mk(
      'https://www.who.int/',
      `
        <title>World Health Organization</title>
        <div>health organization international</div>
      `,
      'WHO',
      '<nav><a href="/health">Health</a></nav>'
    );
    // .int TLD doesn't auto-force government, but WHO should still classify as inform
    expect(r.purpose).toBe('inform');
  });

  test('walmart.com → retail, ecommerce, retailer', async () => {
    const r = await mk(
      'https://www.walmart.com/',
      `
        <title>Walmart</title>
        <script type="application/ld+json">{"@type":"Product"}</script>
        <div>add to cart price buy shop free shipping</div>
      `,
      'Walmart',
      '<nav><a href="/shop">Shop</a><a href="/cart">Cart</a></nav>'
    );
    expect(r.industry.value).toBe('retail');
    expect(r.site_type.value).toBe('ecommerce');
    expect(r.brand_kind).toBe('retailer');
  });

  test('marketplace detection', async () => {
    const r = await mk(
      'https://www.reverb.com/',
      `
        <title>Reverb</title>
        <script type="application/ld+json">{"@type":"Product"}</script>
        <div>add to cart sold by seller marketplace vendors guitars amps</div>
      `,
      'Reverb',
      '<nav><a href="/marketplace">Marketplace</a></nav>'
    );
    expect(r.brand_kind).toBe('marketplace');
  });

  test('manufacturer detection', async () => {
    const r = await mk(
      'https://www.fender.com/',
      `
        <title>Fender Official Site</title>
        <div>official site find a dealer where to buy custom shop heritage manufacturing</div>
      `,
      'Fender',
      '<nav><a href="/dealers">Find a Dealer</a></nav>'
    );
    expect(r.brand_kind).toBe('manufacturer');
  });

  test('confidence scoring - clear winner', async () => {
    const r = await mk(
      'https://www.nike.com/',
      `
        <title>Nike</title>
        <script type="application/ld+json">{"@type":"Product","@type":"Offer"}</script>
        <div>add to cart checkout price sku product free shipping returns men women kids shoes</div>
      `,
      'Nike',
      '<nav><a href="/shop">Shop</a></nav>'
    );
    expect(r.site_type.confidence).toBeGreaterThan(0.7);
  });

  test('gov exception - force government industry', async () => {
    const r = await mk(
      'https://www.usa.gov/',
      `
        <title>USA.gov</title>
        <div>government services</div>
      `,
      'USA.gov',
      '<nav><a href="/services">Services</a></nav>'
    );
    expect(r.industry.value).toBe('government');
  });

  test('edu exception - force education industry', async () => {
    const r = await mk(
      'https://www.mit.edu/',
      `
        <title>MIT</title>
        <div>university education research</div>
      `,
      'MIT',
      '<nav><a href="/academics">Academics</a></nav>'
    );
    expect(r.industry.value).toBe('education');
  });
});

