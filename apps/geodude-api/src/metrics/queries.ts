export async function qSessionsOpened5m(db: D1Database, orgId: string) {
  // Count sessions opened in last 5 minutes for this org
  const sql = `
    WITH org_projects AS (
      SELECT id FROM project WHERE org_id = ?
    )
    SELECT COUNT(*) AS c
    FROM session_v1
    WHERE project_id IN (SELECT id FROM org_projects)
      AND started_at >= datetime('now', '-5 minutes')
  `;
  const r = await db.prepare(sql).bind(orgId).first<{ c: number }>();
  return r?.c || 0;
}

export async function qSessionsClosed5m(db: D1Database, orgId: string) {
  const sql = `
    WITH org_projects AS (
      SELECT id FROM project WHERE org_id = ?
    )
    SELECT COUNT(*) AS c
    FROM session_v1
    WHERE project_id IN (SELECT id FROM org_projects)
      AND ended_at IS NOT NULL
      AND ended_at >= datetime('now', '-5 minutes')
  `;
  const r = await db.prepare(sql).bind(orgId).first<{ c: number }>();
  return r?.c || 0;
}

export async function qSessionEventsAttached5m(db: D1Database, orgId: string) {
  const sql = `
    WITH org_projects AS (
      SELECT id FROM project WHERE org_id = ?
    )
    SELECT COUNT(*) AS c
    FROM session_event_map sem
    JOIN interaction_events ie ON ie.id = sem.event_id
    WHERE ie.project_id IN (SELECT id FROM org_projects)
      AND ie.occurred_at >= datetime('now','-5 minutes')
  `;
  const r = await db.prepare(sql).bind(orgId).first<{ c: number }>();
  return r?.c || 0;
}

export async function qProjectsCreated5m(db: D1Database, orgId: string) {
  const sql = `
    SELECT COUNT(*) AS c
    FROM project
    WHERE org_id = ?
      AND datetime(created_ts/1000, 'unixepoch') >= datetime('now','-5 minutes')
  `;
  const r = await db.prepare(sql).bind(orgId).first<{ c: number }>();
  return r?.c || 0;
}

export async function qLastCron(env: { METRICS: KVNamespace }) {
  return (await env.METRICS.get("cron:last")) || null;
}
