-- Clear all audit-related data from D1 database
-- This will delete all audits, pages, analysis, and citations
-- Run with: wrangler d1 execute optiview --remote --file=clear-all-data.sql

-- Delete in order to respect foreign key constraints

-- 1. Delete citation data (if tables exist)
DELETE FROM ai_referrals;
DELETE FROM ai_citations;

-- 2. Delete audit page analysis
DELETE FROM audit_page_analysis;

-- 3. Delete audit pages
DELETE FROM audit_pages;

-- 4. Delete audits
DELETE FROM audits;

-- Verify tables are empty
SELECT 'audits' as table_name, COUNT(*) as remaining_rows FROM audits
UNION ALL
SELECT 'audit_pages', COUNT(*) FROM audit_pages
UNION ALL
SELECT 'audit_page_analysis', COUNT(*) FROM audit_page_analysis
UNION ALL
SELECT 'ai_citations', COUNT(*) FROM ai_citations
UNION ALL
SELECT 'ai_referrals', COUNT(*) FROM ai_referrals;
