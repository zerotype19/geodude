/**
 * Quick Demo Script for Industry V2
 * Tests random domains and shows industry detection + prompt quality
 */

const API_BASE = 'https://api.optiview.ai';

const hosts = [
  "cologuard.com",
  "chase.com",
  "visa.com",
  "stripe.com",
  "nike.com",
  "lexus.com",
  "etsy.com",
  "hilton.com",
  "nytimes.com",
  "mayoclinic.org"
];

async function testHost(h) {
  try {
    const url = `${API_BASE}/api/llm/prompts?domain=${h}&mode=blended&nocache=1&ttl=60`;
    const r = await fetch(url);
    const j = await r.json();
    
    const industry = j.industry || 'default';
    const template = j.template_version || 'v1.0';
    const source = j.source || '—';
    const realism = j.realism_score ? j.realism_score.toFixed(2) : '—';
    const nbCount = j.nonBranded?.length ?? 0;
    const leakRate = j.qualityGate?.leakRate ?? j.quality?.leakRate ?? 0;
    
    const status = (nbCount >= 11 && leakRate === 0) ? '✅' : '⚠️';
    
    console.log(`${status} ${h.padEnd(20)} → ${industry.padEnd(22)} ${template.padEnd(6)} ${source.padEnd(10)} R:${realism} NB:${nbCount} Leak:${leakRate}`);
    
    return { host: h, passed: nbCount >= 11 && leakRate === 0 };
  } catch (error) {
    console.log(`❌ ${h.padEnd(20)} → ERROR: ${error.message}`);
    return { host: h, passed: false };
  }
}

async function run() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('INDUSTRY V2 QUICK DEMO');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Status  Domain                → Industry                 Tmpl   Source      Realism NB  Leak');
  console.log('────────────────────────────────────────────────────────────────────────────────────────────────────────');
  
  const results = [];
  for (const h of hosts) {
    const result = await testHost(h);
    results.push(result);
    // Rate limit: wait 1.5 seconds between requests
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  
  console.log('────────────────────────────────────────────────────────────────────────────────────────────────────────');
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`\nResults: ${passed}/${total} passed`);
  console.log(`Success Criteria: NB ≥ 11, Leak = 0, Realism ≥ 0.74 (industry) / 0.62 (default)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

run().catch(console.error);

