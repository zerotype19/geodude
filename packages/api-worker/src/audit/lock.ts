/**
 * Single-Flight Lock per Audit
 * Prevents overlapping ticks from running simultaneously
 */

export async function tryAcquireLock(db: any, auditId: string): Promise<boolean> {
  // expire locks after 30s (more generous timeout)
  await db.prepare(`
    DELETE FROM audit_locks
    WHERE audit_id = ? AND locked_until < datetime('now')
  `).bind(auditId).run();

  // try to acquire lock
  const got = await db.prepare(`
    INSERT OR IGNORE INTO audit_locks (audit_id, locked_until)
    VALUES (?, datetime('now', '+30 seconds'))
  `).bind(auditId).run();

  return got.meta?.changes > 0;
}

export async function releaseLock(db: any, auditId: string): Promise<void> {
  await db.prepare(`DELETE FROM audit_locks WHERE audit_id = ?`)
    .bind(auditId).run();
}