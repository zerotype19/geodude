import { answerWithCitations } from "../services/providers/orchestrator";

export async function handleCitations(req: Request, env: any) {
  const { query } = await req.json().catch(() => ({}));
  
  if (!query) {
    return json({ ok: false, error: "missing query" }, 400);
  }
  
  try {
    const out = await answerWithCitations(env, query);
    return json({ ok: true, ...out });
  } catch (e: any) {
    console.error('[citations] Error:', e);
    return json({ ok: false, error: String(e) }, 500);
  }
}

const json = (body: any, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });

