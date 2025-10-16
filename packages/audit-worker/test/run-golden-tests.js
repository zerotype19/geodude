// Simple golden test runner for scoring system
// Run with: node test/run-golden-tests.js

const fs = require('fs');
const path = require('path');

// Simple HTML parser (copied from worker)
function parseHTML(html) {
  return {
    querySelector: (selector) => {
      if (selector === 'title') {
        const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
        return match ? { textContent: match[1] } : null;
      }
      if (selector === 'h1') {
        const match = html.match(/<h1[^>]*>([^<]*)<\/h1>/i);
        return match ? { textContent: match[1] } : null;
      }
      if (selector === 'link[rel="canonical"]') {
        const match = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);
        return match ? { getAttribute: () => match[1] } : null;
      }
      if (selector === 'main') {
        const match = html.match(/<main[^>]*>(.*?)<\/main>/is);
        return match ? { textContent: match[1].replace(/<[^>]*>/g, '').trim() } : null;
      }
      if (selector === 'body') {
        const match = html.match(/<body[^>]*>(.*?)<\/body>/is);
        return match ? { textContent: match[1].replace(/<[^>]*>/g, '').trim() } : null;
      }
      return null;
    },
    querySelectorAll: (selector) => {
      if (selector === 'script[type="application/ld+json"]') {
        const matches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis);
        return matches ? matches.map(match => ({
          textContent: match.replace(/<script[^>]*>(.*?)<\/script>/is, '$1')
        })) : [];
      }
      if (selector === 'a[href^="#"]') {
        const matches = html.match(/<a[^>]*href=["']#/gi);
        return matches ? matches.map(() => ({})) : [];
      }
      if (selector === 'a[href^="http"]') {
        const matches = html.match(/<a[^>]*href=["']http[^"']*["'][^>]*>/gi);
        return matches ? matches.map(match => {
          const hrefMatch = match.match(/href=["']([^"']*)["']/i);
          return { href: hrefMatch?.[1] };
        }) : [];
      }
      if (selector === 'table') {
        const matches = html.match(/<table[^>]*>/gi);
        return matches ? matches.map(() => ({})) : [];
      }
      if (selector === 'h1, h2, h3, h4, h5, h6') {
        const matches = html.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gis);
        return matches ? matches.map(match => ({
          textContent: match.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/is, '$1')
        })) : [];
      }
      if (selector === 'a[href]') {
        const matches = html.match(/<a[^>]*href=["']([^"']*)["'][^>]*>/gi);
        return matches ? matches.map(match => {
          const hrefMatch = match.match(/href=["']([^"']*)["']/i);
          return { getAttribute: (attr) => attr === 'href' ? hrefMatch?.[1] : null };
        }) : [];
      }
      return [];
    }
  };
}

function hasHeading(doc, patterns) {
  const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
  for (const heading of headings) {
    const text = heading.textContent?.toLowerCase() || '';
    if (patterns.some(pattern => text.includes(pattern))) {
      return true;
    }
  }
  return false;
}

function pullEntities(jsonld) {
  let org = null;
  let author = null;
  
  for (const item of jsonld) {
    if (item['@type'] === 'Organization' && !org) {
      org = item;
    }
    if (item['@type'] === 'Person' && !author) {
      author = item;
    }
    if (Array.isArray(item)) {
      for (const subItem of item) {
        if (subItem['@type'] === 'Organization' && !org) {
          org = subItem;
        }
        if (subItem['@type'] === 'Person' && !author) {
          author = subItem;
        }
      }
    }
  }
  
  return { org, author };
}

function hasProvenance(jsonld) {
  for (const item of jsonld) {
    if (item['@type'] === 'Article' || item['@type'] === 'CreativeWork') {
      const hasAuthor = item['author'] || item['creator'];
      const hasPublisher = item['publisher'];
      const hasDate = item['datePublished'] || item['dateModified'];
      const hasCitation = item['citation'] || item['isBasedOn'];
      const hasLicense = item['license'];
      
      if (hasAuthor && hasPublisher && hasDate && (hasCitation || hasLicense)) {
        return true;
      }
    }
  }
  return false;
}

function extractAll(html, ctx) {
  ctx = { ...ctx, html }; // Add html to context
  const doc = parseHTML(html);
  
  const title = doc.querySelector('title')?.textContent?.trim() || '';
  const h1 = doc.querySelector('h1')?.textContent?.trim() || '';
  const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || ctx.url;

  // JSON-LD extraction
  const jsonldRaw = [...doc.querySelectorAll('script[type="application/ld+json"]')]
    .map(s => {
      try {
        return JSON.parse(s.textContent || '');
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  
  const schemaTypes = jsonldRaw.flatMap(n => Array.isArray(n) ? n : [n])
    .map(n => n['@type']).filter(Boolean);

  // Answer box detection - look for answer-first design patterns
  const htmlContent = ctx.html || '';
  
  // Look for answer-first design: immediate answer in structured format
  const hasAnswerBoxClass = htmlContent.includes('answer-box');
  const hasImmediateAnswer = htmlContent.includes('<strong>') && htmlContent.includes('</strong>');
  const hasStructuredContent = htmlContent.includes('<ul>') || htmlContent.includes('<table>');
  const hasJumpLinks = doc.querySelectorAll('a[href^="#"]').length >= 2;
  
  const answerBox = hasAnswerBoxClass || (hasImmediateAnswer && hasStructuredContent);

  // Jump links
  const jumpLinks = doc.querySelectorAll('a[href^="#"]').length >= 2;

  // Facts block detection
  const factsBlock = hasHeading(doc, ["key facts","at-a-glance","highlights","summary"]);

  // References block
  const refsBlock = hasHeading(doc, ["references","sources","citations","footnotes"]);

  // Tables count
  const tablesCount = doc.querySelectorAll('table').length;

  // Outbound links
  const outboundLinks = [...doc.querySelectorAll('a[href^="http"]')]
    .filter(a => {
      try {
        const linkUrl = new URL(a.href);
        const pageUrl = new URL(ctx.url);
        return linkUrl.hostname !== pageUrl.hostname;
      } catch {
        return false;
      }
    }).length;

  // Extract entities
  const { org, author } = pullEntities(jsonldRaw);

  // Additional heuristics
  const chunkable = doc.querySelectorAll('h2, h3, h4').length >= 3;
  const hasStableAnchors = doc.querySelectorAll('a[href*="#"]').length >= 1;
  const hasDatasetLinks = [...doc.querySelectorAll('a[href]')]
    .some(a => /\.(csv|json|xlsx)$/i.test(a.href));
  const hasLicense = jsonldRaw.some(item => item['license'] || item['@type'] === 'CreativeWork');
  const hasChangelog = hasHeading(doc, ["changelog", "updates", "what changed"]);
  const dateModified = jsonldRaw.some(item => item['dateModified']);
  const linksToSourcesHub = [...doc.querySelectorAll('a[href*="/sources"], a[href*="/references"]')].length > 0;
  const clsRisk = false;
  const sitemapsOk = true;
  const internalCluster = [...doc.querySelectorAll('a[href]')]
    .filter(a => {
      try {
        return a.href.includes(new URL(ctx.url).hostname);
      } catch {
        return false;
      }
    }).length >= 3;

  const parityPass = true;

  return {
    title, h1, canonical, schemaTypes, jsonldRaw, answerBox, jumpLinks, factsBlock, refsBlock,
    tablesCount, outboundLinks, org, author, robots: ctx.robots, parityPass,
    chunkable, hasStableAnchors, hasDatasetLinks, hasLicense, hasChangelog, dateModified,
    linksToSourcesHub, clsRisk, sitemapsOk, internalCluster
  };
}

function scorePage(analysis, weights) {
  const items = [];
  
  const score0_3 = (cond, strong) => cond ? (strong ? 3 : 2) : 0;

  // AEO Scoring
  const A1 = score0_3(analysis.answerBox && (analysis.jumpLinks || analysis.tablesCount > 0), true);
  const A2 = score0_3(analysis.internalCluster);
  const A3 = score0_3(analysis.org && analysis.author, true);
  const A4 = score0_3(analysis.tablesCount > 0 || analysis.outboundLinks > 3);
  const A5 = score0_3(analysis.schemaTypes.length > 0);
  const A6 = score0_3(!!analysis.canonical);
  const A7 = score0_3(!analysis.clsRisk);
  const A8 = score0_3(analysis.sitemapsOk);
  const A9 = score0_3(analysis.dateModified);
  const A10 = score0_3(analysis.refsBlock && analysis.chunkable, true);

  const aeo = (
    A1 * weights.aeo.A1 + A2 * weights.aeo.A2 + A3 * weights.aeo.A3 + A4 * weights.aeo.A4 +
    A5 * weights.aeo.A5 + A6 * weights.aeo.A6 + A7 * weights.aeo.A7 + A8 * weights.aeo.A8 +
    A9 * weights.aeo.A9 + A10 * weights.aeo.A10
  ) / 3;

  // GEO Scoring
  const G1 = score0_3(analysis.factsBlock, true);
  const G2 = score0_3(hasProvenance(analysis.jsonldRaw), true);
  const G3 = score0_3(analysis.refsBlock && analysis.outboundLinks >= 3, true);
  const G4 = score0_3(!!analysis.robots && analysis.parityPass, true);
  const G5 = score0_3(analysis.chunkable);
  const G6 = score0_3(analysis.hasStableAnchors);
  const G7 = score0_3(analysis.hasDatasetLinks);
  const G8 = score0_3(analysis.hasLicense);
  const G9 = score0_3(analysis.hasChangelog || analysis.dateModified);
  const G10 = score0_3(analysis.linksToSourcesHub);


  const geo = (
    G1 * weights.geo.G1 + G2 * weights.geo.G2 + G3 * weights.geo.G3 + G4 * weights.geo.G4 +
    G5 * weights.geo.G5 + G6 * weights.geo.G6 + G7 * weights.geo.G7 + G8 * weights.geo.G8 +
    G9 * weights.geo.G9 + G10 * weights.geo.G10
  ) / 3;

  // Build check items
  const aeoChecks = [
    { id: 'A1', score: A1, weight: weights.aeo.A1, evidence: { found: A1 > 0, details: 'Answer-first design' } },
    { id: 'A2', score: A2, weight: weights.aeo.A2, evidence: { found: A2 > 0, details: 'Topical cluster integrity' } },
    { id: 'A3', score: A3, weight: weights.aeo.A3, evidence: { found: A3 > 0, details: 'Site authority' } },
    { id: 'A4', score: A4, weight: weights.aeo.A4, evidence: { found: A4 > 0, details: 'Originality & effort' } },
    { id: 'A5', score: A5, weight: weights.aeo.A5, evidence: { found: A5 > 0, details: 'Schema accuracy' } },
    { id: 'A6', score: A6, weight: weights.aeo.A6, evidence: { found: A6 > 0, details: 'Crawlability & canonicals' } },
    { id: 'A7', score: A7, weight: weights.aeo.A7, evidence: { found: A7 > 0, details: 'UX & performance' } },
    { id: 'A8', score: A8, weight: weights.aeo.A8, evidence: { found: A8 > 0, details: 'Sitemaps & discoverability' } },
    { id: 'A9', score: A9, weight: weights.aeo.A9, evidence: { found: A9 > 0, details: 'Freshness & stability' } },
    { id: 'A10', score: A10, weight: weights.aeo.A10, evidence: { found: A10 > 0, details: 'AI Overviews readiness' } }
  ];

  const geoChecks = [
    { id: 'G1', score: G1, weight: weights.geo.G1, evidence: { found: G1 > 0, details: 'Citable facts block' } },
    { id: 'G2', score: G2, weight: weights.geo.G2, evidence: { found: G2 > 0, details: 'Provenance schema' } },
    { id: 'G3', score: G3, weight: weights.geo.G3, evidence: { found: G3 > 0, details: 'Evidence density' } },
    { id: 'G4', score: G4, weight: weights.geo.G4, evidence: { found: G4 > 0, details: 'AI crawler access & parity' } },
    { id: 'G5', score: G5, weight: weights.geo.G5, evidence: { found: G5 > 0, details: 'Chunkability & structure' } },
    { id: 'G6', score: G6, weight: weights.geo.G6, evidence: { found: G6 > 0, details: 'Canonical fact URLs' } },
    { id: 'G7', score: G7, weight: weights.geo.G7, evidence: { found: G7 > 0, details: 'Dataset availability' } },
    { id: 'G8', score: G8, weight: weights.geo.G8, evidence: { found: G8 > 0, details: 'Policy transparency' } },
    { id: 'G9', score: G9, weight: weights.geo.G9, evidence: { found: G9 > 0, details: 'Update hygiene' } },
    { id: 'G10', score: G10, weight: weights.geo.G10, evidence: { found: G10 > 0, details: 'Cluster↔evidence linking' } }
  ];

  items.push(...aeoChecks, ...geoChecks);

  return {
    aeo: Math.round(aeo * 100) / 100,
    geo: Math.round(geo * 100) / 100,
    items
  };
}

// Load test fixtures
const fixturesDir = path.join(__dirname, 'fixtures');
const answerFirstGood = fs.readFileSync(path.join(fixturesDir, 'answer_first_good.html'), 'utf8');
const factsRefsGood = fs.readFileSync(path.join(fixturesDir, 'facts_refs_good.html'), 'utf8');
const bareMinimum = fs.readFileSync(path.join(fixturesDir, 'bare_minimum.html'), 'utf8');

// Expected scores
const EXPECTED_SCORES = {
  answer_first_good: {
    A1: 3, // answerBox + jumpLinks/tables = strong
    G1: 3, // facts block = strong
    G2: 3, // provenance schema = strong
    G3: 3  // refs block + outbound links ≥ 3 = strong
  },
  facts_refs_good: {
    A1: 0, // no answer box design
    G1: 3, // facts block = strong
    G2: 3, // provenance schema = strong
    G3: 3  // refs block + outbound links ≥ 3 = strong
  },
  bare_minimum: {
    A1: 0, // no answer box
    G1: 0, // no facts block
    G2: 0, // no provenance
    G3: 0  // no refs
  }
};

// Default weights
const weights = {
  aeo: { A1:15, A2:15, A3:15, A4:12, A5:10, A6:10, A7:8, A8:6, A9:5, A10:4 },
  geo: { G1:15, G2:15, G3:12, G4:12, G5:10, G6:8, G7:8, G8:6, G9:7, G10:7 },
  patterns: {
    facts_headings: ["key facts","at-a-glance","highlights","summary"],
    refs_headings: ["references","sources","citations","footnotes"],
    glossary_headings: ["glossary","definitions"]
  }
};

async function runGoldenTests() {
  console.log('🧪 Running Golden Tests for AEO/GEO Scoring\n');

  const tests = [
    { name: 'answer_first_good', html: answerFirstGood, url: 'https://learnings.org/ml-guide' },
    { name: 'facts_refs_good', html: factsRefsGood, url: 'https://learnings.org/climate-facts' },
    { name: 'bare_minimum', html: bareMinimum, url: 'https://learnings.org/basic' }
  ];

  let allPassed = true;

  for (const test of tests) {
    console.log(`📄 Testing: ${test.name}`);
    
    try {
      // Extract analysis
      const analysis = extractAll(test.html, { 
        url: test.url, 
        robots: {}, 
        rendered: false 
      });

      // Score the page
      const scores = scorePage(analysis, weights);

      // Debug G3 for answer_first_good and facts_refs_good
      if (test.name === 'answer_first_good' || test.name === 'facts_refs_good') {
        console.log(`  🔍 Debug: outboundLinks=${analysis.outboundLinks}, refsBlock=${analysis.refsBlock}`);
        if (test.name === 'facts_refs_good') {
          const condition = analysis.refsBlock && analysis.outboundLinks >= 3;
          console.log(`  🔍 G3 Debug: condition=${condition} (should be true for score 3)`);
        }
      }

      // Check key expectations
      const expected = EXPECTED_SCORES[test.name];
      let testPassed = true;

      for (const [checkId, expectedScore] of Object.entries(expected)) {
        const actualCheck = scores.items.find(item => item.id === checkId);
        const actualScore = actualCheck?.score || 0;

        if (actualScore === expectedScore) {
          console.log(`  ✅ ${checkId}: ${actualScore}/3 (expected ${expectedScore})`);
        } else {
          console.log(`  ❌ ${checkId}: ${actualScore}/3 (expected ${expectedScore})`);
          testPassed = false;
          allPassed = false;
        }
      }

      // Show overall scores
      console.log(`  📊 AEO: ${scores.aeo}, GEO: ${scores.geo}`);
      console.log(`  ${testPassed ? '✅ PASS' : '❌ FAIL'}\n`);

    } catch (error) {
      console.log(`  ❌ ERROR: ${error.message}\n`);
      allPassed = false;
    }
  }

  console.log(`🎯 Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  return allPassed;
}

// Run the tests
runGoldenTests().catch(console.error);
