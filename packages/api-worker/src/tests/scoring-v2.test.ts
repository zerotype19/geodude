/**
 * Tests for Phase Next Scoring System v2
 */

import { describe, it, expect } from 'vitest';
import { calculateScoresV2 } from '../score-v2';

describe('Scoring System v2', () => {
  const mockPages = [
    {
      url: 'https://example.com',
      status_code: 200,
      title: 'Example Page',
      h1: 'Welcome to Example',
      has_h1: true,
      jsonld_count: 1,
      faq_present: false,
      word_count: 500,
      rendered_words: 500,
      load_time_ms: 2000,
      error: null
    }
  ];

  const mockIssues = [
    {
      page_url: null,
      issue_type: 'missing_robots',
      severity: 'warning' as const,
      message: 'robots.txt not found'
    }
  ];

  const mockCrawlability = {
    robotsFound: true,
    sitemapFound: true,
    aiBotsAllowed: {
      'GPTBot': true,
      'ClaudeBot': true,
      'PerplexityBot': true,
      'CCBot': true,
      'Google-Extended': true,
      'Claude-Web': true
    },
    answerEngineAccess: {
      'PerplexityBot': { status: 200, bodyHash: 'abc123', cfChallenge: false },
      'Claude-Web': { status: 200, bodyHash: 'abc123', cfChallenge: false }
    },
    renderParity: 95
  };

  const mockStructured = {
    siteFaqSchemaPresent: false,
    siteFaqPagePresent: false,
    schemaTypes: ['Organization'],
    schemaFitness: 80,
    entityGraph: {
      hasPerson: true,
      hasOrganization: true,
      sameAsLinks: ['https://linkedin.com/company/example']
    }
  };

  const mockEEAT = {
    experience: 75,
    expertise: 80,
    authority: 70,
    trust: 85,
    overall: 77.5
  };

  it('should calculate scores correctly', () => {
    const scores = calculateScoresV2(
      mockPages,
      mockIssues,
      mockCrawlability,
      mockStructured,
      mockEEAT
    );

    expect(scores.overall).toBeGreaterThan(0);
    expect(scores.crawlability).toBeGreaterThan(0);
    expect(scores.structured).toBeGreaterThan(0);
    expect(scores.answerability).toBeGreaterThan(0);
    expect(scores.trust).toBeGreaterThan(0);
  });

  it('should apply gates correctly', () => {
    const scores = calculateScoresV2(
      mockPages,
      mockIssues,
      mockCrawlability,
      mockStructured,
      mockEEAT
    );

    expect(scores.gates).toBeDefined();
    expect(scores.gates.gateA).toBe(false); // Answer engines not blocked
    expect(scores.gates.gateB).toBe(false); // No noindex issues
    expect(scores.gates.gateC).toBe(false); // Good render parity
    expect(scores.gates.gateD).toBe(false); // No JSON-LD errors
  });

  it('should handle missing data gracefully', () => {
    const scores = calculateScoresV2(
      mockPages,
      mockIssues,
      undefined,
      undefined,
      undefined
    );

    expect(scores.overall).toBeGreaterThan(0);
    expect(scores.crawlability).toBeGreaterThan(0);
    expect(scores.structured).toBeGreaterThan(0);
    expect(scores.answerability).toBeGreaterThan(0);
    expect(scores.trust).toBeGreaterThan(0);
  });

  it('should calculate pillar breakdowns correctly', () => {
    const scores = calculateScoresV2(
      mockPages,
      mockIssues,
      mockCrawlability,
      mockStructured,
      mockEEAT
    );

    expect(scores.breakdown.pillarA).toBeDefined();
    expect(scores.breakdown.pillarB).toBeDefined();
    expect(scores.breakdown.pillarC).toBeDefined();
    expect(scores.breakdown.pillarD).toBeDefined();
    expect(scores.breakdown.pillarE).toBeDefined();

    // Check specific breakdown values
    expect(scores.breakdown.pillarA.robotsPresent).toBe(5);
    expect(scores.breakdown.pillarA.aiBotsAllowed).toBeGreaterThan(0);
    expect(scores.breakdown.pillarA.sitemapFound).toBe(5);
    expect(scores.breakdown.pillarA.answerEngineAccess).toBeGreaterThan(0);
    expect(scores.breakdown.pillarA.renderParity).toBeGreaterThan(0);
  });

  it('should handle empty pages array', () => {
    const scores = calculateScoresV2(
      [],
      mockIssues,
      mockCrawlability,
      mockStructured,
      mockEEAT
    );

    expect(scores.overall).toBeGreaterThan(0);
    expect(scores.crawlability).toBeGreaterThan(0);
    expect(scores.structured).toBeGreaterThan(0);
    expect(scores.answerability).toBe(0); // No pages = 0 answerability
    expect(scores.trust).toBeGreaterThan(0);
  });

  it('should handle high performance pages', () => {
    const fastPages = [
      {
        ...mockPages[0],
        load_time_ms: 1000,
        performance_score: 95
      }
    ];

    const scores = calculateScoresV2(
      fastPages,
      mockIssues,
      mockCrawlability,
      mockStructured,
      mockEEAT
    );

    expect(scores.breakdown.pillarE.performance).toBeGreaterThan(0);
    expect(scores.breakdown.pillarE.stability).toBeGreaterThan(0);
  });

  it('should handle pages with errors', () => {
    const errorPages = [
      {
        ...mockPages[0],
        status_code: 500,
        error: 'Internal Server Error'
      }
    ];

    const scores = calculateScoresV2(
      errorPages,
      mockIssues,
      mockCrawlability,
      mockStructured,
      mockEEAT
    );

    expect(scores.breakdown.pillarE.stability).toBeLessThan(100);
    expect(scores.breakdown.pillarD.safety).toBeLessThan(100);
  });
});
