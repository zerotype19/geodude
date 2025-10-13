/**
 * Assistant Visibility Service - Phase Next
 * Manages assistant runs, prompts, and citation tracking
 */

import { AssistantConnector, getConnector, AssistantRun, AssistantPrompt, AssistantOutput, ParsedCitation } from './index';

export interface VisibilityService {
  createRun(projectId: string, assistant: string): Promise<AssistantRun>;
  addPrompt(runId: string, promptText: string, intentTag?: string): Promise<AssistantPrompt>;
  executeRun(runId: string): Promise<void>;
  getCitations(projectId: string, since?: string): Promise<ParsedCitation[]>;
}

export class AssistantVisibilityService implements VisibilityService {
  constructor(
    private db: D1Database,
    private kv: KVNamespace
  ) {}

  async createRun(projectId: string, assistant: string): Promise<AssistantRun> {
    const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const run: AssistantRun = {
      id: runId,
      projectId,
      assistant: assistant as any,
      runStartedAt: new Date().toISOString(),
      status: 'queued'
    };

    await this.db.prepare(
      `INSERT INTO assistant_runs (id, project_id, assistant, run_started_at, status)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(run.id, run.projectId, run.assistant, run.runStartedAt, run.status).run();

    return run;
  }

  async addPrompt(runId: string, promptText: string, intentTag?: string): Promise<AssistantPrompt> {
    const promptId = `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const prompt: AssistantPrompt = {
      id: promptId,
      runId,
      promptText,
      intentTag,
      locale: 'en'
    };

    await this.db.prepare(
      `INSERT INTO assistant_prompts (id, run_id, prompt_text, intent_tag, locale)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(prompt.id, prompt.runId, prompt.promptText, prompt.intentTag, prompt.locale).run();

    return prompt;
  }

  async executeRun(runId: string): Promise<void> {
    // Update run status to running
    await this.db.prepare(
      `UPDATE assistant_runs SET status = 'running' WHERE id = ?`
    ).bind(runId).run();

    try {
      // Get run details
      const run = await this.db.prepare(
        `SELECT * FROM assistant_runs WHERE id = ?`
      ).bind(runId).first<AssistantRun>();

      if (!run) {
        throw new Error('Run not found');
      }

      // Get prompts for this run
      const prompts = await this.db.prepare(
        `SELECT * FROM assistant_prompts WHERE run_id = ?`
      ).bind(runId).all<AssistantPrompt>();

      // Execute each prompt
      for (const prompt of prompts.results) {
        await this.executePrompt(prompt, run.assistant);
      }

      // Update run status to success
      const runDuration = Date.now() - new Date(run.runStartedAt).getTime();
      await this.db.prepare(
        `UPDATE assistant_runs 
         SET status = 'success', run_duration_ms = ?
         WHERE id = ?`
      ).bind(runDuration, runId).run();

    } catch (error) {
      // Update run status to error
      await this.db.prepare(
        `UPDATE assistant_runs 
         SET status = 'error'
         WHERE id = ?`
      ).bind(runId).run();
      throw error;
    }
  }

  private async executePrompt(prompt: AssistantPrompt, assistant: string): Promise<void> {
    const connector = getConnector(assistant);
    
    try {
      // Fetch results from assistant
      const output = await connector.fetchResults(prompt.promptText, {
        promptId: prompt.id
      });

      // Store output
      await this.db.prepare(
        `INSERT INTO assistant_outputs (id, prompt_id, raw_payload, parse_version, parsed_at)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(
        output.id,
        output.promptId,
        output.rawPayload,
        output.parseVersion,
        output.parsedAt
      ).run();

      // Parse and store citations
      const citations = connector.parseCitations(output);
      await this.storeCitations(citations, prompt.runId, prompt.id);

    } catch (error) {
      console.error(`Error executing prompt ${prompt.id}:`, error);
      throw error;
    }
  }

  private async storeCitations(citations: ParsedCitation[], runId: string, promptId: string): Promise<void> {
    for (const citation of citations) {
      await this.db.prepare(
        `INSERT INTO ai_citations (id, project_id, prompt_id, rank, source_url, source_domain, title, snippet, is_own_domain, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        `cite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        '', // project_id - would need to be passed in
        promptId,
        citation.rank,
        citation.url,
        citation.domain,
        citation.title,
        citation.snippet,
        0, // is_own_domain - would need to be calculated
        new Date().toISOString()
      ).run();
    }
  }

  async getCitations(projectId: string, since?: string): Promise<ParsedCitation[]> {
    let query = `
      SELECT source_url, source_domain, title, snippet, rank, occurred_at
      FROM ai_citations
      WHERE project_id = ?
    `;
    const params = [projectId];

    if (since) {
      query += ` AND occurred_at >= ?`;
      params.push(since);
    }

    query += ` ORDER BY occurred_at DESC LIMIT 100`;

    const result = await this.db.prepare(query).bind(...params).all<{
      source_url: string;
      source_domain: string;
      title: string;
      snippet: string;
      rank: number;
      occurred_at: string;
    }>();

    return result.results.map(row => ({
      url: row.source_url,
      domain: row.source_domain,
      title: row.title,
      snippet: row.snippet,
      rank: row.rank
    }));
  }

  async getNextQueuedRun(): Promise<AssistantRun | null> {
    const result = await this.db.prepare(
      `SELECT id, project_id, assistant, run_started_at, run_duration_ms, status
       FROM assistant_runs 
       WHERE status = 'queued' 
       ORDER BY run_started_at ASC 
       LIMIT 1`
    ).first();

    return result as AssistantRun | null;
  }

  async claimNextQueuedRun(): Promise<AssistantRun | null> {
    // Atomically claim the next queued run
    const result = await this.db.prepare(
      `UPDATE assistant_runs
       SET status = 'running'
       WHERE id = (
         SELECT id FROM assistant_runs
         WHERE status = 'queued'
         ORDER BY run_started_at ASC
         LIMIT 1
       ) AND status = 'queued'
       RETURNING id, project_id, assistant, run_started_at, run_duration_ms, status`
    ).first();

    if (!result) {
      return null;
    }

    return result as AssistantRun;
  }

  async getRun(runId: string): Promise<AssistantRun | null> {
    const result = await this.db.prepare(
      `SELECT id, project_id, assistant, run_started_at, run_duration_ms, status
       FROM assistant_runs 
       WHERE id = ?`
    ).bind(runId).first();

    return result as AssistantRun | null;
  }

  async markRunRunning(runId: string): Promise<void> {
    await this.db.prepare(
      `UPDATE assistant_runs 
       SET status = 'running' 
       WHERE id = ? AND status = 'queued'`
    ).bind(runId).run();
  }

  async markRunDone(runId: string, status: 'success' | 'error', error?: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.prepare(
      `UPDATE assistant_runs 
       SET status = ?, run_duration_ms = ?, error = ?
       WHERE id = ?`
    ).bind(status, null, error || null, runId).run();
  }

  async getPromptsForRun(runId: string): Promise<AssistantPrompt[]> {
    const result = await this.db.prepare(
      `SELECT id, run_id, prompt_text, intent_tag, locale
       FROM assistant_prompts 
       WHERE run_id = ?`
    ).bind(runId).all();

    return result.results as AssistantPrompt[];
  }

  async saveAssistantOutput(promptId: string, rawPayload: string): Promise<void> {
    const outputId = `output_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    await this.db.prepare(
      `INSERT INTO assistant_outputs (id, prompt_id, raw_payload, parse_version, parsed_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(outputId, promptId, rawPayload, '1.0', now).run();
  }

  async saveCitation(projectId: string, citation: {
    source_url: string;
    source_domain: string;
    title: string;
    snippet: string;
    rank: number;
  }, promptId?: string, assistant?: string): Promise<void> {
    const citationId = `cite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    await this.db.prepare(
      `INSERT INTO ai_citations (id, project_id, prompt_id, rank, source_url, source_domain, title, snippet, is_own_domain, occurred_at, assistant)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      citationId, 
      projectId, 
      promptId || null, 
      citation.rank, 
      citation.source_url, 
      citation.source_domain, 
      citation.title, 
      citation.snippet, 
      0, // is_own_domain
      now,
      assistant || 'unknown'
    ).run();
  }
}
