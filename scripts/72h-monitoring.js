#!/usr/bin/env node

/**
 * 72-Hour Monitoring Schedule
 * Runs live verification checks every 6 hours
 */

const { spawn } = require('child_process');
const path = require('path');

const VERIFICATION_SCRIPT = path.join(__dirname, 'live-verification.js');

function runVerification() {
  console.log(`\n[${new Date().toISOString()}] Starting verification check...\n`);
  
  const child = spawn('node', [VERIFICATION_SCRIPT], {
    stdio: 'inherit'
  });
  
  child.on('close', (code) => {
    console.log(`\n[${new Date().toISOString()}] Verification completed with code ${code}\n`);
    
    if (code !== 0) {
      console.error('❌ Verification failed - investigate issues');
    } else {
      console.log('✅ Verification passed - all systems healthy');
    }
  });
}

function scheduleChecks() {
  console.log('🕐 Starting 72-hour monitoring schedule...');
  console.log('📋 Checks will run every 6 hours: 00, 06, 12, 18 UTC');
  console.log('⏹️  Press Ctrl+C to stop monitoring\n');
  
  // Run initial check
  runVerification();
  
  // Schedule every 6 hours (6 * 60 * 60 * 1000 = 21,600,000 ms)
  const interval = 6 * 60 * 60 * 1000;
  
  const timer = setInterval(() => {
    runVerification();
  }, interval);
  
  // Cleanup on exit
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping monitoring...');
    clearInterval(timer);
    process.exit(0);
  });
}

// Manual check times for reference
const CHECK_TIMES = {
  '00 UTC': 'Health check + rollup validation',
  '06 UTC': 'Rollup freshness + connector health',
  '12 UTC': 'Cost utilization + new citations',
  '18 UTC': 'Full system verification'
};

console.log('📅 72-Hour Monitoring Schedule:');
Object.entries(CHECK_TIMES).forEach(([time, task]) => {
  console.log(`   ${time}: ${task}`);
});

scheduleChecks();
