#!/usr/bin/env tsx

/**
 * Full Reclassification Script
 * Processes all events in 4-hour batches to complete the full reclassification
 */

import { config } from 'dotenv';

// Load environment variables
config();

const API_BASE = process.env.API_BASE || 'https://api.optiview.ai';
const SESSION_COOKIE = process.env.SESSION_COOKIE;

if (!SESSION_COOKIE) {
  console.error('❌ SESSION_COOKIE environment variable required');
  console.log('Set it with: export SESSION_COOKIE="optiview_session=your_session_here"');
  process.exit(1);
}

interface ReclassifyResponse {
  success: boolean;
  message: string;
  processed?: number;
  updated?: number;
  errors?: number;
  total_events?: number;
}

async function reclassifyBatch(startTime: Date, endTime: Date, batchSize: number = 100): Promise<ReclassifyResponse> {
  console.log(`🔄 Processing batch: ${startTime.toISOString()} to ${endTime.toISOString()}`);
  
  try {
    const response = await fetch(`${API_BASE}/admin/ai-backfill/reclassify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': SESSION_COOKIE
      },
      body: JSON.stringify({
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        batch_size: batchSize
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error(`❌ Error processing batch ${startTime.toISOString()}-${endTime.toISOString()}:`, error);
    return {
      success: false,
      message: error.message
    };
  }
}

async function runFullReclassification(): Promise<void> {
  console.log(`🚀 Starting FULL reclassification of all events`);
  console.log(`🔗 API: ${API_BASE}`);
  console.log(`📦 Batch size: 100 events per batch`);
  console.log(`⏰ Time chunks: 4 hours`);
  console.log('');
  
  // Calculate time ranges: go back 72 hours in 4-hour chunks
  const now = new Date();
  const startTime = new Date(now.getTime() - 72 * 60 * 60 * 1000); // 72 hours ago
  const chunkSize = 4 * 60 * 60 * 1000; // 4 hours in milliseconds
  
  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalErrors = 0;
  let batchCount = 0;
  
  // Process chunks from oldest to newest
  for (let currentTime = startTime.getTime(); currentTime < now.getTime(); currentTime += chunkSize) {
    const chunkStart = new Date(currentTime);
    const chunkEnd = new Date(Math.min(currentTime + chunkSize, now.getTime()));
    batchCount++;
    
    console.log(`\n⏰ Batch ${batchCount}: ${chunkStart.toISOString()} to ${chunkEnd.toISOString()}`);
    console.log(`   Duration: ${Math.round((chunkEnd.getTime() - chunkStart.getTime()) / (60 * 60 * 1000) * 10) / 10} hours`);
    
    const result = await reclassifyBatch(chunkStart, chunkEnd, 100);
    
    if (result.success) {
      totalProcessed += result.processed || 0;
      totalUpdated += result.updated || 0;
      totalErrors += result.errors || 0;
      
      console.log(`   ✅ Success: ${result.processed} processed, ${result.updated} updated, ${result.errors} errors`);
      
      if (result.total_events === 0) {
        console.log(`   ℹ️  No events found in this time range`);
      }
    } else {
      totalErrors++;
      console.log(`   ❌ Failed: ${result.message}`);
    }
    
    // Add delay between batches to avoid overwhelming the system
    if (currentTime + chunkSize < now.getTime()) {
      console.log('   ⏳ Waiting 3 seconds before next batch...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  console.log(`\n🎉 Full reclassification complete!`);
  console.log(`📊 Summary:`);
  console.log(`   Total batches processed: ${batchCount}`);
  console.log(`   Total events processed: ${totalProcessed}`);
  console.log(`   Total events updated: ${totalUpdated}`);
  console.log(`   Total errors: ${totalErrors}`);
  console.log(`   Success rate: ${totalProcessed > 0 ? Math.round(((totalProcessed - totalErrors) / totalProcessed) * 100) : 0}%`);
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`🎯 Optiview Full Reclassification Tool`);
    console.log(`Usage: npx tsx scripts/run-full-reclassification.ts [options]`);
    console.log(``);
    console.log(`Options:`);
    console.log(`  --help, -h     Show this help message`);
    console.log(`  --dry-run      Show what would be processed without running`);
    console.log(``);
    console.log(`Environment Variables:`);
    console.log(`  SESSION_COOKIE  Your optiview session cookie`);
    console.log(`  API_BASE        API base URL (default: https://api.optiview.ai)`);
    console.log(``);
    console.log(`Example:`);
    console.log(`  export SESSION_COOKIE="optiview_session=your_session_here"`);
    console.log(`  npx tsx scripts/run-full-reclassification.ts`);
    return;
  }
  
  if (args.includes('--dry-run')) {
    console.log(`🔍 DRY RUN MODE - No actual reclassification will be performed`);
    console.log(`📊 This would process events from the last 72 hours in 4-hour chunks`);
    console.log(`📦 Each batch would process up to 100 events`);
    console.log(`⏰ Total estimated batches: 18 (72 hours ÷ 4 hours)`);
    return;
  }
  
  await runFullReclassification();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
