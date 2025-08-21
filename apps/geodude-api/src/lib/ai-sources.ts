export interface AISource {
  id: number;
  slug: string;
  name: string;
  category: 'crawler' | 'assistant' | 'unknown';
  created_at: string;
}

/**
 * Ensure an AI source exists in the database, creating it if necessary
 * Returns the AI source ID for use in interaction_events
 */
export async function ensureAiSource(
  env: any, 
  slug: string, 
  name: string, 
  category: 'crawler' | 'assistant' | 'unknown' = 'unknown'
): Promise<number | null> {
  try {
    // First try to find existing source
    const existing = await env.OPTIVIEW_DB.prepare(`
      SELECT id, slug, name, category FROM ai_sources 
      WHERE slug = ? AND is_active = 1
    `).bind(slug).first();

    if (existing) {
      // Update name and category if they've changed
      if (existing.name !== name || existing.category !== category) {
        await env.OPTIVIEW_DB.prepare(`
          UPDATE ai_sources 
          SET name = ?, category = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(name, category, existing.id).run();
      }
      return existing.id;
    }

    // Create new source if it doesn't exist
    const result = await env.OPTIVIEW_DB.prepare(`
      INSERT INTO ai_sources (slug, name, category, created_at, is_active)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, 1)
    `).bind(slug, name, category).run();

    return result.meta?.last_row_id || null;
  } catch (error) {
    console.error('Error ensuring AI source:', error);
    return null;
  }
}

/**
 * Get AI source by slug
 */
export async function getAiSource(env: any, slug: string): Promise<AISource | null> {
  try {
    const result = await env.OPTIVIEW_DB.prepare(`
      SELECT id, slug, name, category, created_at
      FROM ai_sources 
      WHERE slug = ? AND is_active = 1
    `).bind(slug).first();

    return result || null;
  } catch (error) {
    console.error('Error getting AI source:', error);
    return null;
  }
}

/**
 * Get all active AI sources
 */
export async function getAllAiSources(env: any): Promise<AISource[]> {
  try {
    const result = await env.OPTIVIEW_DB.prepare(`
      SELECT id, slug, name, category, created_at
      FROM ai_sources 
      WHERE is_active = 1
      ORDER BY category, name
    `).all();

    return result.results || [];
  } catch (error) {
    console.error('Error getting all AI sources:', error);
    return [];
  }
}

/**
 * Deactivate an AI source (soft delete)
 */
export async function deactivateAiSource(env: any, slug: string): Promise<boolean> {
  try {
    await env.OPTIVIEW_DB.prepare(`
      UPDATE ai_sources 
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE slug = ?
    `).bind(slug).run();

    return true;
  } catch (error) {
    console.error('Error deactivating AI source:', error);
    return false;
  }
}
