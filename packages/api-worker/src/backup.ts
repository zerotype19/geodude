/**
 * D1 to R2 Backup Utility
 * Exports audit data to R2 for disaster recovery
 */

interface Env {
  DB: D1Database;
  R2_BACKUPS: R2Bucket;
}

async function dumpTable(env: Env, table: string, sinceEpoch?: number): Promise<string> {
  const where = sinceEpoch ? " WHERE created_at >= ?" : "";
  const stmt = `SELECT * FROM ${table}${where}`;
  
  const res = sinceEpoch
    ? await env.DB.prepare(stmt).bind(sinceEpoch).all()
    : await env.DB.prepare(stmt).all();
  
  return (res.results ?? []).map((r: any) => JSON.stringify(r)).join("\n");
}

export async function backupToR2(env: Env): Promise<void> {
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const prefix = `backups/${day}`;
  const now = Math.floor(Date.now() / 1000);
  
  // Last 8 days to be safe with cron drift
  const since = now - 8 * 24 * 3600;

  const tables = ["audits", "audit_pages", "audit_issues", "citations"];
  
  console.log(`Starting backup for ${day}...`);
  
  const payloads = await Promise.all(
    tables.map(t => dumpTable(env, t, since))
  );

  await Promise.all(
    tables.map((t, i) =>
      env.R2_BACKUPS.put(`${prefix}/${t}.jsonl`, payloads[i], {
        httpMetadata: { contentType: "application/json" },
      })
    )
  );
  
  console.log(`backup complete -> ${prefix} (${tables.length} tables)`);
}

