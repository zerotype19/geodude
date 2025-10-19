/**
 * Edge Cases & Falsification Tests for Classifier V2
 * Tests designed to break the classifier and find weaknesses
 */

import { classifyV2 } from '../classifierV2';

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

describe('Classifier V2 - Edge Cases & Falsification', () => {
  describe('Mixed/Complex Sites', () => {
    test('amazon.com → retail (not media despite having /news)', async () => {
      const r = await mk(
        'https://www.amazon.com/',
        `
          <title>Amazon</title>
          <script type="application/ld+json">{"@type":"Product"}</script>
          <div>add to cart price buy shop free shipping returns prime</div>
        `,
        'Amazon',
        '<nav><a href="/news">News</a><a href="/shop">Shop</a><a href="/cart">Cart</a></nav>'
      );
      expect(r.site_type.value).toBe('ecommerce');
      expect(r.industry.value).toBe('retail');
    });

    test('meta.com → corporate (marketing + docs)', async () => {
      const r = await mk(
        'https://www.meta.com/',
        `
          <title>Meta</title>
          <div>company mission innovation technology</div>
        `,
        'Meta',
        '<nav><a href="/about">About</a><a href="/docs">Docs</a></nav>'
      );
      expect(['corporate', 'software']).toContain(r.site_type.value);
    });
  });

  describe('Non-Latin & International', () => {
    test('rakuten.co.jp → marketplace, Japanese', async () => {
      const r = await mk(
        'https://www.rakuten.co.jp/ja/',
        `
          <html lang="ja">
          <title>楽天</title>
          <div>sold by seller marketplace vendor cart checkout</div>
        `,
        '楽天',
        '<nav><a href="/shop">ショップ</a></nav>'
      );
      expect(r.brand_kind).toBe('marketplace');
      expect(r.lang).toBe('ja');
      expect(r.region).toBe('JP');
    });

    test('nike.com/fr/ → French locale detected', async () => {
      const r = await mk(
        'https://www.nike.com/fr/',
        `
          <html lang="fr">
          <title>Nike France</title>
          <div>ajouter au panier prix acheter</div>
        `,
        'Nike France',
        '<nav><a href="/hommes">Hommes</a></nav>'
      );
      expect(r.lang).toBe('fr');
    });
  });

  describe('Branded Marketing Sites', () => {
    test('apple.com → corporate/ecommerce brand_marketing', async () => {
      const r = await mk(
        'https://www.apple.com/',
        `
          <title>Apple</title>
          <script type="application/ld+json">{"@type":"Organization"}</script>
          <div>innovation design products</div>
        `,
        'Apple',
        '<nav><a href="/products">Products</a><a href="/store">Store</a></nav>'
      );
      expect(['corporate', 'ecommerce']).toContain(r.site_type.value);
    });

    test('tesla.com → automotive brand_marketing', async () => {
      const r = await mk(
        'https://www.tesla.com/',
        `
          <title>Tesla</title>
          <script type="application/ld+json">{"@type":"AutoDealer"}</script>
          <div>models build configure dealers test drive</div>
        `,
        'Tesla',
        '<nav><a href="/models">Models</a><a href="/build">Build</a></nav>'
      );
      expect(r.industry.value).toBe('automotive');
    });
  });

  describe('Tricky Finance', () => {
    test('stripe.com → software/finance (both valid)', async () => {
      const r = await mk(
        'https://www.stripe.com/',
        `
          <title>Stripe</title>
          <script type="application/ld+json">{"@type":"SoftwareApplication"}</script>
          <div>api docs payments checkout developers</div>
        `,
        'Stripe',
        '<nav><a href="/docs">Docs</a><a href="/api">API</a></nav>'
      );
      expect(['software', 'financial']).toContain(r.site_type.value);
    });

    test('paypal.com → finance (not retail despite cart verbs)', async () => {
      const r = await mk(
        'https://www.paypal.com/',
        `
          <title>PayPal</title>
          <script type="application/ld+json">{"@type":"FinancialService"}</script>
          <div>payments send money transfer checkout</div>
        `,
        'PayPal',
        '<nav><a href="/send">Send</a><a href="/receive">Receive</a></nav>'
      );
      expect(r.site_type.value).toBe('financial');
      expect(r.industry.value).toBe('finance');
    });
  });

  describe('News That Sells', () => {
    test('nytimes.com/store → still media site_type', async () => {
      const r = await mk(
        'https://www.nytimes.com/store/',
        `
          <title>NYT Store</title>
          <script type="application/ld+json">{"@type":"NewsArticle"}</script>
          <div>news article blog press add to cart shop</div>
        `,
        'New York Times Store',
        '<nav><a href="/news">News</a><a href="/store">Store</a></nav>'
      );
      expect(r.site_type.value).toBe('media');
    });
  });

  describe('Forums/Communities', () => {
    test('reddit.com → not media (should be social/corporate)', async () => {
      const r = await mk(
        'https://www.reddit.com/',
        `
          <title>Reddit</title>
          <div>posts comments community discussion forum</div>
        `,
        'Reddit',
        '<nav><a href="/popular">Popular</a></nav>'
      );
      expect(r.site_type.value).not.toBe('media');
    });

    test('stackoverflow.com → software/corporate (not media)', async () => {
      const r = await mk(
        'https://stackoverflow.com/',
        `
          <title>Stack Overflow</title>
          <div>questions answers developers programming</div>
        `,
        'Stack Overflow',
        '<nav><a href="/questions">Questions</a></nav>'
      );
      expect(['software', 'corporate']).toContain(r.site_type.value);
    });
  });

  describe('Reference Sites', () => {
    test('wikipedia.org → education/reference, inform', async () => {
      const r = await mk(
        'https://www.wikipedia.org/',
        `
          <title>Wikipedia</title>
          <div>encyclopedia article reference knowledge</div>
        `,
        'Wikipedia',
        '<nav><a href="/article">Articles</a></nav>'
      );
      expect(r.purpose).toBe('inform');
    });
  });

  describe('Gov/Edu Overrides', () => {
    test('whitehouse.gov → force government', async () => {
      const r = await mk(
        'https://www.whitehouse.gov/',
        `
          <title>The White House</title>
          <div>president administration government</div>
        `,
        'The White House',
        '<nav><a href="/news">News</a></nav>'
      );
      expect(r.industry.value).toBe('government');
    });

    test('ox.ac.uk → force education', async () => {
      const r = await mk(
        'https://www.ox.ac.uk/',
        `
          <title>University of Oxford</title>
          <div>university research students</div>
        `,
        'Oxford',
        '<nav><a href="/study">Study</a></nav>'
      );
      expect(r.industry.value).toBe('education');
    });

    test('harvard.edu → force education', async () => {
      const r = await mk(
        'https://www.harvard.edu/',
        `
          <title>Harvard University</title>
          <div>university education research</div>
        `,
        'Harvard',
        '<nav><a href="/academics">Academics</a></nav>'
      );
      expect(r.industry.value).toBe('education');
    });
  });

  describe('SPA Risk Detection', () => {
    test('Low render visibility → note added', async () => {
      const r = await mk(
        'https://app.example.com/',
        `
          <div id="root"></div>
        `,
        'Example App',
        ''
      );
      r.render_visibility_pct = 0.25;
      
      // Re-classify with low render visibility
      const updated = await classifyV2({
        html: '<div id="root"></div>',
        url: 'https://app.example.com/',
        hostname: 'app.example.com',
        renderVisibilityPct: 0.25
      });
      
      expect(updated.notes).toContain('Low render visibility (<30%); SPA-heavy site');
    });
  });

  describe('Schema Boost Detection', () => {
    test('BankOrCreditUnion schema → finance boost', async () => {
      const r = await mk(
        'https://bank.example.com/',
        `
          <title>Example Bank</title>
          <script type="application/ld+json">{"@type":"BankOrCreditUnion"}</script>
          <div>checking savings mortgage rates</div>
        `,
        'Example Bank',
        '<nav><a href="/banking">Banking</a></nav>'
      );
      expect(r.industry.value).toBe('finance');
      expect(r.industry.confidence).toBeGreaterThan(0.7);
    });

    test('AutoDealer schema → automotive boost', async () => {
      const r = await mk(
        'https://dealer.example.com/',
        `
          <title>Example Auto Dealer</title>
          <script type="application/ld+json">{"@type":"AutoDealer"}</script>
          <div>models inventory test drive certified</div>
        `,
        'Example Dealer',
        '<nav><a href="/inventory">Inventory</a></nav>'
      );
      expect(r.industry.value).toBe('automotive');
    });
  });

  describe('Mode Detection', () => {
    test('docs.* subdomain → docs_site', async () => {
      const r = await mk(
        'https://docs.example.com/',
        `
          <title>Docs</title>
          <div>api documentation developers</div>
        `,
        'Docs',
        '<nav><a href="/api">API</a></nav>'
      );
      expect(r.site_mode).toBe('docs_site');
    });

    test('/support path → support_site', async () => {
      const r = await mk(
        'https://www.example.com/support/',
        `
          <title>Support</title>
          <div>help faq contact knowledge base</div>
        `,
        'Support',
        '<nav><a href="/faq">FAQ</a></nav>'
      );
      expect(r.site_mode).toBe('support_site');
    });

    test('investors.* subdomain → ir_site', async () => {
      const r = await mk(
        'https://investors.example.com/',
        `
          <title>Investor Relations</title>
          <div>earnings filings sec reports</div>
        `,
        'IR',
        '<nav><a href="/filings">Filings</a></nav>'
      );
      expect(r.site_mode).toBe('ir_site');
    });
  });
});

