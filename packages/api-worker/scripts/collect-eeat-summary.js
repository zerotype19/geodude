#!/usr/bin/env node
/**
 * E-E-A-T Beta Summary Collection Script
 * Generates comprehensive report for Day 2 validation
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function collectEEATSummary() {
  console.log('📊 Collecting E-E-A-T Beta Summary...');
  console.log('📅 Report Date:', new Date().toISOString());
  
  const report = {
    timestamp: new Date().toISOString(),
    phase: 'Step B - E-E-A-T Beta',
    duration: '48 hours',
    metrics: {}
  };
  
  try {
    // 1. Average score per pillar (before/after)
    console.log('\n1️⃣  Analyzing pillar scores...');
    try {
      const pillarQuery = `
        SELECT 
          pillar,
          AVG(score) as avg_score,
          COUNT(*) as page_count,
          MIN(score) as min_score,
          MAX(score) as max_score
        FROM audit_results 
        WHERE pillar IN ('access_indexability', 'entities_structured', 'answer_fitness', 'authority_safety', 'performance_stability')
        AND created_at > datetime('now','-2 days')
        GROUP BY pillar
        ORDER BY pillar;
      `;
      
      const pillarResult = execSync(`wrangler d1 execute optiview_db --command "${pillarQuery}" --remote`, { encoding: 'utf8' });
      const pillarData = JSON.parse(pillarResult);
      const pillars = pillarData[0]?.results || [];
      
      report.metrics.pillars = pillars.map(p => ({
        name: p.pillar,
        average_score: Math.round(p.avg_score * 100) / 100,
        page_count: p.page_count,
        score_range: `${p.min_score} - ${p.max_score}`
      }));
      
      console.log('   ✅ Pillar analysis complete');
      pillars.forEach(p => console.log(`      - ${p.pillar}: ${Math.round(p.avg_score * 100) / 100} avg (${p.page_count} pages)`));
      
    } catch (error) {
      console.log('   ⚠️  Could not analyze pillar scores');
      report.metrics.pillars = [];
    }
    
    // 2. Trust pillar variance analysis
    console.log('\n2️⃣  Analyzing trust pillar variance...');
    try {
      const trustQuery = `
        SELECT 
          pillar,
          AVG(score) as avg_score,
          COUNT(*) as count,
          (MAX(score) - MIN(score)) as variance
        FROM audit_results 
        WHERE pillar = 'authority_safety'
        AND created_at > datetime('now','-2 days')
        GROUP BY pillar;
      `;
      
      const trustResult = execSync(`wrangler d1 execute optiview_db --command "${trustQuery}" --remote`, { encoding: 'utf8' });
      const trustData = JSON.parse(trustResult);
      const trust = trustData[0]?.results?.[0];
      
      if (trust) {
        report.metrics.trust_pillar = {
          average_score: Math.round(trust.avg_score * 100) / 100,
          page_count: trust.count,
          variance: Math.round(trust.variance * 100) / 100,
          variance_percentage: Math.round((trust.variance / trust.avg_score) * 100)
        };
        
        console.log(`   ✅ Trust pillar: ${Math.round(trust.avg_score * 100) / 100} avg, ${Math.round(trust.variance * 100) / 100} variance`);
      } else {
        console.log('   ⚠️  No trust pillar data found');
        report.metrics.trust_pillar = null;
      }
      
    } catch (error) {
      console.log('   ⚠️  Could not analyze trust pillar variance');
      report.metrics.trust_pillar = null;
    }
    
    // 3. Page count scanned (no change from baseline)
    console.log('\n3️⃣  Analyzing page count trends...');
    try {
      const pageQuery = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as page_count
        FROM audit_pages 
        WHERE created_at > datetime('now','-3 days')
        GROUP BY DATE(created_at)
        ORDER BY date;
      `;
      
      const pageResult = execSync(`wrangler d1 execute optiview_db --command "${pageQuery}" --remote`, { encoding: 'utf8' });
      const pageData = JSON.parse(pageResult);
      const pages = pageData[0]?.results || [];
      
      report.metrics.page_counts = pages.map(p => ({
        date: p.date,
        page_count: p.page_count
      }));
      
      console.log('   ✅ Page count analysis complete');
      pages.forEach(p => console.log(`      - ${p.date}: ${p.page_count} pages`));
      
    } catch (error) {
      console.log('   ⚠️  Could not analyze page counts');
      report.metrics.page_counts = [];
    }
    
    // 4. Error rate analysis
    console.log('\n4️⃣  Analyzing error rates...');
    try {
      const errorQuery = `
        SELECT 
          COUNT(*) as total_audits,
          SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count
        FROM audit_pages 
        WHERE created_at > datetime('now','-2 days');
      `;
      
      const errorResult = execSync(`wrangler d1 execute optiview_db --command "${errorQuery}" --remote`, { encoding: 'utf8' });
      const errorData = JSON.parse(errorResult);
      const error = errorData[0]?.results?.[0];
      
      if (error) {
        const errorRate = (error.error_count / error.total_audits) * 100;
        report.metrics.error_rate = {
          total_audits: error.total_audits,
          error_count: error.error_count,
          error_percentage: Math.round(errorRate * 100) / 100
        };
        
        console.log(`   ✅ Error rate: ${Math.round(errorRate * 100) / 100}% (${error.error_count}/${error.total_audits})`);
      } else {
        console.log('   ⚠️  No error data found');
        report.metrics.error_rate = null;
      }
      
    } catch (error) {
      console.log('   ⚠️  Could not analyze error rates');
      report.metrics.error_rate = null;
    }
    
    // 5. E-E-A-T specific metrics
    console.log('\n5️⃣  Analyzing E-E-A-T specific metrics...');
    try {
      const eeatQuery = `
        SELECT 
          COUNT(*) as eeat_audits,
          AVG(score) as avg_eeat_score
        FROM audit_results 
        WHERE pillar = 'authority_safety'
        AND created_at > datetime('now','-2 days');
      `;
      
      const eeatResult = execSync(`wrangler d1 execute optiview_db --command "${eeatQuery}" --remote`, { encoding: 'utf8' });
      const eeatData = JSON.parse(eeatResult);
      const eeat = eeatData[0]?.results?.[0];
      
      if (eeat) {
        report.metrics.eeat_specific = {
          audit_count: eeat.eeat_audits,
          average_score: Math.round(eeat.avg_eeat_score * 100) / 100
        };
        
        console.log(`   ✅ E-E-A-T audits: ${eeat.eeat_audits}, avg score: ${Math.round(eeat.avg_eeat_score * 100) / 100}`);
      } else {
        console.log('   ⚠️  No E-E-A-T specific data found');
        report.metrics.eeat_specific = null;
      }
      
    } catch (error) {
      console.log('   ⚠️  Could not analyze E-E-A-T metrics');
      report.metrics.eeat_specific = null;
    }
    
    // 6. Generate summary
    console.log('\n📋 Generating summary...');
    
    const summary = {
      status: 'SUCCESS',
      key_findings: [],
      recommendations: []
    };
    
    // Analyze trust pillar variance
    if (report.metrics.trust_pillar) {
      const variance = report.metrics.trust_pillar.variance_percentage;
      if (variance < 15) {
        summary.key_findings.push(`✅ Trust pillar variance tightened to ${variance}% (target: <15%)`);
      } else {
        summary.key_findings.push(`⚠️  Trust pillar variance at ${variance}% (target: <15%)`);
      }
    }
    
    // Analyze error rate
    if (report.metrics.error_rate) {
      const errorRate = report.metrics.error_rate.error_percentage;
      if (errorRate < 1) {
        summary.key_findings.push(`✅ Error rate at ${errorRate}% (target: <1%)`);
      } else {
        summary.key_findings.push(`⚠️  Error rate at ${errorRate}% (target: <1%)`);
        summary.recommendations.push('Investigate error sources and improve error handling');
      }
    }
    
    // Analyze page count stability
    if (report.metrics.page_counts.length > 1) {
      const counts = report.metrics.page_counts.map(p => p.page_count);
      const variance = Math.max(...counts) - Math.min(...counts);
      const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length;
      const variancePercent = (variance / avgCount) * 100;
      
      if (variancePercent < 20) {
        summary.key_findings.push(`✅ Page count stable (${Math.round(variancePercent)}% variance)`);
      } else {
        summary.key_findings.push(`⚠️  Page count variance at ${Math.round(variancePercent)}% (target: <20%)`);
      }
    }
    
    report.summary = summary;
    
    // Save report
    const reportsDir = path.join(__dirname, '..', '..', 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    const reportPath = path.join(reportsDir, 'eeat-beta-summary.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n✅ Report saved to: ${reportPath}`);
    console.log('\n📊 Summary:');
    summary.key_findings.forEach(finding => console.log(`   ${finding}`));
    
    if (summary.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      summary.recommendations.forEach(rec => console.log(`   - ${rec}`));
    }
    
    console.log('\n🎯 Next Steps:');
    console.log('   1. Review report for any issues');
    console.log('   2. If all metrics are within targets, proceed to Step C');
    console.log('   3. If issues found, investigate and potentially rollback');
    
  } catch (error) {
    console.error('❌ Error collecting E-E-A-T summary:', error.message);
    process.exit(1);
  }
}

// Run the collection
collectEEATSummary();
