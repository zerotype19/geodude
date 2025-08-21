import { normalizeUrlForAsset, inferContentType } from './url-utils';

/**
 * Content asset management for automatic content discovery
 */

export interface ContentAsset {
  id: number;
  project_id: string;
  property_id: number;
  url: string;
  type: string;
  created_at: string;
  updated_at?: string;
}

/**
 * Ensure a content asset exists, creating it if necessary
 * Returns the content_id for linking with events
 */
export async function ensureContentAsset(
  db: any,
  project_id: string,
  property_id: number,
  url: string
): Promise<number | null> {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    // Normalize the URL for consistent asset creation
    const normalizedUrl = normalizeUrlForAsset(url);
    if (!normalizedUrl) {
      console.warn('Failed to normalize URL for content asset:', url);
      return null;
    }

    // First try to find existing content asset
    const existingAsset = await db.prepare(`
      SELECT id, url, type, updated_at
      FROM content_assets 
      WHERE project_id = ? AND property_id = ? AND url = ?
      LIMIT 1
    `).bind(project_id, property_id, normalizedUrl).first();

    if (existingAsset?.id) {
      // Asset exists, update timestamp if needed
      const now = new Date().toISOString();
      if (!existingAsset.updated_at || 
          (new Date(now).getTime() - new Date(existingAsset.updated_at).getTime()) > 24 * 60 * 60 * 1000) {
        // Update if more than 24 hours old
        await db.prepare(`
          UPDATE content_assets 
          SET updated_at = ? 
          WHERE id = ?
        `).bind(now, existingAsset.id).run();
      }
      
      return existingAsset.id;
    }

    // Create new content asset
    const contentType = inferContentType(normalizedUrl);
    const now = new Date().toISOString();
    
    const result = await db.prepare(`
      INSERT INTO content_assets (project_id, property_id, url, type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(project_id, property_id, normalizedUrl, contentType, now, now).run();

    const newAssetId = result.meta?.last_row_id;
    if (newAssetId) {
      console.log(`✅ Created new content asset: ${contentType} - ${normalizedUrl} (ID: ${newAssetId})`);
      return newAssetId;
    } else {
      console.error('Failed to create content asset - no ID returned');
      return null;
    }

  } catch (error) {
    console.error('Error ensuring content asset:', error);
    return null;
  }
}

/**
 * Batch ensure content assets for multiple URLs
 * Returns a map of URL to content_id
 */
export async function ensureContentAssets(
  db: any,
  project_id: string,
  property_id: number,
  urls: string[]
): Promise<Map<string, number>> {
  const urlToIdMap = new Map<string, number>();
  
  // Process URLs in parallel with concurrency limit
  const concurrency = 5;
  const chunks = [];
  for (let i = 0; i < urls.length; i += concurrency) {
    chunks.push(urls.slice(i, i + concurrency));
  }

  for (const chunk of chunks) {
    const promises = chunk.map(async (url) => {
      const contentId = await ensureContentAsset(db, project_id, property_id, url);
      if (contentId) {
        urlToIdMap.set(url, contentId);
      }
    });
    
    await Promise.all(promises);
  }

  return urlToIdMap;
}

/**
 * Get content asset by ID
 */
export async function getContentAsset(
  db: any,
  content_id: number
): Promise<ContentAsset | null> {
  try {
    const asset = await db.prepare(`
      SELECT id, project_id, property_id, url, type, created_at, updated_at
      FROM content_assets 
      WHERE id = ?
    `).bind(content_id).first();
    
    return asset || null;
  } catch (error) {
    console.error('Error getting content asset:', error);
    return null;
  }
}

/**
 * Get content assets for a project
 */
export async function getProjectContentAssets(
  db: any,
  project_id: string,
  limit: number = 100,
  offset: number = 0
): Promise<ContentAsset[]> {
  try {
    const assets = await db.prepare(`
      SELECT id, project_id, property_id, url, type, created_at, updated_at
      FROM content_assets 
      WHERE project_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(project_id, limit, offset).all();
    
    return assets.results || [];
  } catch (error) {
    console.error('Error getting project content assets:', error);
    return [];
  }
}

/**
 * Search content assets by URL pattern
 */
export async function searchContentAssets(
  db: any,
  project_id: string,
  searchTerm: string,
  limit: number = 50
): Promise<ContentAsset[]> {
  try {
    const assets = await db.prepare(`
      SELECT id, project_id, property_id, url, type, created_at, updated_at
      FROM content_assets 
      WHERE project_id = ? AND url LIKE ?
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(project_id, `%${searchTerm}%`, limit).all();
    
    return assets.results || [];
  } catch (error) {
    console.error('Error searching content assets:', error);
    return [];
  }
}
