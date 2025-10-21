/**
 * A12: Q&A Scaffold Detector (Shadow Mode)
 * 
 * Detects explicit Q&A patterns that improve snippetability:
 * - FAQ schema (FAQPage, Question/Answer)
 * - Definition lists (<dl><dt><dd>)
 * - Q&A blocks (headings with "?" followed by answer paragraphs)
 * - Concise answer blocks in first viewport
 * 
 * Scoring:
 * 3 = Multiple Q&A patterns + valid FAQ schema
 * 2 = At least one strong Q&A pattern (FAQ schema OR structured DL)
 * 1 = Weak patterns (question headings without clear answers)
 * 0 = No Q&A scaffold detected
 */

export interface QAScaffoldResult {
  score: number;          // 0-3
  found: boolean;
  patterns: string[];     // List of detected patterns
  evidence: {
    faq_schema: boolean;
    dl_elements: number;
    question_headings: number;
    answer_blocks: number;
    first_viewport_answer: boolean;
  };
}

/**
 * Detect Q&A scaffold patterns in HTML
 */
export function detectQAScaffold(html: string, jsonld: any[]): QAScaffoldResult {
  const patterns: string[] = [];
  const evidence = {
    faq_schema: false,
    dl_elements: 0,
    question_headings: 0,
    answer_blocks: 0,
    first_viewport_answer: false
  };

  // 1) Check for FAQ schema
  evidence.faq_schema = hasFAQSchema(jsonld);
  if (evidence.faq_schema) {
    patterns.push('FAQ Schema (FAQPage + Question/Answer)');
  }

  // 2) Check for <dl> elements (definition lists)
  const dlMatches = html.match(/<dl[^>]*>[\s\S]*?<\/dl>/gi) || [];
  evidence.dl_elements = dlMatches.length;
  if (evidence.dl_elements > 0) {
    patterns.push(`Definition lists (${evidence.dl_elements} <dl> elements)`);
  }

  // 3) Check for question headings (H2/H3 with "?")
  const questionHeadings = html.match(/<h[23][^>]*>[^<]*\?[^<]*<\/h[23]>/gi) || [];
  evidence.question_headings = questionHeadings.length;
  if (evidence.question_headings > 0) {
    patterns.push(`Question headings (${evidence.question_headings} H2/H3 with "?")`);
  }

  // 4) Check for answer blocks (paragraphs following question headings)
  // Simple heuristic: question heading followed by <p> within ~200 chars
  const answerBlockPattern = /<h[23][^>]*>[^<]*\?[^<]*<\/h[23]>\s*<p[^>]*>/gi;
  const answerBlocks = html.match(answerBlockPattern) || [];
  evidence.answer_blocks = answerBlocks.length;
  if (evidence.answer_blocks > 0) {
    patterns.push(`Answer blocks (${evidence.answer_blocks} Q→A pairs)`);
  }

  // 5) Check for concise answer in first viewport (~800 chars)
  const firstViewport = html.substring(0, 800);
  evidence.first_viewport_answer = hasEarlyAnswer(firstViewport);
  if (evidence.first_viewport_answer) {
    patterns.push('Concise answer in first viewport');
  }

  // Compute score
  let score = 0;
  
  if (evidence.faq_schema && (evidence.dl_elements > 0 || evidence.answer_blocks > 2)) {
    // Strong: FAQ schema + structural elements
    score = 3;
  } else if (evidence.faq_schema || (evidence.dl_elements >= 3) || (evidence.answer_blocks >= 5)) {
    // Good: Either FAQ schema OR multiple structural Q&A patterns
    score = 2;
  } else if (evidence.question_headings >= 3 || evidence.dl_elements > 0 || evidence.first_viewport_answer) {
    // Weak: Some Q&A signals
    score = 1;
  } else {
    // None detected
    score = 0;
  }

  return {
    score,
    found: score > 0,
    patterns,
    evidence
  };
}

/**
 * Check if JSON-LD includes FAQPage schema
 */
function hasFAQSchema(jsonld: any[]): boolean {
  if (!Array.isArray(jsonld)) return false;
  
  return jsonld.some(item => {
    if (!item || typeof item !== 'object') return false;
    
    const type = item['@type'];
    if (type === 'FAQPage') return true;
    if (Array.isArray(type) && type.includes('FAQPage')) return true;
    
    // Check for mainEntity with Question/Answer
    if (item.mainEntity && Array.isArray(item.mainEntity)) {
      return item.mainEntity.some((entity: any) => {
        const entityType = entity['@type'];
        return entityType === 'Question' || (Array.isArray(entityType) && entityType.includes('Question'));
      });
    }
    
    return false;
  });
}

/**
 * Check for early concise answer in first viewport
 * Looks for:
 * - Short paragraphs (20-150 words)
 * - Before any navigation or lengthy content
 * - After H1 or title
 */
function hasEarlyAnswer(firstViewport: string): boolean {
  // Remove script/style tags
  const cleaned = firstViewport.replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
  
  // Look for <p> tags after H1
  const afterH1 = cleaned.split(/<h1[^>]*>/i)[1];
  if (!afterH1) return false;
  
  const firstParagraph = afterH1.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (!firstParagraph) return false;
  
  const text = firstParagraph[1].replace(/<[^>]+>/g, '').trim();
  const wordCount = text.split(/\s+/).length;
  
  // Ideal answer length: 20-150 words
  return wordCount >= 20 && wordCount <= 150;
}

