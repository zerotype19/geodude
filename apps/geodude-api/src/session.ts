// Session management utilities for the API
export function getOrSetSession(req: Request, headers: Headers): string {
  const cookies = req.headers.get("cookie") || "";
  const m = cookies.match(/geodude_ses=([A-Za-z0-9_-]+)/);
  const sid = m?.[1] ?? crypto.randomUUID();
  if (!m) {
    headers.append("Set-Cookie", `geodude_ses=${sid}; Path=/; Max-Age=${30 * 86400}; SameSite=Lax`);
  }
  return sid;
}

export async function insertClick(db: D1Database, row: any) {
  try {
    await db.prepare(`
      INSERT INTO click (ts, src, model, pid, geo, ua, ip, asn, dest, session_id, org_id, project_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      row.ts,
      row.src,
      row.model,
      row.pid,
      row.geo,
      row.ua,
      row.ip,
      row.asn,
      row.dest,
      row.session_id,
      row.org_id,
      row.project_id
    ).run();
  } catch (e) {
    console.error("Failed to insert click:", e);
  }
}
