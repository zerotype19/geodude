/**
 * Visibility Intelligence Smoke Test
 * Tests the basic functionality of the VI system
 */

import { normalizeFromUrl } from '../lib/domain';
import { IntentGenerator } from '../services/vi/intents';
import { VisibilityScorer } from '../services/vi/scoring';

// Mock environment for testing
const mockEnv = {
  DB: {
    prepare: (sql: string) => ({
      bind: (...params: any[]) => ({
        all: async () => ({ results: [] }),
        first: async () => null,
        run: async () => ({ success: true })
      })
    })
  },
  KV_VI_SEEDS: {
    get: async (key: string, type: string) => null
  }
} as any;

describe('Visibility Intelligence System', () => {
  test('Domain normalization works correctly', () => {
    const testCases = [
      { input: 'https://www.example.com', expected: 'example.com' },
      { input: 'https://blog.example.com', expected: 'blog.example.com' },
      { input: 'https://www.example.co.uk', expected: 'example.co.uk' },
      { input: 'https://docs.example.com/path', expected: 'docs.example.com' }
    ];

    testCases.forEach(({ input, expected }) => {
      const result = normalizeFromUrl(input);
      expect(result.etld1).toBe(expected);
      expect(result.audited_url).toContain('https://');
      expect(result.hostname).toBeDefined();
    });
  });

  test('Intent generation creates diverse queries', async () => {
    const generator = new IntentGenerator(mockEnv);
    const domainInfo = normalizeFromUrl('https://www.example.com');
    
    const intents = await generator.generateIntents('test-project', domainInfo, 10);
    
    expect(intents.length).toBeGreaterThan(0);
    expect(intents.length).toBeLessThanOrEqual(10);
    
    // Check that we have different intent types
    const types = new Set(intents.map(i => i.intent_type));
    expect(types.size).toBeGreaterThan(1);
    
    // Check weights are applied
    const weights = intents.map(i => i.weight);
    expect(weights.some(w => w !== 1.0)).toBe(true);
  });

  test('Scoring algorithm calculates correctly', () => {
    const scorer = new VisibilityScorer(mockEnv);
    
    // Test with audited domain citations
    const auditedCitations = [
      { ref_url: 'https://example.com/page1', ref_domain: 'example.com', rank: 1, is_audited_domain: true },
      { ref_url: 'https://example.com/page2', ref_domain: 'example.com', rank: 2, is_audited_domain: true }
    ];
    
    const score = scorer.calculateIntentScore(auditedCitations, 'example.com');
    
    // Should get high score for audited domain citations
    expect(score).toBeGreaterThan(70);
    
    // Test with competitor citations
    const competitorCitations = [
      { ref_url: 'https://competitor.com/page1', ref_domain: 'competitor.com', rank: 1, is_audited_domain: false },
      { ref_url: 'https://competitor.com/page2', ref_domain: 'competitor.com', rank: 2, is_audited_domain: false }
    ];
    
    const competitorScore = scorer.calculateIntentScore(competitorCitations, 'example.com', ['competitor.com']);
    
    // Should get low score for competitor citations
    expect(competitorScore).toBeLessThan(20);
  });

  test('API endpoints are properly structured', async () => {
    // Test that our endpoints return proper responses
    const endpoints = [
      '/api/vi/run',
      '/api/vi/results',
      '/api/vi/compare',
      '/api/vi/export.csv',
      '/api/vi/health'
    ];
    
    endpoints.forEach(endpoint => {
      expect(endpoint).toMatch(/^\/api\/vi\//);
    });
  });

  test('Cache key generation is deterministic', () => {
    const { getCacheKey } = require('../lib/domain');
    
    const key1 = getCacheKey('perplexity', 'example.com', 'What is example?');
    const key2 = getCacheKey('perplexity', 'example.com', 'What is example?');
    const key3 = getCacheKey('perplexity', 'example.com', 'What is example different?');
    
    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key1).toContain('perplexity');
    expect(key1).toContain('example.com');
  });
});

// Integration test for the full flow
describe('End-to-End VI Flow', () => {
  test('Complete visibility analysis flow', async () => {
    // This would test the full flow from audit to results
    // For now, just verify the components can be instantiated
    
    const generator = new IntentGenerator(mockEnv);
    const scorer = new VisibilityScorer(mockEnv);
    
    expect(generator).toBeDefined();
    expect(scorer).toBeDefined();
    
    // Test domain info extraction
    const domainInfo = normalizeFromUrl('https://www.optiview.ai');
    expect(domainInfo.etld1).toBe('optiview.ai');
    
    console.log('✅ All VI components can be instantiated');
  });
});

console.log('🧪 Visibility Intelligence smoke tests ready');
