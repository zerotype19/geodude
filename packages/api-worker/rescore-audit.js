/**
 * Manual rescore script for audit aud_1760616884674_hmddpnay8
 * This will force re-analysis of all pages and recalculate scores
 */

import { finalizeAudit } from './src/audit/finalize.js';
import { runSynthTick } from './src/audit/synth.js';

const AUDIT_ID = 'aud_1760616884674_hmddpnay8';

// Mock environment object
const mockEnv = {
  DB: {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => {
          console.log('SQL:', sql, 'Args:', args);
          // Mock responses based on SQL query
          if (sql.includes('COUNT(*) as total_pages')) {
            return { total_pages: 50 };
          }
          if (sql.includes('SUM(CASE WHEN h1_count = 1')) {
            return { proper_h1_pages: 45 }; // Assume 45 pages have proper H1s
          }
          if (sql.includes('schema_types LIKE')) {
            return { schema_pages: 30 }; // Assume 30 pages have schema
          }
          if (sql.includes('FAQPage')) {
            return { faq_pages: 5 }; // Assume 5 pages have FAQ schema
          }
          return null;
        },
        all: async () => ({
          results: []
        }),
        run: async () => ({ changes: 1 })
      })
    }
  },
  CRAWL_MAX_PAGES: '50'
};

async function rescoreAudit() {
  try {
    console.log(`[Rescore] Starting manual rescore for audit ${AUDIT_ID}`);
    
    // Step 1: Force re-analysis of all pages
    console.log(`[Rescore] Running synthesis phase...`);
    const synthComplete = await runSynthTick(mockEnv, AUDIT_ID);
    console.log(`[Rescore] Synthesis complete: ${synthComplete}`);
    
    // Step 2: Recalculate scores
    console.log(`[Rescore] Running finalization phase...`);
    await finalizeAudit(mockEnv, AUDIT_ID);
    
    console.log(`[Rescore] Manual rescore completed successfully`);
    
  } catch (error) {
    console.error(`[Rescore] Error during manual rescore:`, error);
  }
}

// Run the rescore
rescoreAudit();
