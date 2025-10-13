/**
 * Visibility Run Processor - Phase Next
 * Processes queued visibility runs and executes assistant connectors
 */

import { AssistantVisibilityService } from '../assistant-connectors/visibility-service';
import { getEnabledConnector } from '../services/visibility/connectors';
import { MVAService } from '../assistant-connectors/mva-service';

export interface Env {
  DB: D1Database;
  PROMPT_PACKS: KVNamespace;
  ASSISTANT_SCHEDULES: KVNamespace;
  HEURISTICS: KVNamespace;
  FEATURE_ASSISTANT_VISIBILITY?: string;
  FEATURE_EEAT_SCORING?: string;
  BROWSER_CLUSTER_MAX?: string;
  FETCH_TIMEOUT_MS?: string;
  VISIBILITY_RATE_LIMIT_PER_PROJECT?: string;
  ALLOWED_ANSWER_ENGINES?: string;
  GA4_REGEX_SNIPPET_URL?: string;
}

export async function processRun(env: Env, ctx?: ExecutionContext, runId?: string) {
  console.log(`[VisibilityProcessor] Start processing run: ${runId || 'next queued'}, visibility: ${env.FEATURE_ASSISTANT_VISIBILITY}`);
  
  try {
    // Guard against missing dependencies
    if (!env.DB) {
      throw new Error('Database not available');
    }
    if (!env.PROMPT_PACKS) {
      throw new Error('PROMPT_PACKS KV not available');
    }
    
    const visibilityService = new AssistantVisibilityService(env.DB, env.PROMPT_PACKS);
    
    // Get the run to process
    let run;
    if (runId) {
      run = await visibilityService.getRun(runId);
      if (!run) {
        console.log(`[VisibilityProcessor] Run ${runId} not found`);
        return { ok: false, error: "run not found" };
      }
    } else {
      // Atomically claim the next queued run
      run = await visibilityService.claimNextQueuedRun();
      if (!run) {
        console.log('[VisibilityProcessor] No queued runs found');
        return { ok: true, msg: "no queued runs" };
      }
    }

    console.log(`[VisibilityProcessor] Processing run: ${run.id}, project: ${run.project_id}`);

    // Allowlist + flag guard
    const enabled = await isProjectEnabled(env, run.project_id);
    console.log(`[VisibilityProcessor] Project ${run.project_id} enabled: ${enabled}`);
    
    if (env.FEATURE_ASSISTANT_VISIBILITY !== 'true') {
      console.warn(`[VisibilityProcessor] Feature disabled - visibility: ${env.FEATURE_ASSISTANT_VISIBILITY}`);
      if (!runId) {
        await visibilityService.markRunDone(run.id, "error", "visibility feature disabled");
      }
      return { ok: false, error: "visibility feature disabled" };
    }
    
    if (!enabled) {
      console.warn(`[VisibilityProcessor] Project not allowlisted - project: ${run.project_id}`);
      if (!runId) {
        await visibilityService.markRunDone(run.id, "error", "project not allowlisted");
      }
      return { ok: false, error: "project not allowlisted" };
    }

    try {
                  // Check for timeout (5 minutes) - much more aggressive
                  const runAge = Date.now() - new Date(run.run_started_at).getTime();
                  const timeoutMs = 5 * 60 * 1000; // 5 minutes
                  
                  if (runAge > timeoutMs) {
                    console.warn(`[VisibilityProcessor] Run ${run.id} timed out after ${Math.round(runAge / 1000 / 60)} minutes`);
                    await visibilityService.markRunDone(run.id, "error", `timeout after ${Math.round(runAge / 1000 / 60)} minutes`);
                    return { ok: false, runId: run.id, status: "error", error: "timeout" };
                  }

      // Get prompts for this run
      const prompts = await visibilityService.getPromptsForRun(run.id);
      console.log(`[VisibilityProcessor] Found ${prompts.length} prompts for run ${run.id}`);

      if (prompts.length === 0) {
        console.warn(`[VisibilityProcessor] No prompts found for run ${run.id}`);
        await visibilityService.markRunDone(run.id, "error", "no prompts found");
        return { ok: false, runId: run.id, status: "error", error: "no prompts found" };
      }

      // Process each prompt
      for (const prompt of prompts) {
        console.log(`[VisibilityProcessor] Processing prompt: ${prompt.id}`);
        
        try {
          // Get enabled connector for this assistant
          const connector = getEnabledConnector(run.assistant, env);
          if (!connector) {
            console.warn(`[VisibilityProcessor] Connector disabled or unknown: ${run.assistant}`);
            continue;
          }

          // Call live connector
          console.log(`[VisibilityProcessor] Calling ${run.assistant} connector...`);
          const { answer, sources, raw } = await connector.ask(prompt.prompt_text, env);
          
          // Create normalized payload for backward compatibility
          const payload = JSON.stringify({
            answer,
            sources,
            raw
          });

          // Save assistant output
          await visibilityService.saveAssistantOutput(prompt.id, payload);
          console.log(`[VisibilityProcessor] Saved output for prompt ${prompt.id}`);

          // Parse citations from sources (already normalized)
          const citations = sources.map((source, index) => ({
            source_url: source.url,
            source_domain: new URL(source.url).hostname,
            title: source.title || `Citation ${index + 1}`,
            snippet: source.snippet || "",
            rank: index + 1
          }));
          
          console.log(`[VisibilityProcessor] Parsed ${citations.length} citations from prompt ${prompt.id}`);

          // Save citations
          for (const citation of citations) {
            await visibilityService.saveCitation(run.project_id, citation, prompt.id, run.assistant);
          }
        } catch (promptError) {
          console.error(`[VisibilityProcessor] Error processing prompt ${prompt.id}:`, promptError);
          // Continue with other prompts
        }
      }

      // Mark as success
      await visibilityService.markRunDone(run.id, "success");
      
      // Count outputs and citations for logging
      const outputCount = await visibilityService.db.prepare(
        `SELECT COUNT(*) as count FROM assistant_outputs WHERE prompt_id IN (
          SELECT id FROM assistant_prompts WHERE run_id = ?
        )`
      ).bind(run.id).first();
      
      const citationCount = await visibilityService.db.prepare(
        `SELECT COUNT(*) as count FROM ai_citations WHERE project_id = ? AND occurred_at >= datetime('now', '-1 hour')`
      ).bind(run.project_id).first();
      
      console.log(`[VisibilityProcessor] Done {runId: ${run.id}, outputs: ${outputCount?.count || 0}, citations: ${citationCount?.count || 0}}`);

      return { ok: true, runId: run.id, status: "success" };
    } catch (e) {
      console.error(`[VisibilityProcessor] Error processing run ${run.id}:`, e);
      const errorMessage = e instanceof Error ? e.stack || e.message : String(e);
      await visibilityService.markRunDone(run.id, "error", errorMessage);
      return { ok: false, runId: run.id, status: "error", error: errorMessage };
    }
  } catch (error) {
    console.error('[VisibilityProcessor] Fatal error:', error);
    const errorMessage = error instanceof Error ? error.stack || error.message : String(error);
    return { ok: false, error: errorMessage };
  }
}

async function isProjectEnabled(env: Env, projectId: string): Promise<boolean> {
  try {
    if (!env.PROMPT_PACKS) {
      console.warn('[VisibilityProcessor] PROMPT_PACKS not available, allowing project');
      return true; // Allow if KV not available
    }
    
    const enabledProjects = await env.PROMPT_PACKS.get('enabled_projects');
    if (!enabledProjects) {
      console.warn('[VisibilityProcessor] No enabled_projects key found, allowing project');
      return true; // Allow if no allowlist
    }
    
    const projects = JSON.parse(enabledProjects);
    return Array.isArray(projects) && projects.includes(projectId);
  } catch (error) {
    console.error('[VisibilityProcessor] Error checking allowlist:', error);
    return true; // Allow on error to prevent blocking
  }
}

// Note: Old simulation functions removed - now using live connectors
