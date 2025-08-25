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
        const { classifyTrafficV3, STATIC_MANIFEST_V3 } = await import('../ai-lite/classifier-v3.js');
        
        // Get current host for classification (use a default if not available)
        const currentHost = 'optiview.ai'; // Default host for classification
        
        // Re-run the classifier with stored inputs
        const classification = classifyTrafficV3({
          cfVerifiedBotCategory: undefined, // No CF data in stored event
          referrerUrl: row.referrer,
          userAgent: row.user_agent,
          currentHost,
          utmSource: undefined, // Extract from URL if needed
          aiRef: undefined,
          manifest: STATIC_MANIFEST_V3
        });

        // Get current stored classification for comparison
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
          reclassified: {
            class: classification.class,
            aiSourceSlug: classification.aiSourceSlug,
            botCategory: classification.evidence.botCategory,
            reason: classification.reason,
            matchedRule: classification.debug.matchedRule,
            signals: classification.debug.signals
          },
          current_classification: currentClassification,
          note: "Reclassification completed - compare reclassified vs current"
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
          // Check if this is actually a known bot pattern using the new strict logic
          const isKnownBot = (() => {
            if (!row.user_agent) return 'other';
            
            const ua = row.user_agent.toLowerCase();
            
            // Only match known bot patterns, never generic browser UAs
            const knownBotPatterns = [
              'gptbot', 'ccbot', 'google-extended', 'claudebot', 'perplexitybot',
              'googlebot', 'bingbot', 'duckduckbot', 'applebot',
              'slack', 'discord', 'twitter', 'linkedin',
              'uptimerobot', 'pingdom'
            ];
            
            // Check if UA contains any known bot pattern
            const hasBotPattern = knownBotPatterns.some(pattern => ua.includes(pattern));
            
            // CRITICAL: Never classify browser UAs as bots
            const browserTerms = ['chrome', 'safari', 'firefox', 'edge', 'webkit', 'applewebkit', 'mozilla'];
            const isBrowser = browserTerms.some(term => ua.includes(term));
            
            if (isBrowser) return 'other'; // Never a bot
            if (hasBotPattern) return 'bot'; // Known bot pattern
            return 'other'; // Unknown, not a bot
          })();
          
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
              reason: 'Not a known bot pattern (browser UA or unknown)'
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

    // Quick schema check endpoint
    if (pathname === '/admin/debug/schema' && request.method === 'GET') {
      if (!checkAdminAuth(request)) {
        return new Response(JSON.stringify({ error: 'Admin authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        // Check session table schema
        const sessionSchema = await env.OPTIVIEW_DB.prepare(`
          PRAGMA table_info(session)
        `).all();

        // Check if session_context table exists
        const sessionContextExists = await env.OPTIVIEW_DB.prepare(`
          SELECT name FROM sqlite_master WHERE type='table' AND name='session_context'
        `).first();

        return new Response(JSON.stringify({
          session_table: sessionSchema.results || [],
          session_context_table: sessionContextExists ? 'exists' : 'not_found',
          timestamp: new Date().toISOString()
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('Schema check failed:', error);
        return new Response(JSON.stringify({
          error: 'Schema check failed',
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
      
      // Allow CF field injection for testing
      const cfVerified = urlParams.get('cf_verified') === '1';
      const cfCategory = urlParams.get('cf_category');
      const cfAsn = urlParams.get('cf_asn');
      const cfOrg = urlParams.get('cf_org');

      // Note: referrer is optional - some tests (like crawler detection) only use User-Agent

      try {
        // Import classifier v3
        const { classifyTrafficV3, STATIC_MANIFEST_V3 } = await import('../ai-lite/classifier-v3');

        const classification = classifyTrafficV3({
          cfVerifiedBotCategory: cfCategory,
          cfVerified: cfVerified,
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
          cf_injected: {
            verified: cfVerified,
            category: cfCategory,
            asn: cfAsn,
            org: cfOrg
          },
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

    // CF Signals Health Endpoint
    if (pathname === '/admin/health/cf-signals' && request.method === 'GET') {
      if (!checkAdminAuth(request)) {
        return new Response(JSON.stringify({ error: 'Admin authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { searchParams } = url;
      let window = searchParams.get('window') || '60m';
      
      // Parse window parameter (accept m, h, d)
      const windowMatch = window.match(/^(\d+)([mhd])$/);
      if (!windowMatch) {
        return new Response(JSON.stringify({ error: 'Invalid window format. Use: 15m, 60m, 2h, 1d' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const amount = parseInt(windowMatch[1]);
      const unit = windowMatch[2];
      
      // Convert to minutes for SQL
      let minutesAgo: number;
      switch (unit) {
        case 'm': minutesAgo = amount; break;
        case 'h': minutesAgo = amount * 60; break;
        case 'd': minutesAgo = amount * 60 * 24; break;
        default: minutesAgo = 60; // fallback to 60m
      }

      try {
        const cutoffTime = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
        
        // Get total requests in window
        const totalResult = await env.OPTIVIEW_DB.prepare(`
          SELECT COUNT(*) as total FROM interaction_events 
          WHERE occurred_at >= ?
        `).bind(cutoffTime).first();
        
        const totalRequests = totalResult?.total || 0;

        // Get requests with any CF fields
        const cfFieldsResult = await env.OPTIVIEW_DB.prepare(`
          SELECT COUNT(*) as count FROM interaction_events 
          WHERE occurred_at >= ? AND (
            cf_verified_bot IS NOT NULL OR 
            cf_verified_bot_category IS NOT NULL OR 
            cf_asn IS NOT NULL OR 
            cf_org IS NOT NULL
          )
        `).bind(cutoffTime).first();
        
        const withAnyCfFields = cfFieldsResult?.count || 0;

        // Get verified bot count
        const verifiedResult = await env.OPTIVIEW_DB.prepare(`
          SELECT COUNT(*) as count FROM interaction_events 
          WHERE occurred_at >= ? AND cf_verified_bot = 1
        `).bind(cutoffTime).first();
        
        const verifiedBots = verifiedResult?.count || 0;

        // Get category breakdown
        const categoriesResult = await env.OPTIVIEW_DB.prepare(`
          SELECT cf_verified_bot_category as raw, COUNT(*) as count
          FROM interaction_events 
          WHERE occurred_at >= ? AND cf_verified_bot = 1 AND cf_verified_bot_category IS NOT NULL
          GROUP BY cf_verified_bot_category
          ORDER BY count DESC
        `).bind(cutoffTime).all();
        
        const categories = categoriesResult?.results?.map(row => ({
          raw: row.raw,
          count: row.count
        })) || [];

        // Get sample records
        const samplesResult = await env.OPTIVIEW_DB.prepare(`
          SELECT cf_verified_bot, cf_verified_bot_category as rawCategory, cf_asn, cf_org
          FROM interaction_events 
          WHERE occurred_at >= ? AND (
            cf_verified_bot IS NOT NULL OR 
            cf_verified_bot_category IS NOT NULL OR 
            cf_asn IS NOT NULL OR 
            cf_org IS NOT NULL
          )
          ORDER BY occurred_at DESC
          LIMIT 3
        `).bind(cutoffTime).all();
        
        const samples = samplesResult?.results?.map(row => ({
          verified: !!row.cf_verified_bot,
          rawCategory: row.rawCategory,
          asn: row.cf_asn,
          org: row.cf_org
        })) || [];

        // Get verified bot samples
        const verifiedSamplesResult = await env.OPTIVIEW_DB.prepare(`
          SELECT cf_verified_bot_category as rawCategory, cf_asn, cf_org
          FROM interaction_events 
          WHERE occurred_at >= ? AND cf_verified_bot = 1
          ORDER BY occurred_at DESC
          LIMIT 3
        `).bind(cutoffTime).all();
        
        const verifiedSamples = verifiedSamplesResult?.results?.map(row => ({
          verified: true,
          rawCategory: row.rawCategory,
          asn: row.cf_asn,
          org: row.cf_org
        })) || [];

        return new Response(JSON.stringify({
          window: window,
          totals: {
            totalRequests,
            withAnyCfFields,
            pctWithCfFields: totalRequests > 0 ? Math.round((withAnyCfFields / totalRequests) * 1000) / 10 : 0
          },
          verified: {
            count: verifiedBots,
            pctOfTotal: totalRequests > 0 ? Math.round((verifiedBots / totalRequests) * 1000) / 10 : 0
          },
          categories,
          samples: {
            any: samples,
            verified: verifiedSamples
          }
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('CF signals health check failed:', error);
        return new Response(JSON.stringify({
          error: 'CF signals health check failed',
          details: error.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Admin Ingest Test Harness - for testing CF signal persistence
    if (pathname === '/admin/tools/ingest-test-event' && request.method === 'POST') {
      if (!checkAdminAuth(request)) {
        return new Response(JSON.stringify({ error: 'Admin authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        const body = await request.json();
        const { url, referrer, ua, cf_verified, cf_category, cf_asn, cf_org, params } = body;

        if (!url) {
          return new Response(JSON.stringify({ error: 'Missing required field: url' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Extract and normalize Cloudflare signals
        const { extractCfSignals, generateCfDebugSignals } = await import('../classifier/cf');
        
        // Create a mock request with CF fields for testing
        const mockRequest = {
          cf: {
            bot_management: { verified_bot: cf_verified || false },
            verifiedBotCategory: cf_category || null,
            asn: cf_asn || null,
            asOrganization: cf_org || null
          }
        } as any;

        const cfSignals = extractCfSignals(mockRequest);
        
        // Check for spoof guard
        let spoofReason = null;
        if (referrer && params?.utm_source) {
          try {
            const referrerHost = new URL(referrer).hostname.toLowerCase();
            if (referrerHost === 'google.com' || referrerHost === 'bing.com' || referrerHost === 'duckduckgo.com') {
              spoofReason = 'search_referrer';
            } else if (referrerHost.includes('chat.openai.com') || referrerHost.includes('perplexity.ai') || referrerHost.includes('gemini.google.com')) {
              spoofReason = 'ai_assistant_referrer';
            }
          } catch (e) {
            // Invalid referrer URL, ignore
          }
        }

        // Classify traffic
        const { classifyTrafficV3, STATIC_MANIFEST_V3 } = await import('../ai-lite/classifier-v3');
        const classification = classifyTrafficV3({
          cfVerifiedBotCategory: cfSignals.cfCategoryRaw,
          cfVerified: cfSignals.cfVerified,
          referrerUrl: referrer || null,
          userAgent: ua || 'Mozilla/5.0 (Test)',
          currentHost: 'test.example.com',
          utmSource: spoofReason ? null : params?.utm_source,
          manifest: STATIC_MANIFEST_V3
        });

        // Generate signals
        const cfDebugSignals = generateCfDebugSignals(cfSignals);
        if (spoofReason) {
          cfDebugSignals.push(`params_spoof_guard=${spoofReason}`);
        }
        const allSignals = [...(classification.debug?.signals || []), ...cfDebugSignals];

        // Insert into database
        const result = await env.OPTIVIEW_DB.prepare(`
          INSERT INTO interaction_events (
            project_id, property_id, content_id, ai_source_id, 
            event_type, metadata, occurred_at, sampled, class, bot_category,
            cf_verified_bot, cf_verified_bot_category, cf_asn, cf_org,
            ppc_request_headers, ppc_response_headers, signals
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          'prj_cTSh3LZ8qMVZ', // test project_id
          1, // test property_id
          null, // content_id
          null, // ai_source_id
          'view', // event_type
          JSON.stringify({
            url,
            referrer,
            user_agent: ua,
            params,
            test_event: true,
            timestamp: new Date().toISOString()
          }),
          new Date().toISOString(), // occurred_at
          0, // sampled
          classification.class, // class
          classification.evidence?.botCategory || null, // bot_category
          cfSignals.cfVerified ? 1 : 0, // cf_verified_bot
          cfSignals.cfCategoryRaw, // cf_verified_bot_category
          cfSignals.cfASN, // cf_asn
          cfSignals.cfOrg, // cf_org
          null, // ppc_request_headers
          null, // ppc_response_headers
          allSignals.length > 0 ? JSON.stringify(allSignals) : null // signals
        ).run();

        return new Response(JSON.stringify({
          id: result.meta?.last_row_id,
          cf_signals: cfSignals,
          classification,
          spoof_reason: spoofReason,
          signals_generated: allSignals,
          message: 'Test event ingested successfully'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('Test event ingestion failed:', error);
        return new Response(JSON.stringify({
          error: 'Test event ingestion failed',
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
