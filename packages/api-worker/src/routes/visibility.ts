/**
 * Visibility API Routes - Phase Next
 * Handles assistant visibility tracking and MVA calculations
 */

import { AssistantVisibilityService } from '../assistant-connectors/visibility-service';
import { MVAService } from '../assistant-connectors/mva-service';
import { CloudflareConfigGenerator } from '../cloudflare-config-generator';

export interface VisibilityRoutes {
  createRun: (request: Request) => Promise<Response>;
  getRun: (request: Request, runId: string) => Promise<Response>;
  getCitations: (request: Request) => Promise<Response>;
  getMVAMetrics: (request: Request) => Promise<Response>;
  generateCloudflareConfig: (request: Request) => Promise<Response>;
  generateGA4Config: (request: Request) => Promise<Response>;
  rebuildMetrics: (request: Request) => Promise<Response>;
}

export function createVisibilityRoutes(
  db: D1Database,
  kv: KVNamespace
): VisibilityRoutes {
  const visibilityService = new AssistantVisibilityService(db, kv);
  const mvaService = new MVAService(db, kv);
  const configGenerator = new CloudflareConfigGenerator();

  return {
    async createRun(request: Request): Promise<Response> {
      try {
        const { projectId, assistant, prompts } = await request.json();
        
        if (!projectId || !assistant || !prompts) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Create run
        const run = await visibilityService.createRun(projectId, assistant);
        
        // Add prompts
        const promptIds = [];
        for (const prompt of prompts) {
          const promptObj = await visibilityService.addPrompt(
            run.id,
            prompt.text,
            prompt.intentTag
          );
          promptIds.push(promptObj.id);
        }

        // Execute run asynchronously
        visibilityService.executeRun(run.id).catch(error => {
          console.error('Error executing run:', error);
        });

        return new Response(JSON.stringify({
          runId: run.id,
          status: run.status,
          promptIds
        }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ 
          error: 'Failed to create run',
          details: error instanceof Error ? error.message : String(error)
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    },

    async getRun(request: Request, runId: string): Promise<Response> {
      try {
        const run = await db.prepare(
          `SELECT * FROM assistant_runs WHERE id = ?`
        ).bind(runId).first();

        if (!run) {
          return new Response(JSON.stringify({ error: 'Run not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Get prompts for this run
        const prompts = await db.prepare(
          `SELECT * FROM assistant_prompts WHERE run_id = ?`
        ).bind(runId).all();

        // Get outputs for this run
        const outputs = await db.prepare(`
          SELECT ao.*, ap.prompt_text, ap.intent_tag
          FROM assistant_outputs ao
          JOIN assistant_prompts ap ON ao.prompt_id = ap.id
          WHERE ap.run_id = ?
        `).bind(runId).all();

        return new Response(JSON.stringify({
          run,
          prompts: prompts.results,
          outputs: outputs.results
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ 
          error: 'Failed to get run',
          details: error instanceof Error ? error.message : String(error)
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    },

    async getCitations(request: Request): Promise<Response> {
      try {
        const url = new URL(request.url);
        const projectId = url.searchParams.get('project_id');
        const since = url.searchParams.get('since');
        const assistant = url.searchParams.get('assistant');

        if (!projectId) {
          return new Response(JSON.stringify({ error: 'project_id is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        let query = `
          SELECT c.*, ar.assistant, ap.prompt_text, ap.intent_tag
          FROM ai_citations c
          JOIN assistant_prompts ap ON c.prompt_id = ap.id
          JOIN assistant_runs ar ON ap.run_id = ar.id
          WHERE ar.project_id = ?
        `;
        const params = [projectId];

        if (assistant) {
          query += ` AND ar.assistant = ?`;
          params.push(assistant);
        }

        if (since) {
          query += ` AND c.occurred_at >= ?`;
          params.push(since);
        }

        query += ` ORDER BY c.occurred_at DESC LIMIT 100`;

        const citations = await db.prepare(query).bind(...params).all();

        return new Response(JSON.stringify({
          citations: citations.results
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ 
          error: 'Failed to get citations',
          details: error instanceof Error ? error.message : String(error)
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    },

    async getMVAMetrics(request: Request): Promise<Response> {
      try {
        const url = new URL(request.url);
        const projectId = url.searchParams.get('project_id');
        const assistant = url.searchParams.get('assistant');
        const days = parseInt(url.searchParams.get('days') || '30');

        if (!projectId) {
          return new Response(JSON.stringify({ error: 'project_id is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        let query = `
          SELECT * FROM ai_visibility_metrics
          WHERE project_id = ?
        `;
        const params = [projectId];

        if (assistant) {
          query += ` AND assistant = ?`;
          params.push(assistant);
        }

        query += ` ORDER BY day DESC LIMIT ?`;
        params.push(days);

        const metrics = await db.prepare(query).bind(...params).all();

        return new Response(JSON.stringify({
          metrics: metrics.results
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ 
          error: 'Failed to get MVA metrics',
          details: error instanceof Error ? error.message : String(error)
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    },

    async generateCloudflareConfig(request: Request): Promise<Response> {
      try {
        const { domain, config } = await request.json();
        
        if (!domain) {
          return new Response(JSON.stringify({ error: 'domain is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const cloudflareConfig = configGenerator.generateFullConfig(domain, config || {
          allowedBots: configGenerator['DEFAULT_BOTS'],
          rateLimit: 1,
          cacheTtl: 300,
          bypassChallenges: true
        });

        return new Response(JSON.stringify(cloudflareConfig), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ 
          error: 'Failed to generate Cloudflare config',
          details: error instanceof Error ? error.message : String(error)
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    },

    async generateGA4Config(request: Request): Promise<Response> {
      try {
        const channelGroup = configGenerator.generateGA4ChannelGroup();
        const explorationTemplate = configGenerator.generateGA4ExplorationTemplate();

        return new Response(JSON.stringify({
          channelGroup,
          explorationTemplate
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ 
          error: 'Failed to generate GA4 config',
          details: error instanceof Error ? error.message : String(error)
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    },

    async rebuildMetrics(request: Request): Promise<Response> {
      try {
        const url = new URL(request.url);
        const projectId = url.searchParams.get('projectId');
        
        if (!projectId) {
          return new Response(JSON.stringify({ error: 'projectId required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Calculate metrics for today
        const today = new Date().toISOString().split('T')[0];
        
        // Get citations for today
        const citations = await db.prepare(
          `SELECT assistant, COUNT(*) as mentions_count, COUNT(DISTINCT source_url) as unique_urls
           FROM ai_citations 
           WHERE project_id = ? AND occurred_at >= ? AND occurred_at < ?
           GROUP BY assistant`
        ).bind(projectId, `${today} 00:00:00`, `${today} 23:59:59`).all();

        // Calculate MVA (simplified)
        const mvaDaily = citations.results.length > 0 ? 
          citations.results.reduce((sum, row) => sum + (row.mentions_count * 0.1), 0) : 0;

        // Store metrics
        for (const row of citations.results) {
          await db.prepare(
            `INSERT OR REPLACE INTO ai_visibility_metrics 
             (day, project_id, assistant, mentions_count, unique_urls, mva_daily, impression_estimate, competitor_domains)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            today,
            projectId,
            row.assistant,
            row.mentions_count,
            row.unique_urls,
            mvaDaily,
            mvaDaily * 100, // Simple impression estimate
            JSON.stringify([]) // No competitor domains for now
          ).run();
        }

        return new Response(JSON.stringify({
          success: true,
          projectId,
          day: today,
          metrics: citations.results
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ 
          error: 'Failed to rebuild metrics',
          details: error instanceof Error ? error.message : String(error)
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  };
}
