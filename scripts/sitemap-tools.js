#!/usr/bin/env node
/**
 * Sitemap Tools - Validation and Submission
 * Helps validate and submit sitemaps to search engines
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function validateSitemap() {
  console.log('🔍 Validating sitemap.xml...');
  
  try {
    // Check if sitemap.xml exists
    const sitemapPath = path.join(__dirname, '..', 'sitemap.xml');
    if (!fs.existsSync(sitemapPath)) {
      console.log('❌ sitemap.xml not found');
      return false;
    }
    
    // Read and parse sitemap
    const sitemapContent = fs.readFileSync(sitemapPath, 'utf8');
    
    // Basic XML validation
    if (!sitemapContent.includes('<?xml version="1.0" encoding="UTF-8"?>')) {
      console.log('❌ Invalid XML declaration');
      return false;
    }
    
    if (!sitemapContent.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')) {
      console.log('❌ Invalid urlset declaration');
      return false;
    }
    
    // Count URLs
    const urlMatches = sitemapContent.match(/<url>/g);
    const urlCount = urlMatches ? urlMatches.length : 0;
    
    console.log(`✅ sitemap.xml is valid`);
    console.log(`📊 Contains ${urlCount} URLs`);
    
    // Check for required elements
    const requiredElements = ['<loc>', '<lastmod>', '<changefreq>', '<priority>'];
    const missingElements = requiredElements.filter(element => !sitemapContent.includes(element));
    
    if (missingElements.length > 0) {
      console.log(`⚠️  Missing elements: ${missingElements.join(', ')}`);
    } else {
      console.log('✅ All required elements present');
    }
    
    return true;
    
  } catch (error) {
    console.log('❌ Validation failed:', error.message);
    return false;
  }
}

async function submitToSearchEngines() {
  console.log('\n🚀 Submitting sitemap to search engines...');
  
  const sitemapUrl = 'https://optiview.ai/sitemap.xml';
  
  try {
    // Google Search Console (requires manual setup)
    console.log('📝 Google Search Console:');
    console.log('   1. Go to https://search.google.com/search-console');
    console.log('   2. Add your property: https://optiview.ai');
    console.log('   3. Go to Sitemaps section');
    console.log('   4. Add sitemap URL:', sitemapUrl);
    
    // Bing Webmaster Tools (requires manual setup)
    console.log('\n📝 Bing Webmaster Tools:');
    console.log('   1. Go to https://www.bing.com/webmasters');
    console.log('   2. Add your site: https://optiview.ai');
    console.log('   3. Go to Sitemaps section');
    console.log('   4. Add sitemap URL:', sitemapUrl);
    
    // Ping search engines
    console.log('\n📡 Pinging search engines...');
    
    // Ping Google
    try {
      const googlePing = `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;
      execSync(`curl -s "${googlePing}"`, { timeout: 10000 });
      console.log('✅ Pinged Google');
    } catch (error) {
      console.log('⚠️  Google ping failed');
    }
    
    // Ping Bing
    try {
      const bingPing = `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;
      execSync(`curl -s "${bingPing}"`, { timeout: 10000 });
      console.log('✅ Pinged Bing');
    } catch (error) {
      console.log('⚠️  Bing ping failed');
    }
    
    console.log('\n✅ Sitemap submission process completed');
    
  } catch (error) {
    console.log('❌ Submission failed:', error.message);
  }
}

async function generateSitemapStats() {
  console.log('\n📊 Sitemap Statistics...');
  
  try {
    const sitemapPath = path.join(__dirname, '..', 'sitemap.xml');
    const sitemapContent = fs.readFileSync(sitemapPath, 'utf8');
    
    // Count different types of pages
    const stats = {
      total: (sitemapContent.match(/<url>/g) || []).length,
      main: (sitemapContent.match(/priority>1\.0<\/priority>/g) || []).length,
      high: (sitemapContent.match(/priority>0\.[89]<\/priority>/g) || []).length,
      medium: (sitemapContent.match(/priority>0\.[67]<\/priority>/g) || []).length,
      low: (sitemapContent.match(/priority>0\.[45]<\/priority>/g) || []).length,
      weekly: (sitemapContent.match(/changefreq>weekly<\/changefreq>/g) || []).length,
      monthly: (sitemapContent.match(/changefreq>monthly<\/changefreq>/g) || []).length,
      yearly: (sitemapContent.match(/changefreq>yearly<\/changefreq>/g) || []).length
    };
    
    console.log(`📈 Total URLs: ${stats.total}`);
    console.log(`🎯 High priority (0.8-1.0): ${stats.main + stats.high}`);
    console.log(`📊 Medium priority (0.6-0.7): ${stats.medium}`);
    console.log(`📋 Low priority (0.4-0.5): ${stats.low}`);
    console.log(`🔄 Update frequency:`);
    console.log(`   - Weekly: ${stats.weekly}`);
    console.log(`   - Monthly: ${stats.monthly}`);
    console.log(`   - Yearly: ${stats.yearly}`);
    
  } catch (error) {
    console.log('❌ Stats generation failed:', error.message);
  }
}

async function main() {
  console.log('🗺️  Optiview Sitemap Tools');
  console.log('=' .repeat(40));
  
  // Validate sitemap
  const isValid = await validateSitemap();
  
  if (isValid) {
    // Generate statistics
    await generateSitemapStats();
    
    // Submit to search engines
    await submitToSearchEngines();
    
    console.log('\n✅ Sitemap tools completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('   1. Upload sitemap.xml to your website root');
    console.log('   2. Update robots.txt to reference the sitemap');
    console.log('   3. Submit to Google Search Console and Bing Webmaster Tools');
    console.log('   4. Monitor indexing progress in search console');
  } else {
    console.log('\n❌ Please fix sitemap issues before proceeding');
  }
}

// Run the tools
main();
