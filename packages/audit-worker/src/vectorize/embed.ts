/**
 * Vectorize Embeddings via Workers AI
 * 
 * Uses @cf/baai/bge-base-en-v1.5 (768 dimensions)
 * for semantic similarity and nearest-neighbor search.
 */

export interface EmbeddingResult {
  vector: number[];
  success: boolean;
  error?: string;
}

export interface PageEmbeddingPayload {
  project_id: string;
  audit_id: string;
  url: string;
  page_type?: string;
  is_cited?: boolean;
  assistants_citing?: string[];
}

/**
 * Generate embedding for page summary using Workers AI
 * 
 * @param ai - Cloudflare AI binding
 * @param text - Text to embed (title + h1 + first paragraph, max 800 chars)
 * @returns Embedding vector (768 dims)
 */
export async function embedText(ai: any, text: string): Promise<EmbeddingResult> {
  try {
    // Truncate to 800 chars if needed
    const truncated = text.substring(0, 800);

    if (!truncated || truncated.trim().length < 10) {
      return {
        vector: [],
        success: false,
        error: 'Text too short for embedding'
      };
    }

    // Call Workers AI
    const response = await ai.run('@cf/baai/bge-base-en-v1.5', {
      text: truncated
    });

    // Response format: { shape: [1, 768], data: [[...numbers]] }
    const vector = response.data[0];

    if (!Array.isArray(vector) || vector.length !== 768) {
      throw new Error(`Invalid embedding dimension: ${vector?.length}`);
    }

    return {
      vector,
      success: true
    };
  } catch (error) {
    console.error('[Embed] Error generating embedding:', error);
    return {
      vector: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Generate page summary for embedding
 * 
 * Combines: title + h1 + first paragraph (or meta description fallback)
 * Max 800 chars
 */
export function generatePageSummary(
  title?: string,
  h1?: string,
  firstParagraph?: string,
  metaDescription?: string
): string {
  const parts: string[] = [];

  if (title) parts.push(title);
  if (h1 && h1 !== title) parts.push(h1);
  if (firstParagraph) parts.push(firstParagraph);
  else if (metaDescription) parts.push(metaDescription);

  const summary = parts.join(' ').trim();
  return summary.substring(0, 800);
}

/**
 * Compute content hash for change detection
 * Only re-embed if hash changes
 */
export function computeContentHash(text: string): string {
  // Simple hash for now; could use crypto.subtle.digest in Workers
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Generate Vectorize key for page
 * Format: project_id:audit_id:url_hash
 */
export function generateVectorizeKey(
  project_id: string,
  audit_id: string,
  url: string
): string {
  const urlHash = computeContentHash(url);
  return `${project_id}:${audit_id}:${urlHash}`;
}

/**
 * Upsert page embedding to Vectorize
 * 
 * @param vectorize - Cloudflare Vectorize binding
 * @param key - Unique key for this embedding
 * @param vector - 768-dim embedding vector
 * @param metadata - Page metadata (kept lean for Vectorize limits)
 */
export async function upsertEmbedding(
  vectorize: any,
  key: string,
  vector: number[],
  metadata: PageEmbeddingPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!vectorize) {
      console.warn('[Vectorize] Binding not available, skipping upsert');
      return { success: false, error: 'Vectorize binding not available' };
    }

    await vectorize.upsert([{
      id: key,
      values: vector,
      metadata: {
        ...metadata,
        // Keep metadata small (Vectorize has size limits)
        assistants_citing: metadata.assistants_citing 
          ? JSON.stringify(metadata.assistants_citing) 
          : undefined
      }
    }]);

    return { success: true };
  } catch (error) {
    console.error('[Vectorize] Error upserting embedding:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Query nearest neighbors from Vectorize
 * 
 * @param vectorize - Cloudflare Vectorize binding
 * @param vector - Query vector (768 dims)
 * @param topK - Number of results to return
 * @param filter - Optional metadata filter
 */
export async function queryNearestNeighbors(
  vectorize: any,
  vector: number[],
  topK: number = 5,
  filter?: Record<string, any>
): Promise<Array<{
  id: string;
  score: number;
  metadata: PageEmbeddingPayload;
}>> {
  try {
    if (!vectorize) {
      console.warn('[Vectorize] Binding not available');
      return [];
    }

    const results = await vectorize.query(vector, {
      topK,
      filter,
      returnMetadata: true
    });

    return results.matches.map((match: any) => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata as PageEmbeddingPayload
    }));
  } catch (error) {
    console.error('[Vectorize] Error querying neighbors:', error);
    return [];
  }
}

