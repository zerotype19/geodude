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

export async function processRun(env: Env, ctx: ExecutionContext, runId?: string) {
  console.log(`[VisibilityProcessor] Processing run: ${runId || 'next queued'}`);
  
  try {
    const visibilityService = new AssistantVisibilityService(env.DB, env.PROMPT_PACKS);
    
    // Get the run to process
    let run;
    if (runId) {
      run = await visibilityService.getRun(runId);
    } else {
      run = await visibilityService.getNextQueuedRun();
    }
    
    if (!run) {
      console.log('[VisibilityProcessor] No queued runs found');
      return { ok: true, msg: "no queued runs" };
    }

    console.log(`[VisibilityProcessor] Found run: ${run.id}, project: ${run.project_id}`);

    // Allowlist + flag guard
    const enabled = await isProjectEnabled(env, run.project_id);
    if (env.FEATURE_ASSISTANT_VISIBILITY !== 'true' || !enabled) {
      console.log(`[VisibilityProcessor] Run blocked - visibility: ${env.FEATURE_ASSISTANT_VISIBILITY}, enabled: ${enabled}`);
      return { ok: false, error: "visibility disabled or project not allowlisted" };
    }

    // Mark as running
    await visibilityService.markRunRunning(run.id);
    console.log(`[VisibilityProcessor] Marked run ${run.id} as running`);

    try {
      // Get prompts for this run
      const prompts = await visibilityService.getPromptsForRun(run.id);
      console.log(`[VisibilityProcessor] Found ${prompts.length} prompts for run ${run.id}`);

      // Process each prompt
      for (const prompt of prompts) {
        console.log(`[VisibilityProcessor] Processing prompt: ${prompt.id}`);
        
        let payload = "";
        
        // Simulate assistant response (replace with actual connectors)
        if (run.assistant === "perplexity") {
          payload = await simulatePerplexityResponse(prompt.prompt_text);
        } else if (run.assistant === "chatgpt_search") {
          payload = await simulateChatGPTResponse(prompt.prompt_text);
        } else if (run.assistant === "copilot") {
          payload = await simulateCopilotResponse(prompt.prompt_text);
        }

        // Save assistant output
        await visibilityService.saveAssistantOutput(prompt.id, payload);
        console.log(`[VisibilityProcessor] Saved output for prompt ${prompt.id}`);

        // Parse citations from payload
        const citations = parseCitations(payload, run.assistant);
        console.log(`[VisibilityProcessor] Parsed ${citations.length} citations from prompt ${prompt.id}`);

        // Save citations
        for (const citation of citations) {
          await visibilityService.saveCitation(run.project_id, citation, prompt.id);
        }
      }

      // Mark as success
      await visibilityService.markRunDone(run.id, "success");
      console.log(`[VisibilityProcessor] Marked run ${run.id} as success`);

      return { ok: true, runId: run.id, status: "success" };
    } catch (e) {
      console.error(`[VisibilityProcessor] Error processing run ${run.id}:`, e);
      await visibilityService.markRunDone(run.id, "error", String(e));
      return { ok: false, runId: run.id, status: "error", error: String(e) };
    }
  } catch (error) {
    console.error('[VisibilityProcessor] Fatal error:', error);
    return { ok: false, error: String(error) };
  }
}

async function isProjectEnabled(env: Env, projectId: string): Promise<boolean> {
  try {
    const enabledProjects = await env.PROMPT_PACKS.get('enabled_projects');
    if (!enabledProjects) return false;
    
    const projects = JSON.parse(enabledProjects);
    return Array.isArray(projects) && projects.includes(projectId);
  } catch (error) {
    console.error('[VisibilityProcessor] Error checking allowlist:', error);
    return false;
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
