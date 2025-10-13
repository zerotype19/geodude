#!/usr/bin/env node

/**
 * 48-Hour Production Monitoring Schedule
 * 
 * Run every 6 hours to monitor Step C stability
 * 
 * Usage: node scripts/48h-monitoring-schedule.js
 */

const { execSync } = require('child_process');

console.log('🧭 48-Hour Production Monitoring Schedule');
console.log('📅 Started:', new Date().toISOString());
console.log('⏰ Phase: Step C - Assistant Visibility Active');
console.log('='.repeat(50));

async function runMonitoring() {
  try {
    console.log('\n🔍 Running 6-hour monitoring check...');
    execSync('node scripts/final-monitoring.js', { stdio: 'inherit' });
    
    console.log('\n📊 Running scoring drift check...');
    execSync('node scripts/monitor-scoring-drift.js', { stdio: 'inherit' });
    
    console.log('\n✅ Monitoring cycle complete');
    console.log('⏰ Next check: 6 hours from now');
    
  } catch (error) {
    console.error('❌ Monitoring failed:', error.message);
    process.exit(1);
  }
}

// Run immediately
runMonitoring();

// Schedule every 6 hours (21600000 ms)
setInterval(runMonitoring, 6 * 60 * 60 * 1000);

console.log('\n🔄 Monitoring will continue every 6 hours');
console.log('🛑 Press Ctrl+C to stop');
