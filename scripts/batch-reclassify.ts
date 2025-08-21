#!/usr/bin/env tsx

/**
 * Batch Reclassification Script
 * Processes events in small time chunks to avoid Cloudflare Worker execution limits
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
}

async function reclassifyBatch(startHour: number, endHour: number): Promise<ReclassifyResponse> {
  const startTime = new Date(startHour * 60 * 60 * 1000).toISOString();
  const endTime = new Date(endHour * 60 * 60 * 1000).toISOString();
  
  console.log(`🔄 Processing batch: ${startTime} to ${endTime}`);
  
  try {
    const response = await fetch(`${API_BASE}/admin/ai-backfill/reclassify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': SESSION_COOKIE
      },
      body: JSON.stringify({
        start_time: startTime,
        end_time: endTime,
        batch_size: 100 // Process in small batches
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error(`❌ Error processing batch ${startHour}-${endHour}:`, error);
    return {
      success: false,
      message: error.message
    };
  }
}

async function processAllBatches(totalHours: number = 72, batchSize: number = 4): Promise<void> {
  console.log(`🚀 Starting batch reclassification for last ${totalHours} hours in ${batchSize}-hour chunks`);
  console.log(`📊 Total batches to process: ${Math.ceil(totalHours / batchSize)}`);
  
  const now = Math.floor(Date.now() / 1000 / 60 / 60); // Current hour
  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalErrors = 0;
  
  // Process batches from oldest to newest
  for (let hour = now - totalHours; hour < now; hour += batchSize) {
    const batchEnd = Math.min(hour + batchSize, now);
    
    console.log(`\n⏰ Batch ${hour}-${batchEnd} (${batchEnd - hour} hours)`);
    
    const result = await reclassifyBatch(hour, batchEnd);
    
    if (result.success) {
      totalProcessed += result.processed || 0;
      totalUpdated += result.updated || 0;
      totalErrors += result.errors || 0;
      
      console.log(`✅ Success: ${result.processed} processed, ${result.updated} updated, ${result.errors} errors`);
    } else {
      totalErrors++;
      console.log(`❌ Failed: ${result.message}`);
    }
    
    // Add delay between batches to avoid overwhelming the system
    if (hour + batchSize < now) {
      console.log('⏳ Waiting 2 seconds before next batch...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log(`\n🎉 Batch reclassification complete!`);
  console.log(`📊 Summary:`);
  console.log(`   Total processed: ${totalProcessed}`);
  console.log(`   Total updated: ${totalUpdated}`);
  console.log(`   Total errors: ${totalErrors}`);
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  const totalHours = parseInt(args[0]) || 72;
  const batchSize = parseInt(args[1]) || 4;
  
  console.log(`🎯 Optiview Batch Reclassification Tool`);
  console.log(`🔗 API: ${API_BASE}`);
  console.log(`⏰ Time window: ${totalHours} hours`);
  console.log(`📦 Batch size: ${batchSize} hours`);
  console.log('');
  
  await processAllBatches(totalHours, batchSize);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
