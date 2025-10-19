/**
 * Universal Classification v1.0 - JSON-LD Parser
 * Extracts and normalizes @type values from JSON-LD blocks
 */

/**
 * Extract JSON-LD blocks from HTML
 */
function extractJsonLdBlocks(html: string): any[] {
  const blocks: any[] = [];
  const regex = /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const json = JSON.parse(match[1]);
      blocks.push(json);
    } catch (e) {
      // Invalid JSON, skip
      continue;
    }
  }
  
  return blocks;
}

/**
 * Recursively extract @type values from JSON-LD objects
 * Handles both single types and arrays of types
 */
function extractTypes(obj: any, types: Set<string> = new Set()): Set<string> {
  if (!obj || typeof obj !== 'object') {
    return types;
  }
  
  // Handle @type
  if (obj['@type']) {
    if (Array.isArray(obj['@type'])) {
      obj['@type'].forEach((t: string) => types.add(t));
    } else if (typeof obj['@type'] === 'string') {
      types.add(obj['@type']);
    }
  }
  
  // Handle @graph
  if (obj['@graph'] && Array.isArray(obj['@graph'])) {
    obj['@graph'].forEach((item: any) => extractTypes(item, types));
  }
  
  // Recurse into nested objects and arrays
  for (const key in obj) {
    if (key === '@type' || key === '@context') continue;
    
    const value = obj[key];
    if (Array.isArray(value)) {
      value.forEach((item: any) => extractTypes(item, types));
    } else if (typeof value === 'object' && value !== null) {
      extractTypes(value, types);
    }
  }
  
  return types;
}

/**
 * Main parser - extract all unique @type values from HTML
 */
export function parseJsonLd(html: string): string[] {
  const blocks = extractJsonLdBlocks(html);
  const types = new Set<string>();
  
  blocks.forEach(block => {
    extractTypes(block, types);
  });
  
  // Normalize types (remove Schema.org prefix if present)
  const normalized = Array.from(types).map(type => {
    // Remove http://schema.org/ or https://schema.org/ prefix
    return type.replace(/^https?:\/\/schema\.org\//, '');
  });
  
  return normalized.sort();
}

/**
 * Check if JSON-LD contains specific type patterns
 */
export function hasJsonLdType(types: string[], pattern: string | RegExp): boolean {
  if (typeof pattern === 'string') {
    return types.includes(pattern);
  }
  return types.some(t => pattern.test(t));
}

/**
 * Check if JSON-LD contains any of the specified types
 */
export function hasAnyJsonLdType(types: string[], targets: string[]): boolean {
  return targets.some(target => types.includes(target));
}

