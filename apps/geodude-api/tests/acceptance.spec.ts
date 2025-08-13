import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { unstable_dev } from "wrangler";
import type { UnstableDevWorker } from "wrangler";

describe("Optiview AI Traffic Classification", () => {
  let worker: UnstableDevWorker;

  beforeAll(async () => {
    worker = await unstable_dev("src/worker.ts", {
      experimental: { disableExperimentalWarning: true },
      env: "test"
    });
  });

  afterAll(async () => {
    await worker.stop();
  });

  describe("Traffic Classification", () => {
    it("should classify PerplexityBot as ai_agent_crawl", async () => {
      const response = await worker.fetch("/", {
        headers: {
          "user-agent": "PerplexityBot/1.0",
          "host": "example.com"
        }
      });

      expect(response.status).toBe(404); // Default response
      expect(response.headers.get("x-optiview-trace")).toBe("ai_agent_crawl");
    });

    it("should classify ChatGPT referer as human_via_ai", async () => {
      const response = await worker.fetch("/", {
        headers: {
          "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "referer": "https://chat.openai.com/c/abc123",
          "host": "example.com"
        }
      });

      expect(response.status).toBe(404); // Default response
      expect(response.headers.get("x-optiview-trace")).toBe("human_via_ai");
    });

    it("should classify direct human traffic", async () => {
      const response = await worker.fetch("/", {
        headers: {
          "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "host": "example.com"
        }
      });

      expect(response.status).toBe(404); // Default response
      expect(response.headers.get("x-optiview-trace")).toBe("direct_human");
    });

    it("should classify unknown AI-like patterns", async () => {
      const response = await worker.fetch("/", {
        headers: {
          "user-agent": "AI-Bot/1.0",
          "host": "example.com"
        }
      });

      expect(response.status).toBe(404); // Default response
      expect(response.headers.get("x-optiview-trace")).toBe("unknown_ai_like");
    });

    it("should classify empty user agent as unknown_ai_like", async () => {
      const response = await worker.fetch("/", {
        headers: {
          "host": "example.com"
        }
      });

      expect(response.status).toBe(404); // Default response
      expect(response.headers.get("x-optiview-trace")).toBe("unknown_ai_like");
    });
  });

  describe("API Endpoints", () => {
    it("should handle events summary request", async () => {
      const response = await worker.fetch("/api/events/summary?project_id=1");
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("total");
      expect(data).toHaveProperty("breakdown");
      expect(data).toHaveProperty("top_sources");
      expect(data).toHaveProperty("timeseries");
    });

    it("should handle events creation", async () => {
      const eventData = {
        project_id: 1,
        event_type: "view",
        metadata: { test: true }
      };

      const response = await worker.fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventData)
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("id");
      expect(data.event_type).toBe("view");
      expect(data.project_id).toBe(1);
    });

    it("should validate event type", async () => {
      const eventData = {
        project_id: 1,
        event_type: "invalid_type",
        metadata: { test: true }
      };

      const response = await worker.fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventData)
      });

      expect(response.status).toBe(400);
    });

    it("should handle content listing", async () => {
      const response = await worker.fetch("/api/content?project_id=1");
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("content");
      expect(Array.isArray(data.content)).toBe(true);
    });

    it("should handle AI sources listing", async () => {
      const response = await worker.fetch("/api/sources");
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("sources");
      expect(Array.isArray(data.sources)).toBe(true);
    });
  });

  describe("Privacy & Security", () => {
    it("should not expose raw user agent in response", async () => {
      const response = await worker.fetch("/", {
        headers: {
          "user-agent": "Sensitive-Info-Bot/1.0",
          "host": "example.com"
        }
      });

      // The response should not contain the raw user agent
      const responseText = await response.text();
      expect(responseText).not.toContain("Sensitive-Info-Bot");
    });

    it("should add cache control headers to API responses", async () => {
      const response = await worker.fetch("/api/events/summary?project_id=1");
      
      expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
    });
  });
});
