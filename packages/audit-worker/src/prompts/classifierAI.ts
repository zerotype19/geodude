/**
 * Phase 2: Workers AI Classification Layer
 * Blends rule-based (v2) with LLM zero-shot classification
 */

import type { RichClassification } from '../types/classification';
import { CircuitBreaker } from '../lib/circuitBreaker';

const AI_MODEL = '@cf/meta/llama-3.1-8b-instruct';
const AI_TIMEOUT_MS = 600;
const AI_MAX_RETRIES = 1;
const AI_TEMPERATURE = 0.1;
const AI_MAX_TOKENS = 64;

// Allowed values for strict schema
const ALLOWED_SITE_TYPES = [
  'ecommerce', 'media', 'software', 'financial', 'insurance', 
  'travel', 'retail', 'corporate', 'nonprofit', 'automotive', 
  'education', 'government'
];

const ALLOWED_INDUSTRIES = [
  'retail', 'finance', 'insurance', 'travel', 'software', 
  'media', 'automotive', 'education', 'government', 'nonprofit', null
];

/**
 * Build AI classification prompt (few-shot, strict JSON)
 */
function buildAIPrompt(params: {
  hostname: string;
  urlParts: string;
  jsonldTypes: string[];
  navTerms: string[];
  sampleText: string;
}): string {
  const { hostname, urlParts, jsonldTypes, navTerms, sampleText } = params;

  return `Classify this website. Return strict JSON with keys "site_type" and "industry".

Allowed site_type: ${JSON.stringify(ALLOWED_SITE_TYPES)}
Allowed industry: ${JSON.stringify(ALLOWED_INDUSTRIES)}

INPUT:
domain: ${hostname}
url_parts: ${urlParts}
jsonld_types: ${JSON.stringify(jsonldTypes)}
nav_terms: ${JSON.stringify(navTerms.slice(0, 10))}
sample_text: ${sampleText.substring(0, 500)}

OUTPUT JSON ONLY (no markdown, no explanation):
{"site_type":"...","industry":"..."}`;
}

/**
 * Parse AI response (handle markdown fences, extract JSON)
 */
function parseAIResponse(response: string): { site_type: string; industry: string | null } | null {
  try {
    // Remove markdown fences if present
    let cleaned = response.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }

    // Extract JSON object if embedded in text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    const parsed = JSON.parse(cleaned);

    // Validate schema
    if (!parsed.site_type || !ALLOWED_SITE_TYPES.includes(parsed.site_type)) {
      console.warn('[AI_CLASSIFIER] Invalid site_type:', parsed.site_type);
      return null;
    }

    if (parsed.industry !== null && !ALLOWED_INDUSTRIES.includes(parsed.industry)) {
      console.warn('[AI_CLASSIFIER] Invalid industry:', parsed.industry);
      return null;
    }

    return {
      site_type: parsed.site_type,
      industry: parsed.industry
    };
  } catch (error) {
    console.error('[AI_CLASSIFIER] Parse error:', error);
    return null;
  }
}

/**
 * Call Workers AI for classification
 */
async function callWorkersAI(
  prompt: string,
  ai: any,
  breaker: CircuitBreaker
): Promise<{ site_type: string; industry: string | null } | null> {
  try {
    const startTime = Date.now();

    const response = await Promise.race([
      ai.run(AI_MODEL, {
        prompt,
        temperature: AI_TEMPERATURE,
        max_tokens: AI_MAX_TOKENS
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('AI timeout')), AI_TIMEOUT_MS)
      )
    ]);

    const elapsed = Date.now() - startTime;
    console.log(`[AI_CLASSIFIER] Success in ${elapsed}ms`);

    await breaker.recordSuccess();

    // Extract response text
    const text = (response as any)?.response || '';
    return parseAIResponse(text);
  } catch (error: any) {
    console.error('[AI_CLASSIFIER] Error:', error.message);
    await breaker.recordError(error.message);
    return null;
  }
}

/**
 * Blend rule-based and AI classifications
 */
export function blendClassifications(
  rulesResult: RichClassification,
  aiResult: { site_type: string; industry: string | null } | null
): RichClassification {
  if (!aiResult) {
    // No AI result, return rules-only
    return rulesResult;
  }

  // Blend: 70% rules + 30% AI
  // For Phase 2, we simply store AI result and keep rules as primary
  // In Phase 3, we can adjust the blend ratio
  
  const blended = { ...rulesResult };
  blended.zero_shot = {
    site_type: { value: aiResult.site_type, confidence: null },
    industry: { value: aiResult.industry, confidence: null },
    model: AI_MODEL,
    cached: false
  };

  // For now, don't override rules-based classification
  // Just log for comparison
  console.log(JSON.stringify({
    type: 'classification_ai_comparison',
    rules_site_type: rulesResult.site_type.value,
    ai_site_type: aiResult.site_type,
    rules_industry: rulesResult.industry.value,
    ai_industry: aiResult.industry,
    match_site_type: rulesResult.site_type.value === aiResult.site_type,
    match_industry: rulesResult.industry.value === aiResult.industry
  }));

  return blended;
}

/**
 * Phase 2: Classify with AI augmentation
 * (Feature flag controlled, circuit breaker protected)
 */
export async function classifyWithAI(
  rulesResult: RichClassification,
  params: {
    hostname: string;
    url: string;
    html: string;
  },
  env: any
): Promise<RichClassification> {
  // Check feature flag
  const aiEnabled = env.CLASSIFIER_AI_ENABLED === '1' || env.CLASSIFIER_AI_ENABLED === 'true';
  if (!aiEnabled) {
    return rulesResult;
  }

  // Check circuit breaker
  const breaker = new CircuitBreaker(env.RULES);
  const isOpen = await breaker.isOpen();
  if (isOpen) {
    console.log('[AI_CLASSIFIER] Circuit breaker open, skipping AI');
    return rulesResult;
  }

  // Check KV cache first
  const cacheKey = `optiview:classify:v1:${params.hostname}:ai`;
  const cached = await env.RULES.get(cacheKey);
  if (cached) {
    try {
      const aiResult = JSON.parse(cached);
      aiResult.cached = true;
      console.log(`[AI_CLASSIFIER] Cache hit for ${params.hostname}`);
      return blendClassifications(rulesResult, aiResult);
    } catch {
      // Ignore cache errors
    }
  }

  // Build prompt
  const url = new URL(params.url);
  const prompt = buildAIPrompt({
    hostname: params.hostname,
    urlParts: url.pathname,
    jsonldTypes: rulesResult.jsonld_types,
    navTerms: rulesResult.nav_terms,
    sampleText: params.html.substring(0, 1000)
  });

  // Call AI with retry
  let aiResult = await callWorkersAI(prompt, env.AI, breaker);

  if (!aiResult && AI_MAX_RETRIES > 0) {
    console.log('[AI_CLASSIFIER] Retrying...');
    aiResult = await callWorkersAI(prompt, env.AI, breaker);
  }

  if (!aiResult) {
    console.warn('[AI_CLASSIFIER] Failed after retries, using rules-only');
    return rulesResult;
  }

  // Cache result for 24h
  await env.RULES.put(cacheKey, JSON.stringify(aiResult), { expirationTtl: 86400 }).catch(() => {});

  return blendClassifications(rulesResult, aiResult);
}

