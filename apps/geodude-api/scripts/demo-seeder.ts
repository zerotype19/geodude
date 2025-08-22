#!/usr/bin/env tsx

/**
 * Demo Data Seeder
 * Creates a demo organization, project, and sample data for testing
 */

import { D1Database } from '@cloudflare/workers-types';

interface DemoConfig {
  orgName: string;
  orgId: string;
  projectName: string;
  projectId: string;
  propertyDomain: string;
  propertyId: string;
  keyId: string;
  keySecret: string;
}

const DEMO_CONFIG: DemoConfig = {
  orgName: "Optiview Demo",
  orgId: "org_demo_123",
  projectName: "Sample Project",
  projectId: "prj_demo_456",
  propertyDomain: "demo.optiview.dev",
  propertyId: "prop_demo_789",
  keyId: "key_demo_abc",
  keySecret: "demo_secret_123"
};

async function seedDemoData(db: D1Database) {
  console.log("🌱 Starting demo data seeding...");

  try {
    // 1. Create demo organization
    console.log("Creating demo organization...");
    await db.prepare(`
      INSERT OR REPLACE INTO organization (id, name, created_ts)
      VALUES (?, ?, ?)
    `).bind(DEMO_CONFIG.orgId, DEMO_CONFIG.orgName, Date.now()).run();

    // 2. Create demo user
    console.log("Creating demo user...");
    const userId = "usr_demo_001";
    await db.prepare(`
      INSERT OR REPLACE INTO user (id, email, created_ts)
      VALUES (?, ?, ?)
    `).bind(userId, "demo@optiview.ai", Date.now()).run();

    // 3. Add user to organization
    console.log("Adding user to organization...");
    await db.prepare(`
      INSERT OR REPLACE INTO org_member (org_id, user_id, role)
      VALUES (?, ?, ?)
    `).bind(DEMO_CONFIG.orgId, userId, "admin").run();

    // 4. Create demo project
    console.log("Creating demo project...");
    await db.prepare(`
      INSERT OR REPLACE INTO project (id, org_id, name, slug, domain, created_ts)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      DEMO_CONFIG.projectId,
      DEMO_CONFIG.orgId,
      DEMO_CONFIG.projectName,
      "demo",
      DEMO_CONFIG.propertyDomain,
      Date.now()
    ).run();

    // 5. Create demo property
    console.log("Creating demo property...");
    await db.prepare(`
      INSERT OR REPLACE INTO properties (id, project_id, domain)
      VALUES (?, ?, ?)
    `).bind(DEMO_CONFIG.propertyId, DEMO_CONFIG.projectId, DEMO_CONFIG.propertyDomain).run();

    // 6. Create demo API key
    console.log("Creating demo API key...");
    const keyHash = await hashString(DEMO_CONFIG.keySecret);
    await db.prepare(`
      INSERT OR REPLACE INTO api_keys (id, project_id, property_id, name, key_id, secret_hash, created_ts)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      "key_demo_001",
      DEMO_CONFIG.projectId,
      DEMO_CONFIG.propertyId,
      "Demo API Key",
      DEMO_CONFIG.keyId,
      keyHash,
      Date.now()
    ).run();

    // 7. Create project settings
    console.log("Creating project settings...");
    await db.prepare(`
      INSERT OR REPLACE INTO project_settings (project_id, retention_days_events, retention_days_referrals, plan_tier, xray_trace_enabled)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      DEMO_CONFIG.projectId,
      90, // 90 days retention
      90, // 90 days retention
      "pro", // pro tier
      1 // xray trace enabled
    ).run();

    // 8. Create user settings (demo toggle)
    console.log("Creating user settings...");
    await db.prepare(`
      INSERT OR REPLACE INTO user_settings (user_id, key, value)
      VALUES (?, ?, ?)
    `).bind(userId, "show_demo", "true").run();

    // 9. Create sample content assets
    console.log("Creating sample content assets...");
    const contentAssets = [
      { url: "/", type: "page", title: "Homepage" },
      { url: "/about", type: "page", title: "About Us" },
      { url: "/products", type: "page", title: "Products" },
      { url: "/products/widget-1", type: "product", title: "Premium Widget" },
      { url: "/products/widget-2", type: "product", title: "Standard Widget" },
      { url: "/blog", type: "page", title: "Blog" },
      { url: "/blog/ai-analytics-guide", type: "post", title: "AI Analytics Guide" },
      { url: "/blog/traffic-classification", type: "post", title: "Traffic Classification" },
      { url: "/contact", type: "page", title: "Contact" },
      { url: "/pricing", type: "page", title: "Pricing" }
    ];

    for (const asset of contentAssets) {
      await db.prepare(`
        INSERT OR REPLACE INTO content_assets (property_id, url, type, metadata, created_ts)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        DEMO_CONFIG.propertyId,
        asset.url,
        asset.type,
        JSON.stringify({ title: asset.title, demo: true }),
        Date.now()
      ).run();
    }

    // 10. Create sample AI sources
    console.log("Creating sample AI sources...");
    const aiSources = [
      { name: "PerplexityBot", category: "search", fingerprint: "PerplexityBot" },
      { name: "ChatGPT", category: "chat", fingerprint: "ChatGPT" },
      { name: "Claude", category: "chat", fingerprint: "Claude" },
      { name: "Google Gemini", category: "assistant", fingerprint: "Gemini" },
      { name: "Bing Chat", category: "search", fingerprint: "BingChat" }
    ];

    for (const source of aiSources) {
      await db.prepare(`
        INSERT OR REPLACE INTO ai_sources (name, category, fingerprint, created_ts)
        VALUES (?, ?, ?, ?)
      `).bind(source.name, source.category, source.fingerprint, Date.now()).run();
    }

    console.log("✅ Demo data seeding completed successfully!");
    console.log(`\nDemo Project Details:`);
    console.log(`- Organization: ${DEMO_CONFIG.orgName} (${DEMO_CONFIG.orgId})`);
    console.log(`- Project: ${DEMO_CONFIG.projectName} (${DEMO_CONFIG.projectId})`);
    console.log(`- Property: ${DEMO_CONFIG.propertyDomain} (${DEMO_CONFIG.propertyId})`);
    console.log(`- API Key: ${DEMO_CONFIG.keyId}`);
    console.log(`- API Secret: ${DEMO_CONFIG.keySecret}`);

  } catch (error) {
    console.error("❌ Error seeding demo data:", error);
    throw error;
  }
}

async function generateSyntheticEvents(db: D1Database) {
  console.log("🎲 Generating synthetic events...");

  try {
    // Get demo project and content IDs
    const project = await db.prepare(`
      SELECT id FROM project WHERE id = ?
    `).bind(DEMO_CONFIG.projectId).first<{ id: string }>();

    const contentAssets = await db.prepare(`
      SELECT id, url FROM content_assets WHERE property_id = ?
    `).bind(DEMO_CONFIG.propertyId).all<{ id: string; url: string }>();

    const aiSources = await db.prepare(`
      SELECT id, name FROM ai_sources
    `).all<{ id: string; name: string }>();

    if (!project || !contentAssets.results || !aiSources.results) {
      throw new Error("Required demo data not found");
    }

    const projectId = project.id;
    const contentIds = contentAssets.results.map(c => c.id);
    const aiSourceIds = aiSources.results.map(s => s.id);

    // Generate 30-60 events across different traffic classes
    const eventCount = Math.floor(Math.random() * 31) + 30; // 30-60
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    console.log(`Generating ${eventCount} synthetic events...`);

    for (let i = 0; i < eventCount; i++) {
      // Random timestamp within last 24 hours
      const timestamp = now - Math.floor(Math.random() * oneDayMs);

      // Random content
      const contentId = contentIds[Math.floor(Math.random() * contentIds.length)];

      // Random AI source (or null for direct human)
      const hasAiSource = Math.random() < 0.6; // 60% chance of AI source
      const aiSourceId = hasAiSource ? aiSourceIds[Math.floor(Math.random() * aiSourceIds.length)] : null;

      // Traffic class based on AI source
      let trafficClass = "direct_human";
      let confidence = 1.0;

      if (aiSourceId) {
        const aiSource = aiSources.results.find(s => s.id === aiSourceId);
        if (aiSource?.name.includes("Bot") || aiSource?.name.includes("Chat")) {
          trafficClass = "crawler";
          confidence = 0.9;
        } else {
          trafficClass = "human_via_ai";
          confidence = 0.8;
        }
      }

      // Random event type
      const eventTypes = ["page_view", "click", "scroll", "form_submit"];
      const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];

      // Create event
      await db.prepare(`
        INSERT INTO interaction_events (project_id, content_id, ai_source_id, event_type, metadata, occurred_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        projectId,
        contentId,
        aiSourceId,
        eventType,
        JSON.stringify({
          class: trafficClass,
          confidence,
          demo: true,
          ruleset_version: 1,
          ua: "demo_user_agent",
          ref: "demo_referrer",
          ip: "demo_ip_hash"
        }),
        timestamp
      ).run();
    }

    // Generate some referrals
    const referralCount = Math.floor(Math.random() * 21) + 10; // 10-30

    for (let i = 0; i < referralCount; i++) {
      const timestamp = now - Math.floor(Math.random() * oneDayMs);
      const contentId = contentIds[Math.floor(Math.random() * contentIds.length)];
      const aiSourceId = aiSourceIds[Math.floor(Math.random() * aiSourceIds.length)];
      const refTypes = ["search_result", "chat_response", "recommendation"];
      const refType = refTypes[Math.floor(Math.random() * refTypes.length)];

      await db.prepare(`
        INSERT INTO ai_referrals (ai_source_id, content_id, ref_type, detected_at)
        VALUES (?, ?, ?, ?)
      `).bind(aiSourceId, contentId, refType, timestamp).run();
    }

    console.log(`✅ Generated ${eventCount} events and ${referralCount} referrals`);

  } catch (error) {
    console.error("❌ Error generating synthetic events:", error);
    throw error;
  }
}

// Simple hash function for demo purposes
async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Main execution
async function main() {
  console.log("🚀 Optiview Demo Data Seeder");
  console.log("==============================");

  // This would normally be called from the worker
  // For now, we'll just export the functions
  console.log("Demo seeder functions exported for use in worker");
}

if (import.meta.main) {
  main().catch(console.error);
}

export { seedDemoData, generateSyntheticEvents, DEMO_CONFIG };
