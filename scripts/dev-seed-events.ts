#!/usr/bin/env tsx

/**
 * Development script to bulk-insert test events for export testing
 * Usage: pnpm run dev:seed
 */

import { D1Database } from '@cloudflare/workers-types';

interface TestEvent {
  project_id: number;
  content_id: number;
  ai_source_id: number;
  event_type: string;
  metadata: Record<string, any>;
  occurred_at: number;
}

interface TestReferral {
  project_id: number;
  content_id: number;
  ai_source_id: number;
  ref_type: string;
  detected_at: number;
}

const TEST_CONFIG = {
  project_id: 1,
  property_id: 1,
  num_events: 50000,
  num_referrals: 10000,
  date_range_days: 90,
  event_types: ['view', 'click', 'scroll', 'form_submit', 'download'],
  ref_types: ['link', 'citation', 'mention', 'embed'],
  traffic_classes: ['human', 'ai_agent', 'human_via_ai', 'bot', 'crawler']
};

/**
 * Generate realistic test events
 */
function generateTestEvents(): TestEvent[] {
  const events: TestEvent[] = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  
  for (let i = 0; i < TEST_CONFIG.num_events; i++) {
    // Distribute events over the date range
    const randomDaysAgo = Math.random() * TEST_CONFIG.date_range_days;
    const occurred_at = now - (randomDaysAgo * dayMs);
    
    // Randomize event properties
    const event_type = TEST_CONFIG.event_types[Math.floor(Math.random() * TEST_CONFIG.event_types.length)];
    const traffic_class = TEST_CONFIG.traffic_classes[Math.floor(Math.random() * TEST_CONFIG.traffic_classes.length)];
    
    // Generate realistic metadata
    const metadata = {
      class: traffic_class,
      demo: true,
      test_batch: 'dev-seed',
      user_agent: generateRandomUserAgent(),
      referrer: generateRandomReferrer(),
      page_load_time: Math.floor(Math.random() * 5000) + 500,
      screen_resolution: generateRandomScreenResolution(),
      timestamp: occurred_at
    };
    
    events.push({
      project_id: TEST_CONFIG.project_id,
      content_id: Math.floor(Math.random() * 20) + 1, // 20 content assets
      ai_source_id: Math.floor(Math.random() * 5) + 1, // 5 AI sources
      event_type,
      metadata,
      occurred_at
    });
  }
  
  return events;
}

/**
 * Generate realistic test referrals
 */
function generateTestReferrals(): TestReferral[] {
  const referrals: TestReferral[] = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  
  for (let i = 0; i < TEST_CONFIG.num_referrals; i++) {
    // Distribute referrals over the date range
    const randomDaysAgo = Math.random() * TEST_CONFIG.date_range_days;
    const detected_at = now - (randomDaysAgo * dayMs);
    
    referrals.push({
      project_id: TEST_CONFIG.project_id,
      content_id: Math.floor(Math.random() * 20) + 1,
      ai_source_id: Math.floor(Math.random() * 5) + 1,
      ref_type: TEST_CONFIG.ref_types[Math.floor(Math.random() * TEST_CONFIG.ref_types.length)],
      detected_at
    });
  }
  
  return referrals;
}

/**
 * Generate random user agent strings
 */
function generateRandomUserAgent(): string {
  const browsers = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0'
  ];
  
  return browsers[Math.floor(Math.random() * browsers.length)];
}

/**
 * Generate random referrer URLs
 */
function generateRandomReferrer(): string {
  const referrers = [
    'https://www.google.com/',
    'https://www.bing.com/',
    'https://www.facebook.com/',
    'https://www.twitter.com/',
    'https://www.linkedin.com/',
    'https://www.reddit.com/',
    'https://www.youtube.com/',
    'https://www.medium.com/',
    'https://www.github.com/',
    'https://www.stackoverflow.com/'
  ];
  
  return referrers[Math.floor(Math.random() * referrers.length)];
}

/**
 * Generate random screen resolutions
 */
function generateRandomScreenResolution(): string {
  const resolutions = [
    '1920x1080',
    '2560x1440',
    '1366x768',
    '1440x900',
    '1536x864',
    '3840x2160',
    '1280x720',
    '1600x900'
  ];
  
  return resolutions[Math.floor(Math.random() * resolutions.length)];
}

/**
 * Insert events in batches
 */
async function insertEventsBatch(db: D1Database, events: TestEvent[], batchSize: number = 1000): Promise<void> {
  console.log(`Inserting ${events.length} events in batches of ${batchSize}...`);
  
  for (let i = 0; i < events.length; i += batchSize) {
    const batch = events.slice(i, i + batchSize);
    const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
    const values = batch.flatMap(event => [
      event.project_id,
      event.content_id,
      event.ai_source_id,
      event.event_type,
      JSON.stringify(event.metadata),
      event.occurred_at
    ]);
    
    try {
      await db.prepare(`
        INSERT INTO interaction_events (project_id, content_id, ai_source_id, event_type, metadata, occurred_at)
        VALUES ${placeholders}
      `).bind(...values).run();
      
      console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(events.length / batchSize)}`);
    } catch (error) {
      console.error(`Error inserting batch ${Math.floor(i / batchSize) + 1}:`, error);
      throw error;
    }
  }
}

/**
 * Insert referrals in batches
 */
async function insertReferralsBatch(db: D1Database, referrals: TestReferral[], batchSize: number = 1000): Promise<void> {
  console.log(`Inserting ${referrals.length} referrals in batches of ${batchSize}...`);
  
  for (let i = 0; i < referrals.length; i += batchSize) {
    const batch = referrals.slice(i, i + batchSize);
    const placeholders = batch.map(() => '(?, ?, ?, ?, ?)').join(', ');
    const values = batch.flatMap(referral => [
      referral.project_id,
      referral.content_id,
      referral.ai_source_id,
      referral.ref_type,
      referral.detected_at
    ]);
    
    try {
      await db.prepare(`
        INSERT INTO ai_referrals (project_id, content_id, ai_source_id, ref_type, detected_at)
        VALUES ${placeholders}
      `).bind(...values).run();
      
      console.log(`Inserted referral batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(referrals.length / batchSize)}`);
    } catch (error) {
      console.error(`Error inserting referral batch ${Math.floor(i / batchSize) + 1}:`, error);
      throw error;
    }
  }
}

/**
 * Main seeding function
 */
export async function seedTestData(db: D1Database): Promise<void> {
  console.log('🌱 Starting test data seeding...');
  console.log(`📊 Target: ${TEST_CONFIG.num_events} events, ${TEST_CONFIG.num_referrals} referrals`);
  
  try {
    // Generate test data
    console.log('📝 Generating test events...');
    const events = generateTestEvents();
    
    console.log('📝 Generating test referrals...');
    const referrals = generateTestReferrals();
    
    // Insert events
    await insertEventsBatch(db, events);
    
    // Insert referrals
    await insertReferralsBatch(db, referrals);
    
    console.log('✅ Test data seeding completed successfully!');
    console.log(`📈 Inserted ${events.length} events and ${referrals.length} referrals`);
    console.log(`📅 Data spans ${TEST_CONFIG.date_range_days} days`);
    console.log(`🏷️  All events tagged with metadata.demo=true`);
    
  } catch (error) {
    console.error('❌ Error seeding test data:', error);
    throw error;
  }
}

// If running directly
if (import.meta.main) {
  console.log('This script is designed to be imported and used with a D1 database instance.');
  console.log('Usage: import { seedTestData } from "./scripts/dev-seed-events"');
  console.log('Then call: await seedTestData(db)');
}
