import { normalizeCfCategory } from '../classifier/botCategoryMap';
import { upsertRollup } from '../ai-lite/rollups';

/**
 * Get bot category from user agent as fallback
 */
function getBotCategoryFromUA(userAgent: string): string {
  const ua = userAgent.toLowerCase();

  // AI training bots
  if (ua.includes('gptbot') || ua.includes('ccbot') || ua.includes('google-extended')) {
    return 'ai_training';
  }

  // Search crawlers
  if (ua.includes('googlebot') || ua.includes('bingbot') || ua.includes('duckduckbot')) {
    return 'search_crawler';
  }

  // Preview bots
  if (ua.includes('slack') || ua.includes('discord') || ua.includes('twitter') || ua.includes('linkedin')) {
    return 'preview_bot';
  }

  // Uptime monitors
  if (ua.includes('uptimerobot') || ua.includes('pingdom')) {
    return 'uptime_monitor';
  }

  return 'other';
}

/**
 * Main admin routes handler
 */
export async function handleAdminRoutes(
  request: Request,
  env: any,
  url: URL,
  origin: string | null
): Promise<Response | null> {
  const pathname = url.pathname;

  try {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Rate limiting helper
    const checkRateLimit = async (key: string, limit: number): Promise<boolean> => {
      const currentCount = await env.CACHE.get(key);
      if (currentCount && parseInt(currentCount) >= limit) {
        return false;
      }
      await env.CACHE.put(key, (parseInt(currentCount || '0') + 1).toString(), { expirationTtl: 60 });
      return true;
    };

    // Admin auth helper
    const checkAdminAuth = (request: Request): boolean => {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return false;
      }
      const token = authHeader.substring(7);
      return token === env.ADMIN_TOKEN;
    };

    // Debug reclassify endpoint - re-run classifier using stored inputs
    if (pathname === '/admin/debug/reclassify' && request.method === 'GET') {
      if (!checkAdminAuth(request)) {
        return new Response(JSON.stringify({ error: 'Admin authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { searchParams } = url;
      const id = searchParams.get('id');
      if (!id) {
        return new Response(JSON.stringify({ error: 'missing id' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        // Get the event with stored inputs
        const row = await env.OPTIVIEW_DB.prepare(`
          SELECT id, 
                 json_extract(metadata, '$.url') as url,
                 json_extract(metadata, '$.referrer') as referrer,
                 json_extract(metadata, '$.user_agent') as user_agent,
                 metadata
          FROM interaction_events WHERE id = ?
        `).bind(id).first<any>();

        if (!row) {
          return new Response(JSON.stringify({ error: 'not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Parse metadata for headers if available
        let headers = {};
        try {
          if (row.metadata) {
            const metadata = JSON.parse(row.metadata);
            headers = metadata.headers || {};
          }
        } catch (e) {
          console.warn('Failed to parse metadata headers:', e);
        }

        // Re-run classification using stored inputs
        // Note: This would call the actual classifier function
        // For now, return the inputs and current classification for debugging
        const currentClassification = await env.OPTIVIEW_DB.prepare(`
          SELECT class, bot_category, json_extract(metadata, '$.classification_reason') as matched_rule
          FROM interaction_events WHERE id = ?
        `).bind(id).first<any>();

        return new Response(JSON.stringify({
          id: parseInt(id),
          inputs: {
            url: row.url,
            referrer: row.referrer,
            user_agent: row.user_agent,
            headers
          },
          current_classification: currentClassification,
          note: "Classifier function call would go here - this shows current stored classification"
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e: any) {
        console.error("debug_reclassify_error", { error: e.message, stack: e.stack });
        return new Response(JSON.stringify({
          error: "Internal server error",
          message: e.message
        }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Backfill bot categories endpoint
    if (pathname === '/admin/backfill-bot-categories' && request.method === 'POST') {
      const clientIP = request.headers.get('cf-connecting-ip') || 'unknown';
      const rateLimitKey = `rate_limit:backfill_bot_categories:${clientIP}`;

      if (!(await checkRateLimit(rateLimitKey, 5))) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!checkAdminAuth(request)) {
        return new Response(JSON.stringify({ error: 'Admin authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { days = 30, batch = 500 } = await request.json();
      const hours = days * 24;

      try {
        const db = env.OPTIVIEW_DB;

        // Get events that need bot category backfilling
        const eventsToUpdate = await db.prepare(`
          SELECT id, project_id, metadata
          FROM interaction_events 
          WHERE class = 'crawler' 
            AND (metadata->>'bot_category' IS NULL OR metadata->>'bot_category' = '')
            AND occurred_at >= datetime('now', '-${hours} hours')
          LIMIT ?
        `).bind(batch).all();

        if (!eventsToUpdate.results || eventsToUpdate.results.length === 0) {
          return new Response(JSON.stringify({
            message: 'No events need bot category backfilling',
            count: 0
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        let updatedCount = 0;
        const unknownCategories = new Set<string>();

        for (const event of eventsToUpdate.results) {
          const metadata = JSON.parse(event.metadata || '{}');
          const userAgent = metadata.user_agent || metadata.ua;

          // Try to get bot category from stored cf_verified_category first
          let botCategory = null;
          if (metadata.cf_verified_category) {
            botCategory = normalizeCfCategory(metadata.cf_verified_category);
          } else if (userAgent) {
            // Fallback to UA pattern matching
            botCategory = getBotCategoryFromUA(userAgent);
          }

          if (botCategory && botCategory !== 'other') {
            // Update the event with bot category
            metadata.bot_category = botCategory;

            await db.prepare(`
              UPDATE interaction_events 
              SET metadata = ? 
              WHERE id = ?
            `).bind(JSON.stringify(metadata), event.id).run();

            updatedCount++;
          } else if (metadata.cf_verified_category) {
            // Log unknown Cloudflare category for review
            unknownCategories.add(metadata.cf_verified_category);

            // Log sample request for investigation
            await env.CACHE.put(
              `cfbot:unknown_cats:${metadata.cf_verified_category}`,
              JSON.stringify({
                timestamp: new Date().toISOString(),
                project_id: event.project_id,
                ua_hash: userAgent ? btoa(userAgent).substring(0, 16) : 'no_ua',
                category: metadata.cf_verified_category
              }),
              { expirationTtl: 7 * 24 * 3600 } // 7 days
            );
          }
        }

        return new Response(JSON.stringify({
          message: 'Bot category backfill completed',
          updated: updatedCount,
          total: eventsToUpdate.results.length,
          unknown_categories: Array.from(unknownCategories)
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('Bot category backfill failed:', error);
        return new Response(JSON.stringify({
          error: 'Backfill failed',
          details: error.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Historic data reclassification endpoint
    if (pathname === '/admin/reclassify-historic-data' && request.method === 'POST') {
      try {
        // Check authentication
        if (!checkAdminAuth(request)) {
          return new Response(JSON.stringify({ error: "Admin access required" }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        console.log('🔄 Starting historic data reclassification...');

        // Import the reclassification functions
        const { reclassifyHistoricData, verifyReclassification } = await import('../scripts/reclassify-historic-data.js');

        // Run the reclassification
        const result = await reclassifyHistoricData(env.OPTIVIEW_DB);

        // Verify the results
        await verifyReclassification(env.OPTIVIEW_DB);

        return new Response(JSON.stringify({
          success: true,
          message: 'Historic data reclassification completed',
          result
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('Historic data reclassification failed:', error);
        return new Response(JSON.stringify({
          error: "Reclassification failed",
          message: error.message
        }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Reclassify false bot classifications endpoint
    if (pathname === '/admin/tools/reclassify-false-bots' && request.method === 'POST') {
      if (!checkAdminAuth(request)) {
        return new Response(JSON.stringify({ error: 'Admin authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        const BATCH = 1000;
        
        // Get events that are classified as crawler + ai_training but shouldn't be
        const rows = await env.OPTIVIEW_DB.prepare(`
          SELECT id, 
                 json_extract(metadata, '$.referrer') as referrer,
                 json_extract(metadata, '$.user_agent') as user_agent
          FROM interaction_events
          WHERE class = 'crawler'
            AND bot_category = 'ai_training'
            AND (json_extract(metadata, '$.cf_verified_category') IS NULL 
                 OR json_extract(metadata, '$.cf_verified_category') = '')
          LIMIT ?
        `).bind(BATCH).all<any>();

        let fixed = 0;
        const results = [];

        for (const row of rows.results || []) {
          // Check if this is actually a known bot pattern
          const isKnownBot = getBotCategoryFromUA(row.user_agent);
          
          if (isKnownBot === 'other') {
            // Derive fallback class by referrer
            const referrer = row.referrer || '';
            const host = referrer ? new URL(referrer).hostname : null;
            const isSearchHost = host && (host.includes('google.com') || host.includes('bing.com'));
            const newClass = isSearchHost ? 'search' : 'direct_human';
            
            await env.OPTIVIEW_DB.prepare(`
              UPDATE interaction_events
              SET class = ?, bot_category = NULL, 
                  metadata = json_set(metadata, '$.classification_reason', 'admin.backfill.false-bot')
              WHERE id = ?
            `).bind(newClass, row.id).run();
            
            fixed++;
            results.push({
              id: row.id,
              old_class: 'crawler',
              old_bot_category: 'ai_training',
              new_class: newClass,
              reason: 'Not a known bot pattern'
            });
          }
        }

        return new Response(JSON.stringify({
          scanned: (rows.results || []).length,
          fixed,
          results: results.slice(0, 10) // Show first 10 for verification
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e: any) {
        console.error("reclassify_false_bots_error", { error: e.message, stack: e.stack });
        return new Response(JSON.stringify({
          error: "Internal server error",
          message: e.message
        }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // List unknown Cloudflare categories endpoint
    if (pathname === '/admin/cf-cats' && request.method === 'GET') {
      if (!checkAdminAuth(request)) {
        return new Response(JSON.stringify({ error: 'Admin authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        // Get known categories from our mapping
        const knownCategories = [
          'Search Engine Crawler',
          'Page Preview',
          'Monitoring & Analytics',
          'AI Crawler',
          'AI Assistant',
          'Search Engine Optimization',
          'Archiver',
          'Security',
          'Advertising & Marketing',
          'Accessibility',
          'Academic Research'
        ];

        // Get unknown categories from KV
        const unknownCategories: string[] = [];
        const listResult = await env.CACHE.list({ prefix: 'cfbot:unknown_cats:' });

        for (const key of listResult.keys) {
          const category = key.name.replace('cfbot:unknown_cats:', '');
          if (!knownCategories.includes(category)) {
            unknownCategories.push(category);
          }
        }

        return new Response(JSON.stringify({
          known_categories: knownCategories,
          unknown_categories: unknownCategories
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('Failed to list CF categories:', error);
        return new Response(JSON.stringify({
          error: 'Failed to list categories'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Rebuild rollups endpoint
    if (pathname === '/admin/rebuild-rollups' && request.method === 'POST') {
      if (!checkAdminAuth(request)) {
        return new Response(JSON.stringify({ error: 'Admin authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { scope, days = 30 } = await request.json();

      if (scope !== 'crawler_categories') {
        return new Response(JSON.stringify({
          error: 'Only crawler_categories scope supported'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        const db = env.OPTIVIEW_DB;
        const hours = days * 24;

        // Delete existing crawler rollups for the period
        await db.prepare(`
          DELETE FROM traffic_rollup_hourly 
          WHERE class = 'crawler' 
            AND ts_hour >= strftime('%s', 'now', '-${hours} hours')
        `).run();

        // Get crawler events with bot categories and rebuild rollups
        const crawlerEvents = await db.prepare(`
          SELECT project_id, property_id, occurred_at, metadata
          FROM interaction_events 
          WHERE class = 'crawler' 
            AND metadata->>'bot_category' IS NOT NULL
            AND occurred_at >= datetime('now', '-${hours} hours')
        `).all();

        let rollupCount = 0;
        for (const event of crawlerEvents.results) {
          const metadata = JSON.parse(event.metadata || '{}');
          const botCategory = metadata.bot_category;

          if (botCategory) {
            await upsertRollup(
              db,
              event.project_id,
              event.property_id || 1,
              new Date(event.occurred_at),
              'crawler',
              false,
              botCategory
            );
            rollupCount++;
          }
        }

        return new Response(JSON.stringify({
          message: 'Rollups rebuilt successfully',
          scope,
          rollups_created: rollupCount,
          period_hours: hours
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('Rollup rebuild failed:', error);
        return new Response(JSON.stringify({
          error: 'Rollup rebuild failed',
          details: error.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Debug classification endpoint
    if (pathname === '/admin/debug/classify' && request.method === 'GET') {
      if (!checkAdminAuth(request)) {
        return new Response(JSON.stringify({ error: 'Admin authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const urlParams = new URLSearchParams(url.search);
      const referrer = urlParams.get('referrer');
      const userAgent = urlParams.get('ua') || 'Mozilla/5.0 (Test)';
      const utmSource = urlParams.get('utm_source');
      const aiRef = urlParams.get('ai_ref');

      // Note: referrer is optional - some tests (like crawler detection) only use User-Agent

      try {
        // Import classifier v3
        const { classifyTrafficV3, STATIC_MANIFEST_V3 } = await import('../ai-lite/classifier-v3.js');

        const classification = classifyTrafficV3({
          referrerUrl: referrer || null,
          userAgent,
          currentHost: 'test.example.com',
          utmSource,
          aiRef,
          manifest: STATIC_MANIFEST_V3
        });

        return new Response(JSON.stringify({
          referrer,
          user_agent: userAgent,
          classification
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('Debug classification failed:', error);
        return new Response(JSON.stringify({
          error: 'Classification failed',
          details: error.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // No matching admin route
    return null;

  } catch (error) {
    console.error('Admin routes error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
