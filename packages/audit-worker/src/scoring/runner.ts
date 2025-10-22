import { loadDom } from "./dom";
import { CHECKS } from "./registry";
import type { CheckInput, CheckResult } from "./checks.impl";

export function runChecksOnHtml(input: Omit<CheckInput, "__doc">): CheckResult[] {
  const { document } = loadDom(input.html);
  const enriched: CheckInput = { ...input, __doc: document };
  const out: CheckResult[] = [];
  for (const [id, fn] of CHECKS) {
    try { 
      out.push(fn(enriched)); 
    } catch (e: any) { 
      out.push({ 
        id: id as any, 
        scope: "page",
        score: 0, 
        status: "error", 
        details: { error: String(e) } 
      }); 
    }
  }
  return out;
}

