/**
 * Backfill Industry Data
 * 
 * Resolves and updates industry for all existing audits in D1.
 * Tests the industry resolution system on real historical data.
 * 
 * Usage:
 *   npx wrangler dev scripts/backfill-industry.ts
 *   Then visit the worker URL in browser or curl it
 */

import { resolveIndustry } from '../src/lib/industry';
import { loadIndustryConfig } from '../src/config/loader';

interface Env {
  DB: D1Database;
  DOMAIN_RULES_KV: KVNamespace;
}

interface Audit {
  id: string;
  root_url: string;
  site_description: string | null;
  industry: string | null;
  industry_source: string | null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Safety: require ?confirm=yes to run
    if (url.searchParams.get('confirm') !== 'yes') {
      return new Response(
        JSON.stringify({
          error: 'Backfill not confirmed',
          message: 'Add ?confirm=yes to run backfill',
          info: 'This will update industry data for all audits in D1',
        }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('[BACKFILL] Starting industry backfill...');
    
    try {
      // Load industry configuration
      await loadIndustryConfig(env);
      console.log('[BACKFILL] Industry config loaded');

      // Get all audits with NULL industry
      const result = await env.DB.prepare(
        `SELECT id, root_url, site_description, industry, industry_source 
         FROM audits 
         WHERE industry IS NULL
         ORDER BY started_at DESC`
      ).all<Audit>();

      if (!result.success || !result.results) {
        throw new Error('Failed to fetch audits from D1');
      }

      const audits = result.results;
      console.log(`[BACKFILL] Found ${audits.length} audits with NULL industry`);

      if (audits.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'No audits need backfilling',
            updated: 0,
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Process each audit
      const updates: Array<{
        id: string;
        url: string;
        domain: string;
        industry: string;
        source: string;
      }> = [];

      let processed = 0;
      let errors = 0;

      for (const audit of audits) {
        try {
          // Resolve industry for this audit
          const industryLock = await resolveIndustry(audit.root_url, env, {
            projectOverride: undefined,
            auditOverride: undefined,
            siteDescription: audit.site_description || undefined,
          });

          // Update the audit
          await env.DB.prepare(
            `UPDATE audits 
             SET industry = ?, 
                 industry_source = ?, 
                 industry_locked = 1 
             WHERE id = ?`
          ).bind(
            industryLock.industry,
            industryLock.source,
            audit.id
          ).run();

          const domain = new URL(audit.root_url).hostname;
          
          updates.push({
            id: audit.id,
            url: audit.root_url,
            domain,
            industry: industryLock.industry,
            source: industryLock.source,
          });

          processed++;
          
          console.log(
            `[BACKFILL] ${processed}/${audits.length} - ${audit.id}: ${domain} → ${industryLock.industry} (${industryLock.source})`
          );
        } catch (error: any) {
          errors++;
          console.error(`[BACKFILL ERROR] ${audit.id}:`, error.message);
        }
      }

      // Group by industry to show distribution
      const distribution: Record<string, number> = {};
      const bySource: Record<string, number> = {};
      
      updates.forEach(u => {
        distribution[u.industry] = (distribution[u.industry] || 0) + 1;
        bySource[u.source] = (bySource[u.source] || 0) + 1;
      });

      console.log('[BACKFILL] Complete!');
      console.log('[BACKFILL] Distribution:', distribution);
      console.log('[BACKFILL] By Source:', bySource);

      return new Response(
        JSON.stringify({
          success: true,
          processed,
          errors,
          total: audits.length,
          distribution,
          bySource,
          samples: updates.slice(0, 10), // First 10 for inspection
        }, null, 2),
        { 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          } 
        }
      );

    } catch (error: any) {
      console.error('[BACKFILL FATAL]', error);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
          stack: error.stack,
        }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
  },
};

