import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { normalizeCfCategory } from '../classifier/botCategoryMap';
import { upsertRollup } from '../ai-lite/rollups';

const app = new Hono();

// CORS middleware
app.use('*', cors({
  origin: ['*'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

/**
 * Backfill bot categories for existing crawler events
 */
app.post('/admin/backfill-bot-categories', async (c) => {
  // Rate limiting: 5 rpm per IP + admin auth
  const clientIP = c.req.header('cf-connecting-ip') || 'unknown';
  const rateLimitKey = `rate_limit:backfill_bot_categories:${clientIP}`;
  
  const currentCount = await c.env.KV.get(rateLimitKey);
  if (currentCount && parseInt(currentCount) >= 5) {
    return c.json({ error: 'Rate limit exceeded. Try again later.' }, 429);
  }
  
  // Increment rate limit counter
  await c.env.KV.put(rateLimitKey, (parseInt(currentCount || '0') + 1).toString(), { expirationTtl: 60 });
  
  // Admin auth check
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Admin authentication required' }, 401);
  }
  
  const token = authHeader.substring(7);
  if (token !== c.env.ADMIN_TOKEN) {
    return c.json({ error: 'Invalid admin token' }, 401);
  }
  
  const { days = 30, batch = 500 } = await c.req.json();
  const hours = days * 24;
  
  try {
    const db = c.env.DB;
    
    // Get events that need bot category backfilling
    const eventsToUpdate = await db.prepare(`
      SELECT id, project_id, user_agent, metadata
      FROM interaction_events 
      WHERE class = 'crawler' 
        AND (metadata->>'bot_category' IS NULL OR metadata->>'bot_category' = '')
        AND created_at >= datetime('now', '-${hours} hours')
      LIMIT ?
    `).bind(batch).all();
    
    if (!eventsToUpdate.results || eventsToUpdate.results.length === 0) {
      return c.json({ message: 'No events need bot category backfilling', count: 0 });
    }
    
    let updatedCount = 0;
    const unknownCategories = new Set<string>();
    
    for (const event of eventsToUpdate.results) {
      const metadata = JSON.parse(event.metadata || '{}');
      const userAgent = event.user_agent;
      
      // Try to get bot category from stored cf_verified_category first
      let botCategory = null;
      if (metadata.cf_verified_category) {
        botCategory = normalizeCfCategory(metadata.cf_verified_category);
      } else if (userAgent) {
        // Fallback to UA pattern matching - implement this function
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
        await c.env.KV.put(
          `cfbot:unknown_cats:${metadata.cf_verified_category}`,
          JSON.stringify({
            timestamp: new Date().toISOString(),
            project_id: event.project_id,
            ua_hash: userAgent ? btoa(userAgent).substring(0, 16) : 'no_ua',
            category: metadata.cf_verified_category
          }),
          { expirationTtl: 86400 * 7 } // 7 days
        );
      }
    }
    
    return c.json({
      message: 'Bot category backfill completed',
      updated: updatedCount,
      total_processed: eventsToUpdate.results.length,
      unknown_categories: Array.from(unknownCategories)
    });
    
  } catch (error) {
    console.error('Bot category backfill failed:', error);
    return c.json({ error: 'Backfill failed', details: error.message }, 500);
  }
});

/**
 * List seen Cloudflare bot categories
 */
app.get('/admin/cf-cats', async (c) => {
  // Admin auth check
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Admin authentication required' }, 401);
  }
  
  const token = authHeader.substring(7);
  if (token !== c.env.ADMIN_TOKEN) {
    return c.json({ error: 'Invalid admin token' }, 401);
  }
  
  try {
    // Get all unknown categories
    const unknownCategories = await c.env.KV.list({ prefix: 'cfbot:unknown_cats:' });
    
    const categoryDetails = [];
    for (const key of unknownCategories.keys) {
      const details = await c.env.KV.get(key.name);
      if (details) {
        categoryDetails.push(JSON.parse(details));
      }
    }
    
    // Get category mapping
    const { CF_CATEGORY_MAP } = await import('../classifier/botCategoryMap');
    
    return c.json({
      known_categories: CF_CATEGORY_MAP,
      unknown_categories: categoryDetails,
      total_unknown: categoryDetails.length
    });
    
  } catch (error) {
    console.error('Failed to get CF categories:', error);
    return c.json({ error: 'Failed to get categories' }, 500);
  }
});

/**
 * Rebuild rollups with bot categories
 */
app.post('/admin/rebuild-rollups', async (c) => {
  // Admin auth check
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Admin authentication required' }, 401);
  }
  
  const token = authHeader.substring(7);
  if (token !== c.env.ADMIN_TOKEN) {
    return c.json({ error: 'Invalid admin token' }, 401);
  }
  
  const { scope = 'crawler_categories', days = 30 } = await c.req.json();
  
  if (scope !== 'crawler_categories') {
    return c.json({ error: 'Only crawler_categories scope is supported' }, 400);
  }
  
  try {
    const db = c.env.DB;
    const hours = days * 24;
    
    // Get crawler events with bot categories
    const crawlerEvents = await db.prepare(`
      SELECT project_id, property_id, created_at, metadata
      FROM interaction_events 
      WHERE class = 'crawler' 
        AND metadata->>'bot_category' IS NOT NULL
        AND metadata->>'bot_category' != ''
        AND created_at >= datetime('now', '-${hours} hours')
    `).all();
    
    if (!crawlerEvents.results || crawlerEvents.results.length === 0) {
      return c.json({ message: 'No crawler events with bot categories found', count: 0 });
    }
    
    // Clear existing rollups for the time period
    await db.prepare(`
      DELETE FROM traffic_rollup_hourly 
      WHERE class = 'crawler' 
        AND ts_hour >= strftime('%s', datetime('now', '-${hours} hours')) / 3600
    `).run();
    
    // Rebuild rollups
    let processedCount = 0;
    for (const event of crawlerEvents.results) {
      const metadata = JSON.parse(event.metadata || '{}');
      const botCategory = metadata.bot_category;
      
      if (botCategory) {
        await upsertRollup(
          db,
          event.project_id,
          event.property_id,
          new Date(event.created_at),
          'crawler',
          false, // Not sampled
          botCategory
        );
        processedCount++;
      }
    }
    
    return c.json({
      message: 'Rollup rebuild completed',
      processed: processedCount,
      total_events: crawlerEvents.results.length
    });
    
  } catch (error) {
    console.error('Rollup rebuild failed:', error);
    return c.json({ error: 'Rebuild failed', details: error.message }, 500);
  }
});

/**
 * Helper function to get bot category from user agent
 */
function getBotCategoryFromUA(userAgent: string): string | null {
  const ua = userAgent.toLowerCase();
  
  // Search crawlers
  if (ua.includes('googlebot') || ua.includes('bingbot') || ua.includes('duckduckbot') || ua.includes('applebot')) {
    return 'search_crawler';
  }
  
  // AI training
  if (ua.includes('gptbot') || ua.includes('ccbot') || ua.includes('google-extended') || ua.includes('perplexitybot')) {
    return 'ai_training';
  }
  
  // Preview bots
  if (ua.includes('facebookexternalhit') || ua.includes('twitterbot') || ua.includes('slackbot') || 
      ua.includes('linkedinbot') || ua.includes('discordbot') || ua.includes('whatsapp') || ua.includes('telegrambot')) {
    return 'preview_bot';
  }
  
  // Uptime monitors
  if (ua.includes('uptimerobot') || ua.includes('pingdom')) {
    return 'uptime_monitor';
  }
  
  // SEO tools
  if (ua.includes('semrushbot') || ua.includes('ahrefsbot')) {
    return 'seo_tool';
  }
  
  // Archivers
  if (ua.includes('ia_archiver') || ua.includes('archive.org')) {
    return 'archiver';
  }
  
  // Security
  if (ua.includes('security') || ua.includes('scanner')) {
    return 'security';
  }
  
  // Marketing
  if (ua.includes('adsbot') || ua.includes('mediapartners')) {
    return 'marketing';
  }
  
  // Accessibility
  if (ua.includes('accessibility') || ua.includes('a11y')) {
    return 'accessibility';
  }
  
  // Research
  if (ua.includes('research') || ua.includes('academic')) {
    return 'research';
  }
  
  return null;
}

export default app;
