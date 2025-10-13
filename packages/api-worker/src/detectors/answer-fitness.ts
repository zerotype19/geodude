/**
 * Answer Fitness Detector - Phase Next
 * Analyzes content for AI assistant answerability
 */

export interface AnswerFitnessResult {
  fitness: number; // 0-100%
  chunkability: number; // 0-100%
  qaScaffolds: number; // 0-100%
  snippetability: number; // 0-100%
  citationFriendliness: number; // 0-100%
  breakdown: {
    headingHierarchy: boolean;
    paragraphLength: boolean;
    summaryPresent: boolean;
    qaSections: number;
    listsAndTables: number;
    outboundReferences: number;
  };
}

export function analyzeAnswerFitness(
  html: string,
  title?: string,
  h1?: string
): AnswerFitnessResult {
  const content = extractTextContent(html);
  const headings = extractHeadings(html);
  const paragraphs = extractParagraphs(html);
  const lists = extractLists(html);
  const tables = extractTables(html);
  const links = extractLinks(html);
  
  // Chunkability analysis
  const chunkability = analyzeChunkability(headings, paragraphs, content);
  
  // Q&A scaffolds analysis
  const qaScaffolds = analyzeQAScaffolds(content, html);
  
  // Snippetability analysis
  const snippetability = analyzeSnippetability(lists, tables, content);
  
  // Citation friendliness analysis
  const citationFriendliness = analyzeCitationFriendliness(links);
  
  // Overall fitness (weighted average)
  const fitness = (
    chunkability * 0.3 +
    qaScaffolds * 0.25 +
    snippetability * 0.25 +
    citationFriendliness * 0.2
  );
  
  return {
    fitness: Math.round(fitness * 100) / 100,
    chunkability: Math.round(chunkability * 100) / 100,
    qaScaffolds: Math.round(qaScaffolds * 100) / 100,
    snippetability: Math.round(snippetability * 100) / 100,
    citationFriendliness: Math.round(citationFriendliness * 100) / 100,
    breakdown: {
      headingHierarchy: hasGoodHeadingHierarchy(headings),
      paragraphLength: hasGoodParagraphLength(paragraphs),
      summaryPresent: hasSummary(content),
      qaSections: countQASections(content),
      listsAndTables: lists.length + tables.length,
      outboundReferences: links.length
    }
  };
}

function extractTextContent(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractHeadings(html: string): Array<{ level: number; text: string }> {
  const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi;
  const headings: Array<{ level: number; text: string }> = [];
  let match;
  
  while ((match = headingRegex.exec(html)) !== null) {
    headings.push({
      level: parseInt(match[1]),
      text: match[2].replace(/<[^>]+>/g, '').trim()
    });
  }
  
  return headings;
}

function extractParagraphs(html: string): string[] {
  const paragraphRegex = /<p[^>]*>(.*?)<\/p>/gi;
  const paragraphs: string[] = [];
  let match;
  
  while ((match = paragraphRegex.exec(html)) !== null) {
    const text = match[1].replace(/<[^>]+>/g, '').trim();
    if (text.length > 0) {
      paragraphs.push(text);
    }
  }
  
  return paragraphs;
}

function extractLists(html: string): string[] {
  const listRegex = /<(ul|ol)[^>]*>(.*?)<\/(ul|ol)>/gi;
  const lists: string[] = [];
  let match;
  
  while ((match = listRegex.exec(html)) !== null) {
    const listContent = match[2].replace(/<[^>]+>/g, ' ').trim();
    if (listContent.length > 0) {
      lists.push(listContent);
    }
  }
  
  return lists;
}

function extractTables(html: string): string[] {
  const tableRegex = /<table[^>]*>(.*?)<\/table>/gi;
  const tables: string[] = [];
  let match;
  
  while ((match = tableRegex.exec(html)) !== null) {
    const tableContent = match[1].replace(/<[^>]+>/g, ' ').trim();
    if (tableContent.length > 0) {
      tables.push(tableContent);
    }
  }
  
  return tables;
}

function extractLinks(html: string): Array<{ url: string; text: string }> {
  const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
  const links: Array<{ url: string; text: string }> = [];
  let match;
  
  while ((match = linkRegex.exec(html)) !== null) {
    links.push({
      url: match[1],
      text: match[2].replace(/<[^>]+>/g, '').trim()
    });
  }
  
  return links;
}

function analyzeChunkability(
  headings: Array<{ level: number; text: string }>,
  paragraphs: string[],
  content: string
): number {
  let score = 0;
  
  // Heading hierarchy (40 points)
  if (hasGoodHeadingHierarchy(headings)) {
    score += 40;
  }
  
  // Paragraph length (30 points)
  if (hasGoodParagraphLength(paragraphs)) {
    score += 30;
  }
  
  // Summary presence (30 points)
  if (hasSummary(content)) {
    score += 30;
  }
  
  return score;
}

function hasGoodHeadingHierarchy(headings: Array<{ level: number; text: string }>): boolean {
  if (headings.length === 0) return false;
  
  // Check for proper hierarchy (no skipping levels)
  let lastLevel = 0;
  for (const heading of headings) {
    if (heading.level > lastLevel + 1) {
      return false;
    }
    lastLevel = heading.level;
  }
  
  // Must have at least one H1 and some structure
  const h1Count = headings.filter(h => h.level === 1).length;
  return h1Count > 0 && headings.length >= 2;
}

function hasGoodParagraphLength(paragraphs: string[]): boolean {
  if (paragraphs.length === 0) return false;
  
  // Check if median paragraph length is reasonable (50-200 words)
  const wordCounts = paragraphs.map(p => p.split(/\s+/).length);
  const sortedCounts = wordCounts.sort((a, b) => a - b);
  const median = sortedCounts[Math.floor(sortedCounts.length / 2)];
  
  return median >= 50 && median <= 200;
}

function hasSummary(content: string): boolean {
  const summaryKeywords = [
    'summary', 'overview', 'tldr', 'key points', 'main points',
    'in conclusion', 'to summarize', 'in summary'
  ];
  
  const lowerContent = content.toLowerCase();
  return summaryKeywords.some(keyword => lowerContent.includes(keyword));
}

function analyzeQAScaffolds(content: string, html: string): number {
  let score = 0;
  
  // Q&A sections (50 points)
  const qaSections = countQASections(content);
  score += Math.min(50, qaSections * 10);
  
  // FAQ markup (30 points)
  if (html.includes('itemprop="question"') || html.includes('itemprop="answer"')) {
    score += 30;
  }
  
  // Question patterns (20 points)
  const questionPatterns = [
    'what is', 'how do', 'can i', 'why does', 'when should',
    'where can', 'who is', 'which is', 'how to'
  ];
  
  const lowerContent = content.toLowerCase();
  const questionCount = questionPatterns.filter(pattern => 
    lowerContent.includes(pattern)
  ).length;
  
  score += Math.min(20, questionCount * 5);
  
  return score;
}

function countQASections(content: string): number {
  const qaKeywords = ['faq', 'questions', 'answers', 'q&a'];
  const lowerContent = content.toLowerCase();
  
  return qaKeywords.filter(keyword => lowerContent.includes(keyword)).length;
}

function analyzeSnippetability(lists: string[], tables: string[], content: string): number {
  let score = 0;
  
  // Lists and tables (40 points)
  const structuredContent = lists.length + tables.length;
  score += Math.min(40, structuredContent * 5);
  
  // Numbered lists (30 points)
  const numberedLists = content.match(/\d+\.\s/g) || [];
  score += Math.min(30, numberedLists.length * 3);
  
  // Bullet points (30 points)
  const bulletPoints = content.match(/[•·▪▫]\s/g) || [];
  score += Math.min(30, bulletPoints.length * 2);
  
  return score;
}

function analyzeCitationFriendliness(links: Array<{ url: string; text: string }>): number {
  if (links.length === 0) return 0;
  
  let score = 0;
  
  // Outbound references (50 points)
  const outboundLinks = links.filter(link => 
    link.url.startsWith('http') && !link.url.includes(window?.location?.hostname || '')
  );
  score += Math.min(50, outboundLinks.length * 5);
  
  // Recognizable publishers (30 points)
  const publisherDomains = [
    'wikipedia.org', 'github.com', 'stackoverflow.com', 'medium.com',
    'techcrunch.com', 'wired.com', 'arstechnica.com', 'theverge.com'
  ];
  
  const publisherLinks = outboundLinks.filter(link => 
    publisherDomains.some(domain => link.url.includes(domain))
  );
  score += Math.min(30, publisherLinks.length * 10);
  
  // Academic sources (20 points)
  const academicDomains = [
    'edu', 'ac.uk', 'ac.jp', 'ac.in', 'ac.za'
  ];
  
  const academicLinks = outboundLinks.filter(link => 
    academicDomains.some(domain => link.url.includes(domain))
  );
  score += Math.min(20, academicLinks.length * 15);
  
  return score;
}
