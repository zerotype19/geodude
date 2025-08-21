import { ensureAiSource } from '../lib/ai-sources';

export interface AISourceMapping {
  slug: string;
  name: string;
  category: 'crawler' | 'assistant' | 'unknown';
}

/**
 * Ensure AI source exists and update KV mapping
 * Creates source in database if missing, then updates sources:index KV
 */
export async function ensureAISourceWithMapping(
  env: any,
  slug: string,
  name: string,
  category: 'crawler' | 'assistant' | 'unknown' = 'unknown'
): Promise<number | null> {
  try {
    // Ensure source exists in database
    const sourceId = await ensureAiSource(env, slug, name, category);
    
    if (!sourceId) {
      console.error('Failed to ensure AI source:', { slug, name, category });
      return null;
    }

    // Update sources:index KV mapping
    await updateSourcesIndex(env, slug, sourceId, name, category);
    
    // Log metric for auto-created sources
    if (category === 'assistant') {
      await logAutoCreatedSource(env, slug);
    }
    
    return sourceId;
  } catch (error) {
    console.error('Error ensuring AI source with mapping:', error);
    return null;
  }
}

/**
 * Update sources:index KV with new AI source mapping
 */
async function updateSourcesIndex(
  env: any,
  slug: string,
  sourceId: number,
  name: string,
  category: string
): Promise<void> {
  try {
    // Get existing sources:index
    let sourcesIndex = await env.AI_FINGERPRINTS.get('sources:index', 'json') || {};
    
    // Add/update the mapping
    sourcesIndex[slug] = {
      id: sourceId,
      name,
      category,
      updated_at: new Date().toISOString()
    };
    
    // Store updated mapping
    await env.AI_FINGERPRINTS.put('sources:index', JSON.stringify(sourcesIndex), { expirationTtl: 0 });
    
    console.log('Updated sources:index KV for:', { slug, sourceId, name });
  } catch (error) {
    console.error('Failed to update sources:index KV:', error);
  }
}

/**
 * Log metric for auto-created AI sources
 */
async function logAutoCreatedSource(env: any, slug: string): Promise<void> {
  try {
    const key = `ai_source_autocreated_5m:${Math.floor(Date.now() / (5 * 60 * 1000))}`;
    const current = await env.CACHE.get(key) || '0';
    await env.CACHE.put(key, String(parseInt(current) + 1), { expirationTtl: 300 });
    
    console.log('Logged ai_source_autocreated_5m metric for:', slug);
  } catch (error) {
    console.error('Failed to log auto-created source metric:', error);
  }
}

/**
 * Get AI source ID from KV mapping (with fallback to database)
 */
export async function getAISourceIdFromKV(
  env: any,
  slug: string
): Promise<number | null> {
  try {
    // Try KV first
    const sourcesIndex = await env.AI_FINGERPRINTS.get('sources:index', 'json');
    if (sourcesIndex && sourcesIndex[slug]) {
      return sourcesIndex[slug].id;
    }
    
    // Fallback to database lookup
    const sourceId = await ensureAISourceWithMapping(env, slug, 'Unknown AI Source', 'unknown');
    return sourceId;
  } catch (error) {
    console.error('Error getting AI source ID from KV:', error);
    return null;
  }
}

/**
 * Pre-populate common AI sources in KV mapping
 */
export async function initializeCommonAISources(env: any): Promise<void> {
  const commonSources: AISourceMapping[] = [
    // Crawlers
    { slug: 'google', name: 'Google', category: 'crawler' },
    { slug: 'microsoft_bing', name: 'Microsoft/Bing', category: 'crawler' },
    { slug: 'duckduckgo', name: 'DuckDuckGo', category: 'crawler' },
    { slug: 'apple', name: 'Apple', category: 'crawler' },
    { slug: 'yandex', name: 'Yandex', category: 'crawler' },
    { slug: 'baidu', name: 'Baidu', category: 'crawler' },
    { slug: 'commoncrawl', name: 'CommonCrawl', category: 'crawler' },
    { slug: 'meta', name: 'Meta', category: 'crawler' },
    { slug: 'linkedin', name: 'LinkedIn', category: 'crawler' },
    { slug: 'slack', name: 'Slack', category: 'crawler' },
    { slug: 'twitter', name: 'Twitter', category: 'crawler' },
    { slug: 'discord', name: 'Discord', category: 'crawler' },
    { slug: 'whatsapp', name: 'WhatsApp', category: 'crawler' },
    { slug: 'telegram', name: 'Telegram', category: 'crawler' },
    { slug: 'openai', name: 'OpenAI', category: 'crawler' },
    { slug: 'anthropic', name: 'Anthropic', category: 'crawler' },
    
    // AI Assistants
    { slug: 'openai_chatgpt', name: 'OpenAI/ChatGPT', category: 'assistant' },
    { slug: 'anthropic_claude', name: 'Anthropic/Claude', category: 'assistant' },
    { slug: 'perplexity', name: 'Perplexity', category: 'assistant' },
    { slug: 'google_gemini', name: 'Google Gemini', category: 'assistant' },
    { slug: 'microsoft_copilot', name: 'Microsoft Copilot', category: 'assistant' },
    { slug: 'poe', name: 'Poe', category: 'assistant' },
    { slug: 'you', name: 'You.com', category: 'assistant' },
    { slug: 'arc', name: 'Arc', category: 'assistant' },
    { slug: 'phind', name: 'Phind', category: 'assistant' },
    { slug: 'metaphor', name: 'Metaphor', category: 'assistant' }
  ];
  
  for (const source of commonSources) {
    await ensureAISourceWithMapping(env, source.slug, source.name, source.category);
  }
  
  console.log('Initialized common AI sources in KV mapping');
}
