/**
 * Intent Filtering (Pack-Driven)
 * 
 * Filters intents based on industry-specific allow/deny lists
 */

import { getFlattenedPack } from '../config/loader';

export interface Intent {
  text: string;
  tags?: Set<string> | string[];
}

/**
 * Check if intent has a specific tag
 */
function hasTag(intent: Intent, tag: string): boolean {
  if (!intent.tags) return false;
  const tagSet = intent.tags instanceof Set ? intent.tags : new Set(intent.tags);
  return tagSet.has(tag);
}

/**
 * Filter intents by industry pack
 */
export function filterIntentsByPack(intents: Intent[], industry: string): Intent[] {
  const { allow, deny } = getFlattenedPack(industry);

  return intents.filter(intent => {
    const text = intent.text.toLowerCase();
    
    // Check deny list first (hard block)
    for (const phrase of deny) {
      if (text.includes(phrase)) {
        return false;
      }
    }

    // If allow list is empty, allow by default (permissive)
    if (allow.size === 0) {
      return true;
    }

    // Check if text matches any allowed tag
    for (const tag of allow) {
      // Check both text content and tags
      const tagNormalized = tag.replace(/_/g, ' ');
      
      // Also check for partial keyword matches (e.g., "cost" matches "msrp", "dealer" matches "dealer_locator")
      const keywords = tag.split('_');
      const hasKeywordMatch = keywords.some(keyword => text.includes(keyword));
      
      // Check for semantic matches (e.g., "cost" should match "pricing", "msrp")
      const semanticMatches: Record<string, string[]> = {
        'pricing': ['price', 'cost', 'how much'],
        'msrp': ['price', 'cost', 'how much'],
      };
      const hasSemanticMatch = semanticMatches[tag]?.some(keyword => text.includes(keyword)) || false;
      
      if (text.includes(tagNormalized) || hasKeywordMatch || hasSemanticMatch || hasTag(intent, tag)) {
        return true;
      }
    }

    // If allow list exists but no match found, filter out
    return false;
  });
}

/**
 * Normalize brand grammar in query text
 */
export function normalizeBrandGrammar(text: string, brand: string): string {
  // Handle pluralized brand names (e.g., "Toyotas" → "Toyota vehicles")
  const regex = new RegExp(`\\b${brand}s\\b`, 'gi');
  return text.replace(regex, `${brand} vehicles`);
}

