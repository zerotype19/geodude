/**
 * AI-Powered Industry Backfill Script
 * 
 * Classifies all audits with missing/weak industry data using the AI classifier
 * 
 * Usage:
 *   npx wrangler dev scripts/backfill-ai-industries.ts
 *   Then visit worker URL or curl it with ?confirm=yes
 */

interface Env {
  DB: D1Database;
  DOMAIN_RULES_KV: KVNamespace;
}

interface AuditRow {
  id: string;
  root_url: string;
  site_description: string | null;
  industry: string | null;
  industry_source: string | null;
}

/**
 * Update KV with new domain mapping
 */
async function putKVDomainRule(
  env: Env,
  domain: string,
  industry_key: string
): Promise<void> {
  try {
    const existing = await env.DOMAIN_RULES_KV.get('industry_packs_json', 'json') as any;
    const doc = existing || { industry_rules: { domains: {} }, packs: {} };
    
    doc.industry_rules = doc.industry_rules || {};
    doc.industry_rules.domains = doc.industry_rules.domains || {};
    doc.industry_rules.domains[domain] = industry_key;
    
    await env.DOMAIN_RULES_KV.put('industry_packs_json', JSON.stringify(doc));
    console.log(`[KV] Updated mapping: ${domain} → ${industry_key}`);
  } catch (error) {
    console.error(`[KV ERROR] Failed to update ${domain}:`, error);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Safety: require ?confirm=yes to run
    if (url.searchParams.get('confirm') !== 'yes') {
      return new Response(
        JSON.stringify({
          error: 'Backfill not confirmed',
          message: 'Add ?confirm=yes to run AI-powered backfill',
          info: 'This will classify all audits with missing/weak industry data',
        }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('[AI_BACKFILL] Starting industry backfill...');
    
    try {
      // Find candidates for classification
      const result = await env.DB.prepare(
        `SELECT id, root_url, site_description, industry, industry_source
         FROM audits 
         WHERE industry IS NULL 
            OR industry_source IS NULL
            OR industry = 'generic_consumer'
            OR industry_source IN ('fallback', 'backfill_default', 'default')
         ORDER BY started_at DESC
         LIMIT 100`
      ).all<AuditRow>();

      if (!result.success || !result.results) {
        throw new Error('Failed to fetch audits from D1');
      }

      const audits = result.results;
      console.log(`[AI_BACKFILL] Found ${audits.length} audits to classify`);

      if (audits.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'No audits need classification',
            classified: 0,
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Process each audit
      const classified: Array<{
        id: string;
        domain: string;
        industry: string;
        confidence: number;
      }> = [];

      let processed = 0;
      let errors = 0;
      let lowConfidence = 0;

      for (const audit of audits) {
        try {
          // Extract domain
          const domain = new URL(audit.root_url).hostname.toLowerCase().replace(/^www\./, '');

          // Call AI classifier (internal route)
          const payload = {
            domain,
            root_url: audit.root_url,
            site_description: audit.site_description || '',
            crawl_budget: { homepage: true, timeout_ms: 3000 },
          };

          // Make internal request to classifier
          const classifyReq = new Request(`https://dummy.com/industry/classify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          // Import and call classifier directly
          const { classifyIndustry } = await import('../src/lib/industry-classifier');
          const classifyResult = await classifyIndustry(payload);

          if (!classifyResult?.primary) {
            errors++;
            console.error(`[AI_BACKFILL ERROR] No result for ${domain}`);
            continue;
          }

          const { industry_key, confidence } = classifyResult.primary;

          // Apply lock policy
          if (confidence >= 0.80) {
            // High confidence - lock it
            await env.DB.prepare(
              `UPDATE audits 
               SET industry = ?, 
                   industry_source = 'ai_worker', 
                   industry_locked = 1 
               WHERE id = ?`
            ).bind(industry_key, audit.id).run();

            // Update KV mapping
            await putKVDomainRule(env, domain, industry_key);

            classified.push({
              id: audit.id,
              domain,
              industry: industry_key,
              confidence,
            });

            console.log(
              `[AI_BACKFILL] ✅ ${domain} → ${industry_key} (conf: ${confidence.toFixed(3)})`
            );
            processed++;
          } else {
            // Low confidence - store but don't lock
            await env.DB.prepare(
              `UPDATE audits 
               SET industry = ?, 
                   industry_source = 'ai_worker_low_conf', 
                   industry_locked = 0 
               WHERE id = ?`
            ).bind(industry_key, audit.id).run();

            lowConfidence++;
            console.log(
              `[AI_BACKFILL] ⚠️  ${domain} → ${industry_key} (conf: ${confidence.toFixed(3)}) - LOW CONFIDENCE`
            );
          }
        } catch (error: any) {
          errors++;
          console.error(`[AI_BACKFILL ERROR] ${audit.id}:`, error.message);
        }
      }

      // Group by industry
      const distribution: Record<string, number> = {};
      classified.forEach((c) => {
        distribution[c.industry] = (distribution[c.industry] || 0) + 1;
      });

      console.log('[AI_BACKFILL] Complete!');
      console.log('[AI_BACKFILL] Distribution:', distribution);

      return new Response(
        JSON.stringify({
          success: true,
          processed,
          lowConfidence,
          errors,
          total: audits.length,
          distribution,
          samples: classified.slice(0, 10), // First 10 for inspection
        }, null, 2),
        { 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          } 
        }
      );

    } catch (error: any) {
      console.error('[AI_BACKFILL FATAL]', error);
      
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

