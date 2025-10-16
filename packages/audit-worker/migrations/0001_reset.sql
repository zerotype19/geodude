PRAGMA foreign_keys=OFF;

-- drop legacy/unknown tables safely
DROP TABLE IF EXISTS audits;
DROP TABLE IF EXISTS audit_pages;
DROP TABLE IF EXISTS audit_page_analysis;

PRAGMA foreign_keys=ON;
