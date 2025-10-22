// Quick backfill runner - uses wrangler's env directly
async function runBackfill(env) {
  const { backfillMultipleAudits } = await import('./src/scripts/backfillChecks.ts');
  
  const auditIds = [
    "5b83c3da-adf2-44c5-b14e-807f44140e02", // Progressive
    "c0726395-7f01-4a33-b2b2-2f375a01e43c", // Lennar
    "508e0cc4-b76f-455b-942d-3dda108c3f75"  // Walmart
  ];
  
  console.log('Starting backfill for', auditIds.length, 'audits...');
  const results = await backfillMultipleAudits(env, auditIds);
  
  console.log('\n=== BACKFILL RESULTS ===');
  results.forEach(r => {
    console.log(`${r.auditId}: ${r.status}`, r.processed ? `(${r.processed} pages)` : '');
  });
  
  return results;
}

export default {
  async fetch(req, env) {
    const results = await runBackfill(env);
    return Response.json(results);
  }
};
