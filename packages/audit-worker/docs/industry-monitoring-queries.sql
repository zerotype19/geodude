-- Industry Classification Monitoring Queries
-- Run these regularly to track classification quality and detect regressions

-- 1. Generic Consumer Rate (last 3 days)
-- Target: < 20% for non-unknown TLDs
-- Alert: If > 20%, AI might not be running or threshold too high
SELECT 
  COUNT(*) AS total_audits,
  SUM(CASE WHEN industry = 'generic_consumer' THEN 1 ELSE 0 END) AS generic_count,
  ROUND(100.0 * SUM(CASE WHEN industry = 'generic_consumer' THEN 1 ELSE 0 END) / COUNT(*), 1) AS pct_generic,
  CASE 
    WHEN ROUND(100.0 * SUM(CASE WHEN industry = 'generic_consumer' THEN 1 ELSE 0 END) / COUNT(*), 1) > 20 
    THEN '⚠️  WARNING: High generic rate'
    ELSE '✅ OK'
  END AS status
FROM audits
WHERE started_at >= datetime('now', '-3 days');

-- 2. Industry Distribution (last 7 days)
-- Shows breakdown of all industry classifications
SELECT 
  industry,
  COUNT(*) AS count,
  ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM audits WHERE started_at >= datetime('now', '-7 days')), 1) AS pct,
  industry_source,
  COUNT(DISTINCT project_id) AS unique_projects
FROM audits
WHERE started_at >= datetime('now', '-7 days')
GROUP BY industry, industry_source
ORDER BY count DESC;

-- 3. AI vs Heuristics vs Default (last 3 days)
-- Target: AI source > 60%, default < 20%
SELECT 
  CASE 
    WHEN industry_source LIKE '%ai_worker%' THEN 'AI Classifier'
    WHEN industry_source = 'heuristics' THEN 'Heuristics'
    WHEN industry_source = 'domain_rules' THEN 'Domain Rules (Whitelist)'
    WHEN industry_source = 'default' THEN 'Default Fallback'
    ELSE 'Other'
  END AS source_category,
  COUNT(*) AS count,
  ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM audits WHERE started_at >= datetime('now', '-3 days')), 1) AS pct,
  AVG(CASE WHEN industry = 'generic_consumer' THEN 100.0 ELSE 0.0 END) AS pct_generic
FROM audits
WHERE started_at >= datetime('now', '-3 days')
GROUP BY source_category
ORDER BY count DESC;

-- 4. Recent Reclassifications (citations cron changes)
-- Shows domains where industry changed during citations phase
SELECT 
  root_url,
  project_id,
  industry AS current_industry,
  industry_source,
  started_at,
  citations_started_at,
  CASE 
    WHEN industry_source LIKE '%reclass%' THEN '🔄 Reclassified'
    ELSE 'Original'
  END AS change_status
FROM audits
WHERE started_at >= datetime('now', '-7 days')
  AND industry_source LIKE '%reclass%'
ORDER BY citations_started_at DESC
LIMIT 20;

-- 5. Quality Check: Known Domains (should never be generic_consumer)
-- These are whitelisted domains - if any are generic, something is wrong
WITH known_domains AS (
  SELECT 'adobe.com' AS domain UNION ALL
  SELECT 'salesforce.com' UNION ALL
  SELECT 'toyota.com' UNION ALL
  SELECT 'delta.com' UNION ALL
  SELECT 'mayoclinic.org' UNION ALL
  SELECT 'cnn.com' UNION ALL
  SELECT 'bestbuy.com'
)
SELECT 
  kd.domain,
  a.industry,
  a.industry_source,
  a.started_at,
  CASE 
    WHEN a.industry = 'generic_consumer' THEN '❌ FAIL'
    ELSE '✅ PASS'
  END AS status
FROM known_domains kd
LEFT JOIN audits a ON a.root_url LIKE '%' || kd.domain || '%'
WHERE a.started_at >= datetime('now', '-7 days')
ORDER BY a.started_at DESC;

-- 6. Confidence Distribution (for AI-classified audits)
-- Target: Avg confidence > 0.45 after fusion
-- Note: Requires adding confidence column to audits table
-- ALTER TABLE audits ADD COLUMN industry_confidence REAL;
/*
SELECT 
  CASE 
    WHEN industry_confidence >= 0.70 THEN 'High (≥0.70)'
    WHEN industry_confidence >= 0.50 THEN 'Medium (0.50-0.69)'
    WHEN industry_confidence >= 0.35 THEN 'Low (0.35-0.49)'
    ELSE 'Very Low (<0.35)'
  END AS confidence_bucket,
  COUNT(*) AS count,
  ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM audits WHERE industry_source LIKE '%ai%' AND started_at >= datetime('now', '-3 days')), 1) AS pct
FROM audits
WHERE industry_source LIKE '%ai%'
  AND started_at >= datetime('now', '-3 days')
  AND industry_confidence IS NOT NULL
GROUP BY confidence_bucket
ORDER BY MIN(industry_confidence) DESC;
*/

-- 7. Time Series: Generic Rate by Day (last 14 days)
-- Use this to detect sudden spikes or regressions
SELECT 
  DATE(started_at) AS date,
  COUNT(*) AS total,
  SUM(CASE WHEN industry = 'generic_consumer' THEN 1 ELSE 0 END) AS generic,
  ROUND(100.0 * SUM(CASE WHEN industry = 'generic_consumer' THEN 1 ELSE 0 END) / COUNT(*), 1) AS pct_generic,
  SUM(CASE WHEN industry_source LIKE '%ai%' THEN 1 ELSE 0 END) AS ai_used
FROM audits
WHERE started_at >= datetime('now', '-14 days')
GROUP BY DATE(started_at)
ORDER BY date DESC;

-- 8. Failed Classifications (domains that should be classified but aren't)
-- Domains with clear keywords but still generic_consumer
SELECT 
  root_url,
  project_id,
  site_description,
  industry,
  industry_source,
  started_at
FROM audits
WHERE industry = 'generic_consumer'
  AND industry_source = 'default'
  AND started_at >= datetime('now', '-3 days')
  AND (
    site_description LIKE '%software%'
    OR site_description LIKE '%SaaS%'
    OR site_description LIKE '%airline%'
    OR site_description LIKE '%hospital%'
    OR site_description LIKE '%car%'
    OR site_description LIKE '%retail%'
  )
ORDER BY started_at DESC
LIMIT 20;

-- 9. Canary Domains Audit History
-- Track classification consistency for key test domains
SELECT 
  REPLACE(REPLACE(root_url, 'https://', ''), 'http://', '') AS domain,
  industry,
  industry_source,
  started_at,
  COUNT(*) OVER (PARTITION BY REPLACE(REPLACE(root_url, 'https://', ''), 'http://', '')) AS audit_count,
  LAG(industry) OVER (PARTITION BY REPLACE(REPLACE(root_url, 'https://', ''), 'http://', '') ORDER BY started_at) AS prev_industry
FROM audits
WHERE (
  root_url LIKE '%adobe.com%'
  OR root_url LIKE '%salesforce.com%'
  OR root_url LIKE '%toyota.com%'
  OR root_url LIKE '%cnn.com%'
  OR root_url LIKE '%southwest.com%'
)
AND started_at >= datetime('now', '-30 days')
ORDER BY domain, started_at DESC;

-- 10. Alert Thresholds Summary
-- Run this to check all thresholds at once
WITH metrics AS (
  SELECT 
    ROUND(100.0 * SUM(CASE WHEN industry = 'generic_consumer' THEN 1 ELSE 0 END) / COUNT(*), 1) AS pct_generic,
    ROUND(100.0 * SUM(CASE WHEN industry_source LIKE '%ai%' THEN 1 ELSE 0 END) / COUNT(*), 1) AS pct_ai_invoked,
    ROUND(100.0 * SUM(CASE WHEN industry_source = 'heuristics' AND industry_source NOT LIKE '%ai%' THEN 1 ELSE 0 END) / COUNT(*), 1) AS pct_heuristics_only
  FROM audits
  WHERE started_at >= datetime('now', '-3 days')
)
SELECT 
  'Generic Consumer Rate' AS metric,
  pct_generic AS value,
  '< 20%' AS threshold,
  CASE WHEN pct_generic < 20 THEN '✅ PASS' ELSE '⚠️  FAIL' END AS status
FROM metrics
UNION ALL
SELECT 
  'AI Invocation Rate',
  pct_ai_invoked,
  '> 60%',
  CASE WHEN pct_ai_invoked > 60 THEN '✅ PASS' ELSE '⚠️  FAIL' END
FROM metrics
UNION ALL
SELECT 
  'Heuristics Override Rate',
  pct_heuristics_only,
  '< 15%',
  CASE WHEN pct_heuristics_only < 15 THEN '✅ PASS' ELSE '⚠️  FAIL' END
FROM metrics;

