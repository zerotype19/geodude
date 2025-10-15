/**
 * Reliable self-continuation helper with retries
 * Ensures audit phases can reliably continue processing across multiple ticks
 */

export async function selfContinue(env: any, auditId: string): Promise<boolean> {
  const url = (env.SELF_URL?.replace(/\/$/, '') || 'https://api.optiview.ai') + '/internal/audits/continue';
  const body = JSON.stringify({ auditId });

  let lastErr: any = null;
  for (let i = 0; i < 3; i++) {
    try {
      console.log(`[SelfContinue] Attempt ${i + 1}/3 for audit ${auditId}`);
      
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.INTERNAL_TOKEN || 'internal-token'}`
        },
        body
      });
      
      if (res.ok) {
        console.log(`[SelfContinue] Successfully dispatched continuation for audit ${auditId}`);
        return true;
      }
      
      lastErr = new Error(`selfContinue non-200: ${res.status}`);
      console.error(`[SelfContinue] HTTP ${res.status} for audit ${auditId}:`, await res.text());
    } catch (e) {
      lastErr = e;
      console.error(`[SelfContinue] Attempt ${i + 1} failed for audit ${auditId}:`, e);
    }
    
    // Short jittered backoff
    if (i < 2) {
      const backoff = 250 * (i + 1) + Math.random() * 100;
      await new Promise(r => setTimeout(r, backoff));
    }
  }
  
  // Surface a log (do NOT advance phase)
  console.error('SELF_CONTINUE_FAILED', { auditId, err: String(lastErr) });
  return false;
}
