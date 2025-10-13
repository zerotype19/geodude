/**
 * Visibility Run Processor - Phase Next
 * Processes queued visibility runs and executes assistant connectors
 */

import { AssistantVisibilityService } from '../assistant-connectors/visibility-service';
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
          let payload = "";
          
          // Simulate assistant response (replace with actual connectors)
          if (run.assistant === "perplexity") {
            payload = await simulatePerplexityResponse(prompt.prompt_text);
          } else if (run.assistant === "chatgpt_search") {
            payload = await simulateChatGPTResponse(prompt.prompt_text);
          } else if (run.assistant === "copilot") {
            payload = await simulateCopilotResponse(prompt.prompt_text);
          } else {
            console.warn(`[VisibilityProcessor] Unknown assistant: ${run.assistant}`);
            continue;
          }

          // Save assistant output
          await visibilityService.saveAssistantOutput(prompt.id, payload);
          console.log(`[VisibilityProcessor] Saved output for prompt ${prompt.id}`);

          // Parse citations from payload
          const citations = parseCitations(payload, run.assistant);
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

async function simulatePerplexityResponse(prompt: string): Promise<string> {
  // Simulate Perplexity response with citations
  return JSON.stringify({
    answer: `Based on the query "${prompt}", here are the key insights:`,
    sources: [
      {
        title: "Generative Engine Optimization Guide",
        url: "https://example.com/geo-guide",
        snippet: "GEO is the practice of optimizing content for AI assistants..."
      },
      {
        title: "AI Citation Best Practices",
        url: "https://example.com/ai-citations",
        snippet: "Proper citation formatting helps AI assistants understand content..."
      }
    ],
    timestamp: new Date().toISOString()
  });
}

async function simulateChatGPTResponse(prompt: string): Promise<string> {
  // Simulate ChatGPT Search response
  return JSON.stringify({
    response: `Regarding "${prompt}", the key points are:`,
    references: [
      {
        title: "Answer Engine Optimization",
        url: "https://example.com/aeo-guide",
        excerpt: "AEO focuses on optimizing for AI-powered search engines..."
      }
    ],
    timestamp: new Date().toISOString()
  });
}

async function simulateCopilotResponse(prompt: string): Promise<string> {
  // Simulate Copilot response
  return JSON.stringify({
    content: `For the question "${prompt}", consider these resources:`,
    links: [
      {
        title: "AI Assistant Optimization",
        url: "https://example.com/ai-optimization",
        description: "Comprehensive guide to AI assistant optimization..."
      }
    ],
    timestamp: new Date().toISOString()
  });
}

function parseCitations(payload: string, assistant: string): Array<{
  source_url: string;
  source_domain: string;
  title: string;
  snippet: string;
  rank: number;
}> {
  try {
    const data = JSON.parse(payload);
    const citations = [];
    
    if (assistant === "perplexity" && data.sources) {
      data.sources.forEach((source: any, index: number) => {
        citations.push({
          source_url: source.url,
          source_domain: new URL(source.url).hostname,
          title: source.title,
          snippet: source.snippet,
          rank: index + 1
        });
      });
    } else if (assistant === "chatgpt_search" && data.references) {
      data.references.forEach((ref: any, index: number) => {
        citations.push({
          source_url: ref.url,
          source_domain: new URL(ref.url).hostname,
          title: ref.title,
          snippet: ref.excerpt,
          rank: index + 1
        });
      });
    } else if (assistant === "copilot" && data.links) {
      data.links.forEach((link: any, index: number) => {
        citations.push({
          source_url: link.url,
          source_domain: new URL(link.url).hostname,
          title: link.title,
          snippet: link.description,
          rank: index + 1
        });
      });
    }
    
    return citations;
  } catch (error) {
    console.error('[VisibilityProcessor] Error parsing citations:', error);
    return [];
  }
}
