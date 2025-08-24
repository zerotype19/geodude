#!/usr/bin/env tsx

import { D1Database } from '@cloudflare/workers-types';
import { writeFileSync } from 'fs';
import { join } from 'path';

interface InteractionEvent {
  id: number;
  project_id: string;
  property_id: number | null;
  content_id: number | null;
  ai_source_id: number | null;
  event_type: string;
  metadata: string | null;
  occurred_at: string;
  sampled: number;
  class: string | null;
  bot_category: string | null;
}

async function exportInteractionEvents() {
  try {
    console.log('🔄 Starting interaction events export...');
    
    // Connect to the database (this would be done via wrangler in production)
    // For now, we'll use the wrangler CLI to execute the query and save results
    
    const outputFile = join(process.cwd(), 'interaction-events-export.csv');
    
    console.log('📊 Exporting last 1000 interaction events from project prj_UHoetismrowc...');
    console.log('💾 Output file:', outputFile);
    
    // Create CSV header
    const csvHeader = [
      'id',
      'project_id',
      'property_id',
      'content_id',
      'ai_source_id',
      'event_type',
      'metadata',
      'occurred_at',
      'sampled',
      'class',
      'bot_category'
    ].join(',');
    
    // Write header to file
    writeFileSync(outputFile, csvHeader + '\n');
    
    console.log('✅ CSV header written');
    console.log('📋 Run the following command to export the data:');
    console.log('');
    console.log(`wrangler d1 execute optiview_db --remote --command="SELECT id, project_id, property_id, content_id, ai_source_id, event_type, metadata, occurred_at, sampled, class, bot_category FROM interaction_events WHERE project_id = 'prj_UHoetismrowc' ORDER BY occurred_at DESC LIMIT 1000;" > temp_export.txt`);
    console.log('');
    console.log('Then manually convert the output to CSV format.');
    
  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  }
}

exportInteractionEvents();
