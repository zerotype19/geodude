/**
 * G12: Topic Depth / Semantic Coverage (Shadow Mode)
 * 
 * Checks whether a page covers the conceptual space of its topic.
 * Helps "Answer Fitness" E-E-A-T pillar.
 * 
 * Analyzes:
 * - Lexical overlap with seed topic terms
 * - Question patterns (what/how/why/pros/cons)
 * - Supporting structures (lists/tables/examples)
 * 
 * Scoring:
 * 3 = Deep coverage: rich terms, multiple question patterns, examples
 * 2 = Good coverage: decent overlap, some patterns
 * 1 = Weak coverage: sparse terms, few patterns
 * 0 = Poor coverage: minimal topical alignment
 */

export interface TopicDepthResult {
  score: number;          // 0-3
  found: boolean;
  metrics: {
    term_count: number;
    coverage_ratio: number;      // 0-1
    question_patterns: number;
    supporting_structures: number;
    word_count: number;
  };
  evidence: {
    top_terms: string[];
    question_patterns_found: string[];
    structures_found: string[];
  };
}

/**
 * Common stopwords to exclude from topic analysis
 */
const STOPWORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their',
  'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me'
]);

/**
 * Question patterns that indicate depth
 */
const QUESTION_PATTERNS = [
  'what', 'how', 'why', 'when', 'where', 'who',
  'pros', 'cons', 'benefits', 'advantages', 'disadvantages',
  'cost', 'price', 'compare', 'comparison', 'versus', 'vs',
  'best', 'worst', 'top', 'example', 'examples',
  'guide', 'tutorial', 'explained', 'definition'
];

/**
 * Analyze topic depth and semantic coverage
 */
export function analyzeTopicDepth(
  bodyText: string,
  html: string,
  seedTerms?: string[]
): TopicDepthResult {
  // Clean and tokenize text
  const cleaned = bodyText.toLowerCase()
    .replace(/<[^>]+>/g, ' ')  // Remove HTML tags
    .replace(/[^\w\s]/g, ' ')  // Remove punctuation
    .replace(/\s+/g, ' ')      // Normalize whitespace
    .trim();

  const words = cleaned.split(/\s+/);
  const wordCount = words.length;

  // Extract terms (excluding stopwords)
  const termFreq = new Map<string, number>();
  for (const word of words) {
    if (word.length < 3 || STOPWORDS.has(word)) continue;
    termFreq.set(word, (termFreq.get(word) || 0) + 1);
  }

  // Get top terms by frequency
  const topTerms = Array.from(termFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([term]) => term);

  // Compute coverage ratio
  let coverageRatio = 0;
  if (seedTerms && seedTerms.length > 0) {
    const seedSet = new Set(seedTerms.map(t => t.toLowerCase()));
    const overlap = topTerms.filter(t => seedSet.has(t)).length;
    coverageRatio = Math.min(1, overlap / Math.min(seedTerms.length, 20));
  } else {
    // No seed terms; use term diversity as proxy
    coverageRatio = Math.min(1, topTerms.length / 40);
  }

  // Find question patterns
  const questionPatternsFound: string[] = [];
  for (const pattern of QUESTION_PATTERNS) {
    if (cleaned.includes(pattern)) {
      questionPatternsFound.push(pattern);
    }
  }

  // Find supporting structures
  const structuresFound: string[] = [];
  
  // Lists
  const listMatches = html.match(/<[ou]l[^>]*>[\s\S]*?<\/[ou]l>/gi) || [];
  if (listMatches.length >= 2) structuresFound.push(`${listMatches.length} lists`);
  
  // Tables
  const tableMatches = html.match(/<table[^>]*>[\s\S]*?<\/table>/gi) || [];
  if (tableMatches.length > 0) structuresFound.push(`${tableMatches.length} tables`);
  
  // Definition lists
  const dlMatches = html.match(/<dl[^>]*>[\s\S]*?<\/dl>/gi) || [];
  if (dlMatches.length > 0) structuresFound.push(`${dlMatches.length} definition lists`);
  
  // Examples/comparisons (heuristic)
  if (/for example|such as|including|e\.g\.|i\.e\./i.test(bodyText)) {
    structuresFound.push('examples');
  }
  if (/compare|comparison|versus|vs\.|better than|worse than/i.test(bodyText)) {
    structuresFound.push('comparisons');
  }

  // Compute score
  const metrics = {
    term_count: topTerms.length,
    coverage_ratio: coverageRatio,
    question_patterns: questionPatternsFound.length,
    supporting_structures: structuresFound.length,
    word_count: wordCount
  };

  // Scoring components
  const lexicalScore = coverageRatio;  // 0-1
  const questionScore = Math.min(1, questionPatternsFound.length / 5);  // 0-1
  const structureScore = Math.min(1, structuresFound.length / 4);  // 0-1

  // Weighted average
  const rawScore = (lexicalScore * 0.4) + (questionScore * 0.3) + (structureScore * 0.3);

  // Convert to 0-3 scale
  let score = 0;
  if (rawScore >= 0.80) score = 3;
  else if (rawScore >= 0.60) score = 2;
  else if (rawScore >= 0.35) score = 1;
  else score = 0;

  return {
    score,
    found: score > 0,
    metrics,
    evidence: {
      top_terms: topTerms.slice(0, 10),  // Top 10 for display
      question_patterns_found: questionPatternsFound,
      structures_found: structuresFound
    }
  };
}

/**
 * Generate seed terms from domain description and homepage
 */
export function generateSeedTerms(
  siteDescription?: string,
  homepageTitle?: string,
  homepageMeta?: string
): string[] {
  const text = [siteDescription, homepageTitle, homepageMeta]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = text.split(/\s+/);
  const seedTerms = words.filter(w => w.length >= 3 && !STOPWORDS.has(w));

  // Deduplicate and return
  return Array.from(new Set(seedTerms));
}

/**
 * Compute term frequency for a corpus
 */
function computeTermFrequency(text: string): Map<string, number> {
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/);

  const freq = new Map<string, number>();
  for (const word of words) {
    if (word.length < 3 || STOPWORDS.has(word)) continue;
    freq.set(word, (freq.get(word) || 0) + 1);
  }

  return freq;
}

/**
 * Simple TF-IDF calculation (term frequency only for now)
 * Could be enhanced with IDF in future phases
 */
export function extractTopTerms(text: string, limit: number = 40): string[] {
  const freq = computeTermFrequency(text);
  
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term]) => term);
}

