/**
 * Optiview Feature Flags & Configuration
 */

// Version control
export const PROMPTS_VERSION = 'v4-llm';

// V4 LLM-native generation
export const PROMPTS_USE_V4 = true;                    // enable V4 A/B gate
export const PROMPTS_V4_AB_PERCENT = 0.5;              // ramp control (0.5 = 50%, 1.0 = 100%)
export const PROMPTS_V4_ROLLOUT_MINUTES = 30;          // staged rollout window (0 = instant)
export const PROMPTS_LLM_MODEL = '@cf/meta/llama-3.1-8b-instruct';
export const PROMPTS_LLM_MODEL_HIGH = '@cf/meta/llama-3.1-70b-instruct'; // optional override
export const PROMPTS_LLM_USE_HIGH_QUALITY = false;    // set true for high-quality re-gen
export const PROMPTS_LLM_RETRIES = 2;
export const PROMPTS_V4_TIMEOUT_MS = 3500;             // 3.5s timeout per LLM call
export const PROMPTS_V4_MAX_CALLS_PER_MIN = 30;        // rate limit

// Canary domains (always use V4)
export const PROMPTS_V4_CANARIES = ['paypal.com', 'royalcaribbean.com', 'nike.com', 'adobe.com'];

// V3 template-based (kept for fallback)
export const PROMPTS_USE_V3 = true;                    // flip to false for A/B if needed
export const PROMPTS_ENABLE_FEWSHOT_SEEDS = true;
export const PROMPTS_MAX_PER_INTENT = 3;

// Shared settings
export const PROMPTS_ENABLE_REALISM_SCORER = true;     // set false if no AI binding
export const PROMPTS_BRANDED_MAX = 15;                 // max branded queries to return (was 10)
export const PROMPTS_NONBRANDED_MAX = 25;              // max non-branded queries to return (was 18)

// Industry V2 (Horizon 1) - New unified pipeline
export const INDUSTRY_V2_ENABLED = true;               // Enable industry taxonomy 2.0 + MSS templates
export const EMBEDDING_CLASSIFIER_ENABLED = true;      // Enable Workers AI embeddings for classification
export const COLD_START_CLASSIFIER_ENABLED = true;     // Enable cold-start HTML fetch + classification for non-audited domains
export const BLENDED_USES_V4 = true;                   // Force blended mode to use V4 pipeline (disable legacy AI+rules blend)
export const DISABLE_V3_FALLBACK = true;               // Disable V3 template fallback (use MSS V2 only)
export const ROUTE_LEGACY_COLD_START_DISABLED = true;  // Disable legacy route-level cold-start (use new buildWithColdStart)

// Crawler Politeness & Rate Limiting
export const CRAWL_DELAY_MS = 1500;                    // Polite 1.5s delay between requests to same domain
export const PRECHECK_MAX_RETRIES = 3;                 // Max retries for 429/521 errors
export const PRECHECK_RETRY_BASE_MS = 2000;            // Base delay for exponential backoff (2s)
export const PRECHECK_RETRY_MAX_MS = 30000;            // Max retry delay (30s)

// Citations Performance & Safety
// FIXED: Increased timeouts to reduce timeout errors, disabled Brave due to rate limiting
export const DISABLE_BRAVE_TEMP = true;                 // DISABLED: Brave hitting 100% rate limits (429 errors)
export const CITATIONS_BATCH_SIZE = 5;                  // Concurrent queries per source
export const CITATIONS_TIMEOUT_MS = 10000;              // 10s timeout per query
export const CITATIONS_PERPLEXITY_TIMEOUT_MS = 20000;   // INCREASED: 15s → 20s (was timing out frequently)
export const CITATIONS_CHATGPT_TIMEOUT_MS = 12000;      // INCREASED: 8s → 12s (was timing out on complex queries)
export const CITATIONS_CLAUDE_TIMEOUT_MS = 10000;       // INCREASED: 8s → 10s (for consistency)
export const CITATIONS_BRAVE_TIMEOUT_MS = 5000;         // Brave specific timeout (currently disabled)

