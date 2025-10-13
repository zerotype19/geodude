/**
 * Render Parity Detector - Phase Next
 * Compares raw HTML text content vs headless-rendered DOM text
 */

export interface RenderParityResult {
  similarity: number; // 0-100%
  rawTextLength: number;
  renderedTextLength: number;
  differences: string[];
}

export async function calculateRenderParity(
  html: string,
  renderedText: string
): Promise<RenderParityResult> {
  // Normalize text for comparison
  const rawText = normalizeText(html);
  const renderedTextNormalized = normalizeText(renderedText);
  
  // Calculate Sørensen-Dice similarity on token trigrams
  const similarity = calculateSorensenDice(rawText, renderedTextNormalized);
  
  // Find differences (simplified)
  const differences = findTextDifferences(rawText, renderedTextNormalized);
  
  return {
    similarity: Math.round(similarity * 100) / 100,
    rawTextLength: rawText.length,
    renderedTextLength: renderedTextNormalized.length,
    differences: differences.slice(0, 10) // Limit to 10 differences
  };
}

function normalizeText(text: string): string {
  return text
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove styles
    .replace(/<[^>]+>/g, ' ') // Remove HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .toLowerCase();
}

function calculateSorensenDice(text1: string, text2: string): number {
  const trigrams1 = getTrigrams(text1);
  const trigrams2 = getTrigrams(text2);
  
  const intersection = new Set([...trigrams1].filter(x => trigrams2.has(x)));
  const union = new Set([...trigrams1, ...trigrams2]);
  
  return union.size > 0 ? (2 * intersection.size) / union.size : 0;
}

function getTrigrams(text: string): Set<string> {
  const trigrams = new Set<string>();
  const words = text.split(/\s+/);
  
  for (let i = 0; i < words.length - 2; i++) {
    const trigram = words.slice(i, i + 3).join(' ');
    if (trigram.length > 0) {
      trigrams.add(trigram);
    }
  }
  
  return trigrams;
}

function findTextDifferences(text1: string, text2: string): string[] {
  const words1 = text1.split(/\s+/);
  const words2 = text2.split(/\s+/);
  const differences: string[] = [];
  
  const maxLength = Math.max(words1.length, words2.length);
  
  for (let i = 0; i < maxLength; i++) {
    if (words1[i] !== words2[i]) {
      differences.push(`Position ${i}: "${words1[i] || ''}" vs "${words2[i] || ''}"`);
    }
  }
  
  return differences;
}
