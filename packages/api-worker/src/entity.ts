/**
 * Entity Graph Utilities
 * Generate sameAs recommendations for Organization schema
 */

export interface SameAssuggestions {
  suggestions: string[];
  jsonld_snippet: string;
}

export function suggestSameAs(params: {
  domain: string;
  orgName?: string;
}): SameAssuggestions {
  const { domain, orgName } = params;

  // Create slug from domain or org name
  const baseName = orgName || domain.replace(/^www\./, '').split('.')[0];
  const slug = baseName
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9-]/g, '');

  // Generate candidate URLs
  const suggestions: string[] = [
    `https://www.linkedin.com/company/${slug}`,
    `https://www.crunchbase.com/organization/${slug}`,
    `https://github.com/${slug}`,
  ];

  // Add Wikidata search if org name is available
  if (orgName) {
    suggestions.push(
      `https://www.wikidata.org/wiki/Special:Search?search=${encodeURIComponent(orgName)}`
    );
  }

  // Generate JSON-LD snippet
  const jsonld_snippet = `{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "${orgName || baseName}",
  "url": "https://${domain}",
  "sameAs": [
    "${suggestions[0]}",
    "${suggestions[1]}",
    "${suggestions[2]}"${orgName ? `,\n    "${suggestions[3]}"` : ''}
  ]
}`;

  return {
    suggestions,
    jsonld_snippet,
  };
}

