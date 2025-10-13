#!/bin/bash
# 48-Hour Production Monitoring Script
# Run every 6 hours to verify assistant activity

echo "=== 48-Hour Production Monitoring - $(date) ==="

echo "1️⃣ Checking assistant activity..."
node scripts/final-monitoring.js

echo "2️⃣ Checking citation counts by assistant..."
wrangler d1 execute optiview_db --command "SELECT assistant, COUNT(*) as citations, COUNT(DISTINCT source_domain) as domains, MAX(occurred_at) as last_seen FROM ai_citations GROUP BY assistant ORDER BY citations DESC;" --remote

echo "3️⃣ Checking recent runs..."
wrangler d1 execute optiview_db --command "SELECT assistant, status, COUNT(*) as count, MAX(created_at) as latest FROM assistant_runs WHERE created_at > datetime('now', '-24 hours') GROUP BY assistant, status ORDER BY latest DESC;" --remote

echo "4️⃣ Checking cost tracking..."
wrangler kv get VIS_COST_DAILY --namespace=optiview_kv || echo "No cost data yet"

echo "5️⃣ Checking error rates..."
wrangler d1 execute optiview_db --command "SELECT assistant, COUNT(*) as total_runs, SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_runs, ROUND(SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as error_rate FROM assistant_runs WHERE created_at > datetime('now', '-24 hours') GROUP BY assistant;" --remote

echo "=== Monitoring Complete ==="

