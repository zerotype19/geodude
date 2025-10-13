#!/usr/bin/env node
/**
 * Cleanup Old Citations - Phase Next
 * Purges citations older than 90 days to manage DB growth
 */

const { execSync } = require('child_process');

async function cleanupOldCitations() {
  console.log('🧹 Cleaning up old citations...');
  
  try {
    // Check current size
    const sizeCheck = execSync(`wrangler d1 execute optiview_db --command "SELECT COUNT(*) as count, SUM(LENGTH(raw_payload)) as total_size FROM ai_citations WHERE occurred_at < datetime('now','-90 days');"`, { encoding: 'utf8' });
    
    const sizeData = JSON.parse(sizeCheck);
    const oldCitations = sizeData[0]?.results?.[0];
    
    if (!oldCitations || oldCitations.count === 0) {
      console.log('ℹ️  No old citations to clean up');
      return;
    }
    
    console.log(`📊 Found ${oldCitations.count} old citations (${Math.round(oldCitations.total_size / 1024 / 1024)} MB)`);
    
    // Delete old citations
    const deleteResult = execSync(`wrangler d1 execute optiview_db --command "DELETE FROM ai_citations WHERE occurred_at < datetime('now','-90 days');"`, { encoding: 'utf8' });
    
    const deleteData = JSON.parse(deleteResult);
    console.log(`✅ Cleaned up ${oldCitations.count} old citations`);
    
    // Verify cleanup
    const verifyResult = execSync(`wrangler d1 execute optiview_db --command "SELECT COUNT(*) as remaining FROM ai_citations WHERE occurred_at < datetime('now','-90 days');"`, { encoding: 'utf8' });
    
    const verifyData = JSON.parse(verifyResult);
    const remaining = verifyData[0]?.results?.[0]?.remaining || 0;
    
    if (remaining === 0) {
      console.log('✅ Cleanup completed successfully');
    } else {
      console.log(`⚠️  ${remaining} citations still remain (cleanup may have failed)`);
    }
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
  }
}

// Run the cleanup
cleanupOldCitations();
