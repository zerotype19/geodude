-- Verify all tables are empty
SELECT 'audits' as table_name, COUNT(*) as row_count FROM audits
UNION ALL
SELECT 'audit_pages', COUNT(*) FROM audit_pages
UNION ALL
SELECT 'audit_page_analysis', COUNT(*) FROM audit_page_analysis
UNION ALL
SELECT 'ai_citations', COUNT(*) FROM ai_citations
UNION ALL
SELECT 'ai_referrals', COUNT(*) FROM ai_referrals;

