/**
 * Assistant Connectors - Phase Next
 * Connectors for different AI assistants to track visibility
 */

export interface AssistantRun {
  id: string;
  projectId: string;
  assistant: 'perplexity' | 'chatgpt_search' | 'copilot';
  runStartedAt: string;
  runDurationMs?: number;
  status: 'queued' | 'running' | 'success' | 'error';
}

export interface AssistantPrompt {
  id: string;
  runId: string;
  promptText: string;
  intentTag?: string;
  locale: string;
}

export interface AssistantOutput {
  id: string;
  promptId: string;
  rawPayload: string;
  parseVersion: string;
  parsedAt?: string;
}

export interface ParsedCitation {
  url: string;
  title: string;
  snippet: string;
  rank: number;
  domain: string;
}

export interface AssistantConnector {
  name: string;
  fetchResults(prompt: string, options?: any): Promise<AssistantOutput>;
  parseCitations(output: AssistantOutput): ParsedCitation[];
  takeScreenshot(prompt: string): Promise<string>;
}

export class PerplexityConnector implements AssistantConnector {
  name = 'perplexity';
  
  async fetchResults(prompt: string, options?: any): Promise<AssistantOutput> {
    // This would integrate with Perplexity's API
    // For now, return mock data
    const mockResponse = {
      id: `pplx_${Date.now()}`,
      promptId: options?.promptId || '',
      rawPayload: JSON.stringify({
        query: prompt,
        sources: [
          {
            url: 'https://example.com/article1',
            title: 'Example Article 1',
            snippet: 'This is a sample snippet from the article...',
            rank: 1
          }
        ]
      }),
      parseVersion: '1.0',
      parsedAt: new Date().toISOString()
    };
    
    return mockResponse;
  }
  
  parseCitations(output: AssistantOutput): ParsedCitation[] {
    try {
      const data = JSON.parse(output.rawPayload);
      return (data.sources || []).map((source: any, index: number) => ({
        url: source.url,
        title: source.title,
        snippet: source.snippet,
        rank: source.rank || index + 1,
        domain: new URL(source.url).hostname
      }));
    } catch (error) {
      return [];
    }
  }
  
  async takeScreenshot(prompt: string): Promise<string> {
    // This would take a screenshot of the Perplexity results page
    // For now, return a placeholder
    return `screenshot_${this.name}_${Date.now()}.png`;
  }
}

export class ChatGPTSearchConnector implements AssistantConnector {
  name = 'chatgpt_search';
  
  async fetchResults(prompt: string, options?: any): Promise<AssistantOutput> {
    // This would integrate with ChatGPT Search
    const mockResponse = {
      id: `chatgpt_${Date.now()}`,
      promptId: options?.promptId || '',
      rawPayload: JSON.stringify({
        query: prompt,
        results: [
          {
            url: 'https://example.com/article2',
            title: 'Example Article 2',
            snippet: 'This is a sample snippet from ChatGPT search...',
            rank: 1
          }
        ]
      }),
      parseVersion: '1.0',
      parsedAt: new Date().toISOString()
    };
    
    return mockResponse;
  }
  
  parseCitations(output: AssistantOutput): ParsedCitation[] {
    try {
      const data = JSON.parse(output.rawPayload);
      return (data.results || []).map((result: any, index: number) => ({
        url: result.url,
        title: result.title,
        snippet: result.snippet,
        rank: result.rank || index + 1,
        domain: new URL(result.url).hostname
      }));
    } catch (error) {
      return [];
    }
  }
  
  async takeScreenshot(prompt: string): Promise<string> {
    return `screenshot_${this.name}_${Date.now()}.png`;
  }
}

export class CopilotConnector implements AssistantConnector {
  name = 'copilot';
  
  async fetchResults(prompt: string, options?: any): Promise<AssistantOutput> {
    // This would integrate with Copilot
    const mockResponse = {
      id: `copilot_${Date.now()}`,
      promptId: options?.promptId || '',
      rawPayload: JSON.stringify({
        query: prompt,
        answer: 'This is a sample answer from Copilot...',
        references: [
          {
            url: 'https://example.com/article3',
            title: 'Example Article 3',
            snippet: 'This is a sample snippet from Copilot...',
            rank: 1
          }
        ]
      }),
      parseVersion: '1.0',
      parsedAt: new Date().toISOString()
    };
    
    return mockResponse;
  }
  
  parseCitations(output: AssistantOutput): ParsedCitation[] {
    try {
      const data = JSON.parse(output.rawPayload);
      return (data.references || []).map((ref: any, index: number) => ({
        url: ref.url,
        title: ref.title,
        snippet: ref.snippet,
        rank: ref.rank || index + 1,
        domain: new URL(ref.url).hostname
      }));
    } catch (error) {
      return [];
    }
  }
  
  async takeScreenshot(prompt: string): Promise<string> {
    return `screenshot_${this.name}_${Date.now()}.png`;
  }
}

export function getConnector(assistant: string): AssistantConnector {
  switch (assistant) {
    case 'perplexity':
      return new PerplexityConnector();
    case 'chatgpt_search':
      return new ChatGPTSearchConnector();
    case 'copilot':
      return new CopilotConnector();
    default:
      throw new Error(`Unknown assistant: ${assistant}`);
  }
}
