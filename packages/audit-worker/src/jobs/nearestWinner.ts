/**
 * Nearest Winner Job (Learning Loop)
 * 
 * For each uncited page, find the nearest cited page via Vectorize
 * and generate recommendations
 */

import { queryNearestNeighbors } from '../vectorize';
import { buildRecommendations } from '../reco/buildDiff';

export interface Env {
  DB: D1Database;
  VECTORIZE: any;
  AI: any;
}

export interface NearestWinnerResult {
  pages_processed: number;
  matches_found: number;
  recommendations_generated: number;
}

/**
 * Find nearest cited pages and generate recommendations for an audit
 */
export async function findNearestWinners(
  db: D1Database,
  vectorize: any,
  auditId: string
): Promise<NearestWinnerResult> {
  console.log(`[Nearest Winner] Processing audit ${auditId}...`);

  let pages_processed = 0;
  let matches_found = 0;
  let recommendations_generated = 0;

  try {
    // Get all uncited pages for this audit
    const uncitedPages = await db.prepare(`
      SELECT 
        ap.id,
        ap.url,
        apa.metadata
      FROM audit_pages ap
      LEFT JOIN audit_page_analysis apa ON ap.id = apa.page_id
      WHERE ap.audit_id = ?
        AND (ap.is_cited = 0 OR ap.is_cited IS NULL)
    `).bind(auditId).all();

    if (!uncitedPages.results || uncitedPages.results.length === 0) {
      console.log(`[Nearest Winner] No uncited pages found for audit ${auditId}`);
      return { pages_processed: 0, matches_found: 0, recommendations_generated: 0 };
    }

    console.log(`[Nearest Winner] Found ${uncitedPages.results.length} uncited pages`);

    // Get all cited pages for this audit (for fallback and validation)
    const citedPages = await db.prepare(`
      SELECT 
        ap.id,
        ap.url,
        ap.citation_count,
        ap.assistants_citing,
        apa.checks_json,
        apa.metadata
      FROM audit_pages ap
      LEFT JOIN audit_page_analysis apa ON ap.id = apa.page_id
      WHERE ap.audit_id = ?
        AND ap.is_cited = 1
      ORDER BY ap.citation_count DESC
    `).bind(auditId).all();

    if (!citedPages.results || citedPages.results.length === 0) {
      console.log(`[Nearest Winner] No cited pages found for audit ${auditId} - cannot generate recommendations`);
      return { pages_processed: 0, matches_found: 0, recommendations_generated: 0 };
    }

    const citedPagesMap = new Map(
      (citedPages.results as any[]).map(p => [p.url, p])
    );

    // Process each uncited page
    for (const page of uncitedPages.results as any[]) {
      pages_processed++;

      try {
        // Get embedding for this page from metadata
        const metadata = page.metadata ? JSON.parse(page.metadata) : {};
        const embedding = metadata.embedding;

        let nearestCitedUrl: string | null = null;

        if (embedding && vectorize) {
          // Query Vectorize for nearest neighbors
          const neighbors = await queryNearestNeighbors(
            vectorize,
            embedding,
            10,  // Get top 10
            { audit_id: auditId, is_cited: true }  // Filter to cited pages in same audit
          );

          // Find first cited neighbor
          for (const neighbor of neighbors) {
            if (neighbor.metadata.is_cited) {
              nearestCitedUrl = neighbor.metadata.url;
              break;
            }
          }
        }

        // Fallback: use highest cited page if no vector match
        if (!nearestCitedUrl && citedPages.results.length > 0) {
          nearestCitedUrl = (citedPages.results[0] as any).url;
          console.log(`[Nearest Winner] Using fallback (highest cited) for ${page.url}`);
        }

        if (!nearestCitedUrl) {
          console.log(`[Nearest Winner] No match found for ${page.url}`);
          continue;
        }

        matches_found++;

        // Get winner page data
        const winnerPage = citedPagesMap.get(nearestCitedUrl);
        if (!winnerPage) {
          console.log(`[Nearest Winner] Winner page data not found for ${nearestCitedUrl}`);
          continue;
        }

        // Parse checks
        const targetChecks = metadata.checks || {};
        const winnerChecks = winnerPage.checks_json ? JSON.parse(winnerPage.checks_json) : {};

        // Build recommendations
        const recommendations = buildRecommendations(
          targetChecks,
          winnerChecks,
          metadata,
          winnerPage.metadata ? JSON.parse(winnerPage.metadata) : {}
        );

        if (recommendations.diffs.length === 0) {
          console.log(`[Nearest Winner] No actionable recommendations for ${page.url}`);
          continue;
        }

        // Store recommendations
        const recommendation_json = JSON.stringify({
          nearest_cited_url: nearestCitedUrl,
          assistants: JSON.parse(winnerPage.assistants_citing || '[]'),
          diffs: recommendations.diffs
        });

        await db.prepare(`
          UPDATE audit_pages
          SET 
            nearest_cited_url = ?,
            recommendation_json = ?
          WHERE id = ?
        `).bind(
          nearestCitedUrl,
          recommendation_json,
          page.id
        ).run();

        recommendations_generated++;

        if (recommendations_generated % 10 === 0) {
          console.log(`[Nearest Winner] Generated ${recommendations_generated} recommendations so far...`);
        }
      } catch (error) {
        console.error(`[Nearest Winner] Error processing page ${page.id}:`, error);
      }
    }

    console.log(`[Nearest Winner] Complete! Processed ${pages_processed} pages, found ${matches_found} matches, generated ${recommendations_generated} recommendations`);

    return {
      pages_processed,
      matches_found,
      recommendations_generated
    };
  } catch (error) {
    console.error('[Nearest Winner] Fatal error:', error);
    throw error;
  }
}

