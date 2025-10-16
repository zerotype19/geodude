export const DEFAULT_RULES = {
  aeo: { A1:15, A2:15, A3:15, A4:12, A5:10, A6:10, A7:8, A8:6, A9:5, A10:4 },
  geo: { G1:15, G2:15, G3:12, G4:12, G5:10, G6:8, G7:8, G8:6, G9:7, G10:7 },
  patterns: {
    facts_headings: ["key facts","at-a-glance","highlights","summary"],
    refs_headings: ["references","sources","citations","footnotes"],
    glossary_headings: ["glossary","definitions"]
  }
};

// This script can be run via the worker's /api/admin/seed-rules endpoint
// or directly with wrangler kv:put commands

console.log('Default rules configuration:');
console.log(JSON.stringify(DEFAULT_RULES, null, 2));
