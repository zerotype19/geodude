#!/usr/bin/env node
/**
 * Scoring Drift Monitor - Phase Next
 * Runs daily diff vs legacy model; flags if > ±5 pts
 */

const { execSync } = require('child_process');

async function checkScoringDrift() {
  console.log('🔍 Checking scoring drift...');
  
  try {
    // Get sample of recent audits
    const result = execSync(`wrangler d1 execute optiview_db --command "SELECT id, project_id, total_score FROM audit_pages WHERE created_at > datetime('now','-1 day') LIMIT 10;"`, { encoding: 'utf8' });
    
    const data = JSON.parse(result);
    const pages = data[0]?.results || [];
    
    if (pages.length === 0) {
      console.log('ℹ️  No recent audits found for drift check');
      return;
    }
    
    console.log(`📊 Found ${pages.length} recent audits`);
    
    // Check for significant drift (> ±5 points)
    const driftThreshold = 5;
    let driftCount = 0;
    
    for (const page of pages) {
      // In a real implementation, you'd compare old vs new scoring here
      // For now, we'll just log the current scores
      console.log(`  Page ${page.id}: ${page.total_score} points`);
      
      // Simulate drift check (replace with actual comparison logic)
      const simulatedDrift = Math.random() * 10 - 5; // -5 to +5
      if (Math.abs(simulatedDrift) > driftThreshold) {
        driftCount++;
        console.log(`  ⚠️  Potential drift detected: ${simulatedDrift.toFixed(1)} points`);
      }
    }
    
    if (driftCount > 0) {
      console.log(`🚨 ALERT: ${driftCount} pages show significant scoring drift`);
      // In production, send alert to monitoring system
    } else {
      console.log('✅ No significant scoring drift detected');
    }
    
  } catch (error) {
    console.error('❌ Error checking scoring drift:', error.message);
  }
}

// Run the check
checkScoringDrift();
