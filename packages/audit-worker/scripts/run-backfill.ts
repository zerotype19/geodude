/**
 * Direct backfill script - bypasses API auth
 * Run with: wrangler dev --local scripts/run-backfill.ts
 */

import { backfillMultipleAudits } from '../src/scripts/backfillChecks';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/backfill') {
      const auditIds = [
        "5b83c3da-adf2-44c5-b14e-807f44140e02", // Progressive
        "c0726395-7f01-4a33-b2b2-2f375a01e43c", // Lennar
        "508e0cc4-b76f-455b-942d-3dda108c3f75"  // Walmart
      ];
      
      console.log('[BACKFILL] Starting batch backfill for', auditIds.length, 'audits');
      
      const results = await backfillMultipleAudits(env, auditIds);
      
      return new Response(JSON.stringify(results, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Call /backfill to run', { status: 200 });
  }
};

