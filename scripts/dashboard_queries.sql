-- Optiview v2.1 Dashboard Queries
-- Run these queries to monitor v2.1 adoption and performance

-- 1. Model Version Distribution
SELECT
  score_model_version,
  ROUND(AVG(overall_score), 2) AS avg_overall,
  ROUND(AVG(crawlability_score), 2) AS avg_crawlability,
  ROUND(AVG(structured_score), 2) AS avg_structured,
  ROUND(AVG(answerability_score), 2) AS avg_answerability,
  ROUND(AVG(trust_score), 2) AS avg_trust,
  ROUND(AVG(visibility_score), 2) AS avg_visibility,
  COUNT(*) AS audit_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) AS percentage
FROM audit_scores
GROUP BY score_model_version
ORDER BY score_model_version;

-- 2. v2.1 Adoption Over Time (Last 30 Days)
SELECT
  DATE(created_at) AS date,
  COUNT(*) AS total_audits,
  SUM(CASE WHEN score_model_version = 'v2.1' THEN 1 ELSE 0 END) AS v21_audits,
  ROUND(SUM(CASE WHEN score_model_version = 'v2.1' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS v21_percentage
FROM audit_scores
WHERE created_at >= datetime('now', '-30 days')
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- 3. Score Distribution by Model Version
SELECT
  score_model_version,
  CASE 
    WHEN overall_score >= 80 THEN 'Excellent (80-100%)'
    WHEN overall_score >= 60 THEN 'Good (60-79%)'
    WHEN overall_score >= 40 THEN 'Fair (40-59%)'
    ELSE 'Poor (0-39%)'
  END AS score_range,
  COUNT(*) AS count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(PARTITION BY score_model_version), 2) AS percentage
FROM audit_scores
GROUP BY score_model_version, score_range
ORDER BY score_model_version, overall_score DESC;

-- 4. Visibility Score Analysis (v2.1 only)
SELECT
  CASE 
    WHEN visibility_score = 0 THEN 'No Visibility Data'
    WHEN visibility_score < 20 THEN 'Low (0-19%)'
    WHEN visibility_score < 40 THEN 'Medium (20-39%)'
    WHEN visibility_score < 60 THEN 'High (40-59%)'
    ELSE 'Very High (60%+)'
  END AS visibility_range,
  COUNT(*) AS count,
  ROUND(AVG(overall_score), 2) AS avg_overall_score,
  ROUND(AVG(visibility_score), 2) AS avg_visibility_score
FROM audit_scores
WHERE score_model_version = 'v2.1'
GROUP BY visibility_range
ORDER BY visibility_score DESC;

-- 5. Top Performing Domains (v2.1)
SELECT
  a.domain,
  COUNT(*) AS audit_count,
  ROUND(AVG(s.overall_score), 2) AS avg_overall,
  ROUND(AVG(s.crawlability_score), 2) AS avg_crawlability,
  ROUND(AVG(s.structured_score), 2) AS avg_structured,
  ROUND(AVG(s.answerability_score), 2) AS avg_answerability,
  ROUND(AVG(s.trust_score), 2) AS avg_trust,
  ROUND(AVG(s.visibility_score), 2) AS avg_visibility
FROM audit_scores s
JOIN audits a ON s.audit_id = a.id
WHERE s.score_model_version = 'v2.1'
  AND a.domain IS NOT NULL
GROUP BY a.domain
HAVING COUNT(*) >= 2
ORDER BY avg_overall DESC
LIMIT 20;

-- 6. Score Improvement Analysis (v1.0 vs v2.1)
WITH v1_scores AS (
  SELECT 
    a.id,
    a.domain,
    a.score_overall as v1_overall,
    a.score_crawlability as v1_crawlability,
    a.score_structured as v1_structured,
    a.score_answerability as v1_answerability,
    a.score_trust as v1_trust
  FROM audits a
  WHERE a.score_overall IS NOT NULL
),
v21_scores AS (
  SELECT 
    audit_id,
    overall_score as v21_overall,
    crawlability_score as v21_crawlability,
    structured_score as v21_structured,
    answerability_score as v21_answerability,
    trust_score as v21_trust,
    visibility_score as v21_visibility
  FROM audit_scores
  WHERE score_model_version = 'v2.1'
)
SELECT
  v1.domain,
  v1.v1_overall,
  v21.v21_overall,
  ROUND(v21.v21_overall - v1.v1_overall, 2) AS overall_delta,
  ROUND(v21.v21_crawlability - v1.v1_crawlability, 2) AS crawlability_delta,
  ROUND(v21.v21_structured - v1.v1_structured, 2) AS structured_delta,
  ROUND(v21.v21_answerability - v1.v1_answerability, 2) AS answerability_delta,
  ROUND(v21.v21_trust - v1.v1_trust, 2) AS trust_delta,
  ROUND(v21.v21_visibility, 2) AS visibility_score
FROM v1_scores v1
JOIN v21_scores v21 ON v1.id = v21.audit_id
ORDER BY overall_delta DESC;

-- 7. Daily v2.1 Metrics Summary
SELECT
  DATE(created_at) AS date,
  COUNT(*) AS audits_processed,
  ROUND(AVG(overall_score), 2) AS avg_overall,
  ROUND(AVG(crawlability_score), 2) AS avg_crawlability,
  ROUND(AVG(structured_score), 2) AS avg_structured,
  ROUND(AVG(answerability_score), 2) AS avg_answerability,
  ROUND(AVG(trust_score), 2) AS avg_trust,
  ROUND(AVG(visibility_score), 2) AS avg_visibility,
  SUM(CASE WHEN visibility_score > 0 THEN 1 ELSE 0 END) AS audits_with_visibility
FROM audit_scores
WHERE score_model_version = 'v2.1'
  AND created_at >= datetime('now', '-7 days')
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- 8. Error Rate Analysis
SELECT
  DATE(created_at) AS date,
  COUNT(*) AS total_audits,
  SUM(CASE WHEN overall_score = 0 THEN 1 ELSE 0 END) AS zero_score_audits,
  ROUND(SUM(CASE WHEN overall_score = 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS error_rate
FROM audit_scores
WHERE score_model_version = 'v2.1'
  AND created_at >= datetime('now', '-7 days')
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- 9. Performance Metrics
SELECT
  'v2.1 Audits (Last 24h)' AS metric,
  COUNT(*) AS value
FROM audit_scores
WHERE score_model_version = 'v2.1'
  AND created_at >= datetime('now', '-1 day')

UNION ALL

SELECT
  'v2.1 Audits (Last 7 days)' AS metric,
  COUNT(*) AS value
FROM audit_scores
WHERE score_model_version = 'v2.1'
  AND created_at >= datetime('now', '-7 days')

UNION ALL

SELECT
  'Average v2.1 Overall Score' AS metric,
  ROUND(AVG(overall_score), 2) AS value
FROM audit_scores
WHERE score_model_version = 'v2.1'
  AND created_at >= datetime('now', '-7 days')

UNION ALL

SELECT
  'Audits with Visibility Data' AS metric,
  COUNT(*) AS value
FROM audit_scores
WHERE score_model_version = 'v2.1'
  AND visibility_score > 0
  AND created_at >= datetime('now', '-7 days');
