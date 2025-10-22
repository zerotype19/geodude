export type CheckMeta = {
  code: string;
  label: string;          // Short, human friendly
  description: string;    // 1-line tooltip
  category: "Answerability" | "Authority" | "Originals" | "Access" | "Structure" | "Governance" | "Integrity" | "Rendering";
  weightKey?: "aeo" | "geo";
  guideAnchor: string;    // anchor on scoring guide
};

export const CHECKS: Record<string, CheckMeta> = {
  // -------- AEO --------
  A1: { 
    code: "A1", 
    label: "Answer-first design", 
    category: "Answerability",
    description: "Concise answer at the top; add anchors and list/table when helpful (TOC is optional).",
    weightKey: "aeo", 
    guideAnchor: "#a1-answer-first-design" 
  },
  A2: { 
    code: "A2", 
    label: "Topical cluster integrity", 
    category: "Structure",
    description: "Dense internal links within the pillar/topic.",
    weightKey: "aeo", 
    guideAnchor: "#a2-topical-cluster-integrity" 
  },
  A3: { 
    code: "A3", 
    label: "Host/site authority", 
    category: "Authority",
    description: "Organization schema, author credentials, editorial standards.",
    weightKey: "aeo", 
    guideAnchor: "#a3-host-site-level-authority" 
  },
  A4: { 
    code: "A4", 
    label: "Originality & effort", 
    category: "Originals",
    description: "Unique data, tools, diagrams, code, methods.",
    weightKey: "aeo", 
    guideAnchor: "#a4-originality-effort" 
  },
  A5: { 
    code: "A5", 
    label: "Schema accuracy", 
    category: "Governance",
    description: "Valid JSON-LD for page intent. Note: FAQPage/HowTo rich results limited since 2023-use only when truly relevant.",
    weightKey: "aeo", 
    guideAnchor: "#a5-schema-accuracy-breadth" 
  },
  A6: { 
    code: "A6", 
    label: "Crawlability & canonicals", 
    category: "Access",
    description: "Self-canonical, unique title/H1, crawlable.",
    weightKey: "aeo", 
    guideAnchor: "#a6-crawlability-canonicals" 
  },
  A7: { 
    code: "A7", 
    label: "UX & performance", 
    category: "Access",
    description: "Stable layout, no CLS, fast rendering.",
    weightKey: "aeo", 
    guideAnchor: "#a7-ux-performance-proxies" 
  },
  A8: { 
    code: "A8", 
    label: "Sitemaps & discoverability", 
    category: "Access",
    description: "Fresh sitemap with accurate lastmod dates.",
    weightKey: "aeo", 
    guideAnchor: "#a8-sitemaps-discoverability" 
  },
  A9: { 
    code: "A9", 
    label: "Freshness & stability", 
    category: "Governance",
    description: "Updated dates, working links, stable URLs.",
    weightKey: "aeo", 
    guideAnchor: "#a9-freshness-stability" 
  },
  A10: { 
    code: "A10", 
    label: "AI Overviews readiness", 
    category: "Answerability",
    description: "Complete, safe, well-cited answer. Note: AIO behavior evolves; monitor impressions and traffic over time.",
    weightKey: "aeo", 
    guideAnchor: "#a10-ai-overviews-readiness" 
  },
  A11: { 
    code: "A11", 
    label: "Render visibility (SPA risk)", 
    category: "Rendering",
    description: "Keep key content and JSON-LD in HTML. AEO: small site penalty only if <30%. GEO: stricter-bots often don't run JS.",
    weightKey: "aeo", 
    guideAnchor: "#a11-render-visibility-spa-risk" 
  },

  // -------- GEO --------
  G1: { 
    code: "G1", 
    label: "Citable facts block", 
    category: "Answerability",
    description: "Key facts section with 3-7 atomic bullets.",
    weightKey: "geo", 
    guideAnchor: "#g1-citable-key-facts-block" 
  },
  G2: { 
    code: "G2", 
    label: "Provenance schema", 
    category: "Governance",
    description: "Author, publisher, dates, citations in JSON-LD.",
    weightKey: "geo", 
    guideAnchor: "#g2-provenance-schema" 
  },
  G3: { 
    code: "G3", 
    label: "Evidence density", 
    category: "Integrity",
    description: "References section with outbound links and data.",
    weightKey: "geo", 
    guideAnchor: "#g3-evidence-density" 
  },
  G4: { 
    code: "G4", 
    label: "AI crawler access", 
    category: "Access",
    description: "Be explicit with AI bots and ensure HTML≈rendered content. Note: real-world tests show occasional non-compliance; verify via access logs.",
    weightKey: "geo", 
    guideAnchor: "#g4-ai-crawler-access-parity" 
  },
  G5: { 
    code: "G5", 
    label: "Chunkability & structure", 
    category: "Structure",
    description: "Short paragraphs, semantic headings, glossary.",
    weightKey: "geo", 
    guideAnchor: "#g5-chunkability-structure" 
  },
  G6: { 
    code: "G6", 
    label: "Canonical fact URLs", 
    category: "Structure",
    description: "Stable URLs and anchors for individual facts.",
    weightKey: "geo", 
    guideAnchor: "#g6-canonical-fact-urls" 
  },
  G7: { 
    code: "G7", 
    label: "Dataset availability", 
    category: "Originals",
    description: "Downloadable CSV/JSON with version notes.",
    weightKey: "geo", 
    guideAnchor: "#g7-dataset-availability" 
  },
  G8: { 
    code: "G8", 
    label: "Policy transparency", 
    category: "Governance",
    description: "Clear content license and AI reuse stance.",
    weightKey: "geo", 
    guideAnchor: "#g8-policy-transparency" 
  },
  G9: { 
    code: "G9", 
    label: "Update hygiene", 
    category: "Integrity",
    description: "Visible changelog and aligned dateModified.",
    weightKey: "geo", 
    guideAnchor: "#g9-update-hygiene" 
  },
  G10: { 
    code: "G10", 
    label: "Cluster-evidence linking", 
    category: "Structure",
    description: "Pillars link to sources hub and back.",
    weightKey: "geo", 
    guideAnchor: "#g10-cluster-evidence-linking" 
  }
};

export const getCheckMeta = (code: string): CheckMeta => 
  CHECKS[code] ?? { 
    code, 
    label: code, 
    description: "", 
    category: "Answerability", 
    guideAnchor: "#score-guide" 
  };

// Helper to get all checks by category
export const getChecksByCategory = () => {
  const byCategory: Record<string, CheckMeta[]> = {};
  
  Object.values(CHECKS).forEach(check => {
    if (!byCategory[check.category]) {
      byCategory[check.category] = [];
    }
    byCategory[check.category].push(check);
  });
  
  return byCategory;
};

// Predefined category groups for UI
export const CHECK_GROUPS = [
  { 
    title: "Answerability", 
    codes: ["A1", "A10", "G1", "G6"],
    description: "Content that directly answers user queries"
  },
  { 
    title: "Authority & Integrity", 
    codes: ["A3", "G2", "G3", "G9"],
    description: "Trustworthiness and credibility signals"
  },
  { 
    title: "Structure & Access", 
    codes: ["A2", "A6", "A8", "G4", "G5", "G10"],
    description: "Crawlability and content organization"
  },
  { 
    title: "Governance & Schema", 
    codes: ["A5", "A9", "G8"],
    description: "Technical implementation and policies"
  },
  { 
    title: "Originals & Unique Assets", 
    codes: ["A4", "G7"],
    description: "Proprietary data and tools"
  },
  { 
    title: "Rendering & Performance", 
    codes: ["A7", "A11"],
    description: "Technical performance and visibility"
  }
];

