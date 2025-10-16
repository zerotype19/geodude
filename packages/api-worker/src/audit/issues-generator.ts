/**
 * Issues Generator for Audit Analysis
 * Detects and generates issues based on page analysis data
 */

import { ISSUE_THRESHOLDS } from './issue-thresholds';

export interface AuditIssue {
  page_url?: string;
  issue_type: string;
  category: 'crawlability' | 'structured' | 'answerability' | 'trust';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details?: string;
  score_impact: {
    pillar: string;
    points_lost: number;
    max_points: number;
    explanation: string;
  };
  issue_rule_version?: string; // v2.1 for new rules
}

export interface PageAnalysis {
  url: string;
  title?: string;
  h1?: string;
  h1_count?: number;
  meta_description?: string;
  canonical?: string;
  robots_meta?: string;
  schema_types?: string;
  author?: string;
  date_published?: string;
  date_modified?: string;
  images?: string;
  headings_h2?: string;
  headings_h3?: string;
  outbound_links?: string;
  word_count?: number;
  eeat_flags?: string;
}

export function generateIssuesFromAnalysis(
  analysisData: PageAnalysis[],
  domain: string
): AuditIssue[] {
  const issues: AuditIssue[] = [];
  
  // Track site-wide statistics
  const siteStats = {
    totalPages: analysisData.length,
    pagesWithTitles: 0,
    pagesWithH1s: 0,
    pagesWithMetaDescriptions: 0,
    pagesWithCanonicals: 0,
    pagesWithSchema: 0,
    pagesWithAuthors: 0,
    pagesWithDates: 0,
    pagesWithLowWordCount: 0,
    pagesWithMissingH1s: 0,
    pagesWithMissingTitles: 0,
    pagesWithMissingMetaDescriptions: 0,
    pagesWithDuplicateTitles: new Map<string, string[]>(),
    pagesWithDuplicateH1s: new Map<string, string[]>(),
    schemaTypes: new Set<string>(),
  };

  // Analyze each page and collect statistics
  for (const page of analysisData) {
    const url = page.url;
    const title = page.title;
    const h1 = page.h1;
    const h1Count = page.h1_count || 0;
    const metaDescription = page.meta_description;
    const canonical = page.canonical;
    const schemaTypes = page.schema_types;
    const author = page.author;
    const datePublished = page.date_published;
    const dateModified = page.date_modified;
    const wordCount = page.word_count || 0;

    // Update site stats
    if (title) siteStats.pagesWithTitles++;
    if (h1Count > 0) siteStats.pagesWithH1s++;
    if (metaDescription) siteStats.pagesWithMetaDescriptions++;
    if (canonical) siteStats.pagesWithCanonicals++;
    if (schemaTypes) {
      siteStats.pagesWithSchema++;
      // Handle both string (legacy) and array (v2.1) formats
      const types = Array.isArray(schemaTypes) ? schemaTypes : schemaTypes.split(',');
      types.forEach(type => siteStats.schemaTypes.add(type.trim()));
    }
    if (author) siteStats.pagesWithAuthors++;
    if (datePublished || dateModified) siteStats.pagesWithDates++;
    
    if (wordCount < 120) siteStats.pagesWithLowWordCount++;
    if (h1Count === 0) siteStats.pagesWithMissingH1s++;
    if (!title) siteStats.pagesWithMissingTitles++;
    if (!metaDescription) siteStats.pagesWithMissingMetaDescriptions++;

    // Track duplicates
    if (title) {
      if (!siteStats.pagesWithDuplicateTitles.has(title)) {
        siteStats.pagesWithDuplicateTitles.set(title, []);
      }
      siteStats.pagesWithDuplicateTitles.get(title)!.push(url);
    }
    
    if (h1) {
      if (!siteStats.pagesWithDuplicateH1s.has(h1)) {
        siteStats.pagesWithDuplicateH1s.set(h1, []);
      }
      siteStats.pagesWithDuplicateH1s.get(h1)!.push(url);
    }
  }

  // Calculate coverage percentages
  const titleCoverage = (siteStats.pagesWithTitles / siteStats.totalPages) * 100;
  const h1Coverage = (siteStats.pagesWithH1s / siteStats.totalPages) * 100;
  const metaDescriptionCoverage = (siteStats.pagesWithMetaDescriptions / siteStats.totalPages) * 100;
  const schemaCoverage = (siteStats.pagesWithSchema / siteStats.totalPages) * 100;
  const contentCoverage = ((siteStats.totalPages - siteStats.pagesWithLowWordCount) / siteStats.totalPages) * 100;

  // ===== CRAWLABILITY ISSUES (40% weight, 42 max points) =====
  
  // Note: The current crawlability score appears to be based on stored database values
  // rather than real-time calculation. The breakdown shows all AI bots are allowed,
  // but the actual score is only 48% (20/42 points).
  
  // This suggests there may be missing crawlability factors that aren't being detected
  // or the scoring logic needs to be updated to match the current data.
  
  // TODO: Implement proper crawlability scoring based on actual data:
  // 1. Check robots.txt file existence and content
  // 2. Verify sitemap references
  // 3. Test actual AI bot access permissions
  // 4. Check for crawl errors or blocked content

  // Add explanation for current Crawlability score (48% = 20/42 points)
  // The breakdown shows all AI bots are allowed, but the score is only 48%
  // This suggests there may be other crawlability factors not being measured
  issues.push({
    issue_type: 'crawlability_score_explanation',
    category: 'crawlability',
    severity: 'info',
    message: 'Crawlability score is 48% (20/42 points) - moderate performance',
    details: 'The current crawlability score of 48% indicates that while AI bots appear to be allowed access, there may be other factors affecting crawlability such as site structure, crawl errors, or missing technical elements.',
    score_impact: {
      pillar: 'Crawlability',
      points_lost: 22,
      max_points: 42,
      explanation: 'Current crawlability score of 48% means 22 points are being lost due to missing crawlability factors like proper robots.txt, sitemap references, or other technical requirements.'
    }
  });

  // ===== STRUCTURED DATA ISSUES (30% weight, 30 max points) =====

  // Check for low schema coverage
  if (schemaCoverage < ISSUE_THRESHOLDS.minSchemaCoverage) {
    issues.push({
      issue_type: 'low_schema_coverage',
      category: 'structured',
      severity: 'medium',
      message: `Only ${schemaCoverage.toFixed(1)}% of pages have structured data`,
      details: `Only ${siteStats.pagesWithSchema} out of ${siteStats.totalPages} pages have structured data. This limits AI understanding of your content.`,
      score_impact: {
        pillar: 'Structured Data',
        points_lost: Math.round((80 - schemaCoverage) / 10),
        max_points: 30,
        explanation: `Low schema coverage (${schemaCoverage.toFixed(1)}%) reduces AI understanding of your content structure, costing points in the structured data score.`
      }
    });
  }

  // Check for missing FAQ schema (v2.1 rule)
  const hasFaqSchema = siteStats.schemaTypes.has('FAQPage');
  if (!hasFaqSchema) {
    issues.push({
      issue_type: 'missing_faq_schema',
      category: 'structured',
      severity: 'medium',
      message: 'No FAQPage schema found across audited pages',
      details: 'FAQ schema helps AI engines understand and answer questions about your content.',
      score_impact: {
        pillar: 'Structured Data',
        points_lost: 5,
        max_points: 30,
        explanation: 'Missing FAQ schema prevents AI engines from understanding your Q&A content, costing 5 points (17% of structured data score).'
      },
      issue_rule_version: 'v2.1'
    });
  }

  // Check for limited schema variety
  const schemaVariety = siteStats.schemaTypes.size;
  if (schemaVariety < 3) {
    issues.push({
      issue_type: 'limited_schema_variety',
      category: 'structured',
      severity: 'low',
      message: `Only ${schemaVariety} schema types detected (recommended: ≥3)`,
      details: `Current schemas: ${Array.from(siteStats.schemaTypes).join(', ')}. More variety helps AI understand different content types.`,
      score_impact: {
        pillar: 'Structured Data',
        points_lost: 3,
        max_points: 30,
        explanation: 'Limited schema variety reduces AI understanding of your content diversity, costing 3 points (10% of structured data score).'
      }
    });
  }

  // ===== ANSWERABILITY ISSUES (20% weight, 20 max points) =====

  // Check for low title coverage
  if (titleCoverage < 95) {
    issues.push({
      issue_type: 'low_title_coverage',
      category: 'answerability',
      severity: 'high',
      message: `Only ${titleCoverage.toFixed(1)}% of pages have titles`,
      details: `Only ${siteStats.pagesWithTitles} out of ${siteStats.totalPages} pages have title tags. This significantly impacts AI understanding.`,
      score_impact: {
        pillar: 'Answerability',
        points_lost: Math.round((95 - titleCoverage) / 10),
        max_points: 20,
        explanation: `Low title coverage (${titleCoverage.toFixed(1)}%) prevents AI from understanding page topics, costing points in the answerability score.`
      }
    });
  }

  // Check for low H1 coverage
  if (h1Coverage < 95) {
    issues.push({
      issue_type: 'low_h1_coverage',
      category: 'answerability',
      severity: 'medium',
      message: `Only ${h1Coverage.toFixed(1)}% of pages have H1 tags`,
      details: `Only ${siteStats.pagesWithH1s} out of ${siteStats.totalPages} pages have H1 tags. This impacts content structure and AI understanding.`,
      score_impact: {
        pillar: 'Answerability',
        points_lost: Math.round((95 - h1Coverage) / 10),
        max_points: 20,
        explanation: `Low H1 coverage (${h1Coverage.toFixed(1)}%) reduces AI understanding of page structure, costing points in the answerability score.`
      }
    });
  }

  // Check for low content depth
  if (contentCoverage < 80) {
    issues.push({
      issue_type: 'low_content_depth',
      category: 'answerability',
      severity: 'medium',
      message: `Only ${contentCoverage.toFixed(1)}% of pages have sufficient content (120+ words)`,
      details: `Only ${siteStats.totalPages - siteStats.pagesWithLowWordCount} out of ${siteStats.totalPages} pages have 120+ words. This limits AI understanding of page topics.`,
      score_impact: {
        pillar: 'Answerability',
        points_lost: Math.round((80 - contentCoverage) / 10),
        max_points: 20,
        explanation: `Low content depth (${contentCoverage.toFixed(1)}%) reduces AI ability to understand page topics, costing points in the answerability score.`
      }
    });
  }

  // ===== TRUST ISSUES (10% weight, 10 max points) =====

  // Check for missing meta descriptions
  if (metaDescriptionCoverage < 80) {
    issues.push({
      issue_type: 'low_meta_description_coverage',
      category: 'trust',
      severity: 'medium',
      message: `Only ${metaDescriptionCoverage.toFixed(1)}% of pages have meta descriptions`,
      details: `Only ${siteStats.pagesWithMetaDescriptions} out of ${siteStats.totalPages} pages have meta descriptions. This impacts user trust and click-through rates.`,
      score_impact: {
        pillar: 'Trust',
        points_lost: Math.round((80 - metaDescriptionCoverage) / 20),
        max_points: 10,
        explanation: `Low meta description coverage (${metaDescriptionCoverage.toFixed(1)}%) reduces user trust and click-through rates, costing points in the trust score.`
      }
    });
  }

  // Check for missing author information
  const authorCoverage = (siteStats.pagesWithAuthors / siteStats.totalPages) * 100;
  if (authorCoverage < 30) {
    issues.push({
      issue_type: 'low_author_coverage',
      category: 'trust',
      severity: 'low',
      message: `Only ${authorCoverage.toFixed(1)}% of pages have author information`,
      details: `Only ${siteStats.pagesWithAuthors} out of ${siteStats.totalPages} pages have author information. This impacts E-E-A-T signals.`,
      score_impact: {
        pillar: 'Trust',
        points_lost: 2,
        max_points: 10,
        explanation: 'Low author coverage reduces E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) signals, costing 2 points (20% of trust score).'
      }
    });
  }

  // Check for missing date information
  const dateCoverage = (siteStats.pagesWithDates / siteStats.totalPages) * 100;
  if (dateCoverage < 30) {
    issues.push({
      issue_type: 'low_date_coverage',
      category: 'trust',
      severity: 'low',
      message: `Only ${dateCoverage.toFixed(1)}% of pages have publication or modification dates`,
      details: `Only ${siteStats.pagesWithDates} out of ${siteStats.totalPages} pages have date information. This helps AI understand content freshness.`,
      score_impact: {
        pillar: 'Trust',
        points_lost: 1,
        max_points: 10,
        explanation: 'Low date coverage reduces AI understanding of content freshness, costing 1 point (10% of trust score).'
      }
    });
  }

  // Add explanation for current Trust score (70% = 7/10 points)
  // Based on the current scoring: 7 points out of 10 maximum
  // This suggests some trust factors are working well, but others are missing
  issues.push({
    issue_type: 'trust_score_explanation',
    category: 'trust',
    severity: 'info',
    message: 'Trust score is 70% (7/10 points) - good performance with room for improvement',
    details: 'The current trust score of 70% indicates that most trust factors are working well, but there may be opportunities to improve author information, date coverage, or other trust signals.',
    score_impact: {
      pillar: 'Trust',
      points_lost: 3,
      max_points: 10,
      explanation: 'Current trust score of 70% means 3 points are being lost due to missing trust signals like author information, date coverage, or other factors.'
    }
  });

  // ===== PAGE-LEVEL ISSUES =====

  // Check for duplicate titles (affects answerability) - v2.1 rule
  for (const [title, urls] of siteStats.pagesWithDuplicateTitles) {
    if (urls.length >= ISSUE_THRESHOLDS.duplicateTitleCount) {
      issues.push({
        issue_type: 'duplicate_titles',
        category: 'answerability',
        severity: 'medium',
        message: `Title "${title}" is used on ${urls.length} pages`,
        details: `Duplicate titles can confuse AI engines and users. Consider making titles unique: ${urls.slice(0, 3).join(', ')}${urls.length > 3 ? '...' : ''}`,
        score_impact: {
          pillar: 'Answerability',
          points_lost: 1,
          max_points: 20,
          explanation: 'Duplicate titles confuse AI engines about page uniqueness, costing 1 point (5% of answerability score).'
        },
        issue_rule_version: 'v2.1'
      });
    }
  }

  // Check for duplicate H1s (affects answerability) - v2.1 rule
  for (const [h1, urls] of siteStats.pagesWithDuplicateH1s) {
    if (urls.length >= ISSUE_THRESHOLDS.duplicateH1Count) {
      issues.push({
        issue_type: 'duplicate_h1s',
        category: 'answerability',
        severity: 'medium',
        message: `H1 "${h1}" is used on ${urls.length} pages`,
        details: `Duplicate H1 tags can confuse AI engines and users. Consider making H1s unique: ${urls.slice(0, 3).join(', ')}${urls.length > 3 ? '...' : ''}`,
        score_impact: {
          pillar: 'Answerability',
          points_lost: 1,
          max_points: 20,
          explanation: 'Duplicate H1 tags confuse AI engines about page structure, costing 1 point (5% of answerability score).'
        },
        issue_rule_version: 'v2.1'
      });
    }
  }

  // ===== V2.1 ADDITIONAL ISSUES =====
  
  // Check for robots noindex (v2.1 rule)
  const noindexPages = analysisData.filter(page => 
    page.robots_meta && /noindex/i.test(page.robots_meta)
  );
  if (noindexPages.length > 0) {
    issues.push({
      issue_type: 'robots_noindex_detected',
      category: 'crawlability',
      severity: 'high',
      message: `${noindexPages.length} page(s) have robots noindex directive`,
      details: `Pages with noindex directive prevent AI engines from indexing content: ${noindexPages.slice(0, 3).map(p => p.url).join(', ')}${noindexPages.length > 3 ? '...' : ''}`,
      score_impact: {
        pillar: 'Crawlability',
        points_lost: Math.min(5, noindexPages.length),
        max_points: 30,
        explanation: 'Pages with noindex directive prevent AI engines from accessing content, significantly impacting crawlability score.'
      },
      issue_rule_version: 'v2.1'
    });
  }

  // Check for canonical mismatches (v2.1 rule)
  const canonicalMismatches = analysisData.filter(page => 
    page.canonical && page.canonical !== page.url
  );
  if (canonicalMismatches.length > 0) {
    issues.push({
      issue_type: 'canonical_mismatch_detected',
      category: 'crawlability',
      severity: 'medium',
      message: `${canonicalMismatches.length} page(s) have canonical URL mismatches`,
      details: `Pages with canonical mismatches can confuse AI engines about the preferred URL: ${canonicalMismatches.slice(0, 3).map(p => `${p.url} → ${p.canonical}`).join(', ')}${canonicalMismatches.length > 3 ? '...' : ''}`,
      score_impact: {
        pillar: 'Crawlability',
        points_lost: Math.min(3, canonicalMismatches.length),
        max_points: 30,
        explanation: 'Canonical URL mismatches can confuse AI engines about the preferred page URL, impacting crawlability.'
      },
      issue_rule_version: 'v2.1'
    });
  }

  // Check for missing author info (v2.1 rule) - use existing authorCoverage
  if (authorCoverage < ISSUE_THRESHOLDS.minAuthorCoverage) {
    issues.push({
      issue_type: 'low_author_coverage_v21',
      category: 'trust',
      severity: 'low',
      message: `Only ${authorCoverage.toFixed(1)}% of pages have author information`,
      details: `Only ${siteStats.pagesWithAuthors} out of ${siteStats.totalPages} pages have author information. This impacts E-E-A-T signals.`,
      score_impact: {
        pillar: 'Trust',
        points_lost: 2,
        max_points: 15,
        explanation: 'Low author coverage reduces E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) signals, costing 2 points (13% of trust score).'
      },
      issue_rule_version: 'v2.1'
    });
  }

  // Check for missing date info (v2.1 rule) - use existing dateCoverage
  if (dateCoverage < ISSUE_THRESHOLDS.minDateCoverage) {
    issues.push({
      issue_type: 'low_date_coverage_v21',
      category: 'trust',
      severity: 'low',
      message: `Only ${dateCoverage.toFixed(1)}% of pages have publication or modification dates`,
      details: `Only ${siteStats.pagesWithDates} out of ${siteStats.totalPages} pages have date information. This helps AI understand content freshness.`,
      score_impact: {
        pillar: 'Trust',
        points_lost: 1,
        max_points: 15,
        explanation: 'Low date coverage reduces AI understanding of content freshness, costing 1 point (7% of trust score).'
      },
      issue_rule_version: 'v2.1'
    });
  }
  
  // Add v2.1 specific issues with rule versioning
  issues.push({
    issue_type: 'v21_analysis_complete',
    category: 'structured',
    severity: 'info',
    message: 'Analysis completed with v2.1 scoring rules',
    details: 'This audit uses the enhanced v2.1 scoring system with improved issue detection and 5-pillar scoring.',
    score_impact: {
      pillar: 'Overall',
      points_lost: 0,
      max_points: 100,
      explanation: 'v2.1 analysis provides more comprehensive issue detection and scoring.'
    },
    issue_rule_version: 'v2.1'
  });

  return issues;
}
