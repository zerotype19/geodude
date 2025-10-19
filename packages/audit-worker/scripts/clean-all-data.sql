-- Clean All Data Script
-- Removes all audits, pages, citations, and related data
-- Keeps auth tables (users, sessions, magic_tokens)

-- Delete citations data
DELETE FROM ai_citations;
DELETE FROM ai_referrals;
DELETE FROM citations_runs;

-- Delete LLM prompt data
DELETE FROM llm_prompt_runs;
DELETE FROM llm_prompt_cache;
DELETE FROM llm_prompt_index;

-- Delete audit pages and analysis
DELETE FROM audit_page_analysis;
DELETE FROM audit_pages;

-- Delete audits
DELETE FROM audits;

-- Reset any auto-increment counters (SQLite doesn't have SERIAL, but we use UUIDs anyway)
-- Verify all tables are empty
SELECT 'audits' as table_name, COUNT(*) as count FROM audits
UNION ALL
SELECT 'audit_pages', COUNT(*) FROM audit_pages
UNION ALL
SELECT 'audit_page_analysis', COUNT(*) FROM audit_page_analysis
UNION ALL
SELECT 'ai_citations', COUNT(*) FROM ai_citations
UNION ALL
SELECT 'ai_referrals', COUNT(*) FROM ai_referrals
UNION ALL
SELECT 'citations_runs', COUNT(*) FROM citations_runs
UNION ALL
SELECT 'llm_prompt_runs', COUNT(*) FROM llm_prompt_runs
UNION ALL
SELECT 'llm_prompt_cache', COUNT(*) FROM llm_prompt_cache
UNION ALL
SELECT 'llm_prompt_index', COUNT(*) FROM llm_prompt_index;
