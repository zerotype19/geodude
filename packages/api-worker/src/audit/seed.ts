/**
 * Seed crawl frontier with initial URLs from main sitemap only
 */

import { normalizeUrl } from './url-utils';
import { safeFetch } from '../safe-fetch';

export async function seedFrontier(
  env: any, 
  auditId: string, 
  origin: string, 
  ctx: any // Add ctx for waitUntil
) {
  console.log(`[Seed] Seeding frontier for audit ${auditId} with origin ${origin}`);
  
  const mainOnlyMode = env.CRAWL_SITEMAP_MAIN_ONLY === "1";
  
  // MAIN-ONLY MODE: Only fetch sitemap.xml, no robots.txt or indexes
  if (mainOnlyMode) {
    console.log(`[Seed] Using MAIN-ONLY MODE: only sitemap.xml seeding`);
    
    // Import main-only components
    const { seedFrontierMainOnly } = await import('../crawl/seed-main');
    
    // Use the new main-only seeding logic
    const result = await seedFrontierMainOnly(env, auditId, origin, ctx);
    
    return {
      homepage: 1,
      navLinks: 0,
      sitemapUrls: result.urls.length,
      total: result.seeded,
      seeded: result.seeded > 0
    };
  }
  
  // LEGACY MODE: Original seeding logic (deprecated)
  console.log(`[Seed] Using LEGACY MODE: homepage + nav + sitemap`);
  return { homepage: 0, navLinks: 0, sitemapUrls: 0, total: 0, seeded: false, reason: 'LEGACY_MODE_DEPRECATED' };
}
