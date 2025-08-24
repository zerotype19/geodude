#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function exportInteractionEvents() {
  try {
    console.log('🔄 Starting interaction events export...');

    // Create output directory
    const exportsDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outputFile = path.join(exportsDir, `interaction-events-${timestamp}.csv`);

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
    fs.writeFileSync(outputFile, csvHeader + '\n');

    // Export data using wrangler
    console.log('📥 Fetching data from database...');
    const command = `wrangler d1 execute optiview_db --remote --command="SELECT id, project_id, property_id, content_id, ai_source_id, event_type, metadata, occurred_at, sampled, class, bot_category FROM interaction_events WHERE project_id = 'prj_UHoetismrowc' ORDER BY occurred_at DESC LIMIT 1000;"`;

    const output = execSync(command, { encoding: 'utf8' });

    // Process the output
    console.log('📝 Processing data...');
    const lines = output.split('\n');

    // Skip the first 2 lines (wrangler header) and process data lines
    let dataLines = [];
    let inDataSection = false;

    for (const line of lines) {
      if (line.includes('│')) {
        inDataSection = true;
        // Convert table format to CSV
        const csvLine = line
          .split('│')
          .map(cell => cell.trim())
          .filter(cell => cell.length > 0)
          .join(',');
        dataLines.push(csvLine);
      } else if (inDataSection && line.trim() === '') {
        // End of data section
        break;
      }
    }

    // Write data to CSV file
    for (const line of dataLines) {
      fs.appendFileSync(outputFile, line + '\n');
    }

    console.log('✅ Export completed!');
    console.log('📁 File saved to:', outputFile);
    console.log('📊 Total rows exported:', dataLines.length);

  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  }
}

exportInteractionEvents();
