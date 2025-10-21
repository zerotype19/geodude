/**
 * Vectorize Index Management
 * 
 * Central utilities for managing the optiview-page-embeddings index
 */

export { 
  embedText, 
  generatePageSummary, 
  computeContentHash,
  generateVectorizeKey,
  upsertEmbedding,
  queryNearestNeighbors,
  type EmbeddingResult,
  type PageEmbeddingPayload
} from './embed';

/**
 * Vectorize index configuration
 */
export const VECTORIZE_INDEX_NAME = 'optiview-page-embeddings';
export const VECTORIZE_DIMENSIONS = 768;
export const VECTORIZE_MODEL = '@cf/baai/bge-base-en-v1.5';

/**
 * Check if Vectorize is enabled in environment
 */
export function isVectorizeEnabled(env: any): boolean {
  return Boolean(env.VECTORIZE_ENABLED !== 'false' && env.VECTORIZE);
}

/**
 * Get Vectorize binding from environment
 */
export function getVectorizeBinding(env: any): any | null {
  if (!isVectorizeEnabled(env)) {
    return null;
  }
  return env.VECTORIZE || null;
}

/**
 * Vectorize index setup instructions (for deployment)
 * 
 * Run this command to create the index:
 * 
 * ```bash
 * npx wrangler vectorize create optiview-page-embeddings \
 *   --dimensions=768 \
 *   --metric=cosine
 * ```
 * 
 * Then add to wrangler.toml:
 * 
 * ```toml
 * [[vectorize]]
 * binding = "VECTORIZE"
 * index_name = "optiview-page-embeddings"
 * ```
 */
export const VECTORIZE_SETUP_INSTRUCTIONS = `
To create the Vectorize index:

1. Run command:
   npx wrangler vectorize create optiview-page-embeddings --dimensions=768 --metric=cosine

2. Add to wrangler.toml:
   [[vectorize]]
   binding = "VECTORIZE"
   index_name = "optiview-page-embeddings"

3. Deploy worker:
   npx wrangler deploy
`;

