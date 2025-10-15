/**
 * Idempotency lock helpers for audit continuation
 * Prevents double continuations and race conditions
 */

export async function tryAcquireLock(env: any, auditId: string, ttlMs = 45000): Promise<boolean> {
  const now = Date.now();
  const until = new Date(now + ttlMs).toISOString();
  
  const row = await env.DB.prepare(
    `SELECT locked_until FROM audit_locks WHERE audit_id=?1`
  ).bind(auditId).first<any>();

  if (!row) {
    // No lock exists, acquire it
    await env.DB.prepare(
      `INSERT INTO audit_locks(audit_id, locked_until) VALUES(?1, ?2)`
    ).bind(auditId, until).run();
    console.log(`[Lock] Acquired new lock for audit ${auditId} until ${until}`);
    return true;
  }

  const expired = !row.locked_until || Date.parse(row.locked_until) <= now;
  if (expired) {
    // Lock expired, update it
    await env.DB.prepare(
      `UPDATE audit_locks SET locked_until=?2 WHERE audit_id=?1`
    ).bind(auditId, until).run();
    console.log(`[Lock] Renewed expired lock for audit ${auditId} until ${until}`);
    return true;
  }
  
  console.log(`[Lock] Lock busy for audit ${auditId} until ${row.locked_until}`);
  return false;
}

export async function releaseLock(env: any, auditId: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE audit_locks SET locked_until=NULL WHERE audit_id=?1`
  ).bind(auditId).run();
  console.log(`[Lock] Released lock for audit ${auditId}`);
}
