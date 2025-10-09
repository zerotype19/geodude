# D1 Database Migrations

**Database**: `optiview_db` (975fb94d-9fac-4fd9-b8e2-41444f488334)

## Applied Migrations

### ✅ 0001_init.sql
**Applied**: 2025-10-09 13:14:16 UTC  
**Status**: Success  
**Changes**: Created 6 tables with indexes

**Tables Created**:
- `projects` - Project management
- `properties` - Property/domain tracking  
- `hits` - Traffic event collection
- `audits` - Audit orchestration
- `audit_pages` - Page-level audit results
- `audit_issues` - Issues discovered during audits

**Indexes Created**:
- `idx_properties_project` on properties(project_id)
- `idx_properties_domain` on properties(domain)
- `idx_hits_property` on hits(property_id)
- `idx_hits_created` on hits(created_at)
- `idx_hits_bot_type` on hits(bot_type)
- `idx_audits_property` on audits(property_id)
- `idx_audits_status` on audits(status)
- `idx_audits_started` on audits(started_at)
- `idx_audit_pages_audit` on audit_pages(audit_id)
- `idx_audit_issues_audit` on audit_issues(audit_id)
- `idx_audit_issues_severity` on audit_issues(severity)

---

### ✅ 0002_seed.sql
**Applied**: 2025-10-09 13:14:19 UTC  
**Status**: Success  
**Changes**: Inserted demo project and property

**Seed Data**:
```sql
-- Demo Project
INSERT INTO projects (id, name, api_key)
VALUES ('prj_demo', 'Demo', 'dev_key');

-- Demo Property (optiview.ai)
INSERT INTO properties (id, project_id, domain, verified)
VALUES ('prop_demo', 'prj_demo', 'optiview.ai', 1);
```

---

## Current Schema

**Tables**: 6 (+ d1_migrations)
- projects
- properties  
- hits
- audits
- audit_pages
- audit_issues

**Database Size**: 0.12 MB

---

## Migration Commands

### Apply New Migration (Remote)
```bash
npx wrangler d1 execute optiview_db --remote --file=db/migrations/XXXX_name.sql
```

### Apply New Migration (Local)
```bash
npx wrangler d1 execute optiview_db --local --file=db/migrations/XXXX_name.sql
```

### View Current Schema
```bash
npx wrangler d1 execute optiview_db --remote --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

### Check Migration History
```bash
npx wrangler d1 execute optiview_db --remote --command="SELECT * FROM d1_migrations ORDER BY id;"
```

---

## Next Migration

When creating a new migration:

1. Create file: `db/migrations/000X_description.sql`
2. Apply to local: `npx wrangler d1 execute optiview_db --local --file=db/migrations/000X_description.sql`
3. Test locally
4. Apply to remote: `npx wrangler d1 execute optiview_db --remote --file=db/migrations/000X_description.sql`
5. Update this MIGRATIONS.md file with details
6. Commit changes

---

## Rollback Strategy

D1 doesn't support automatic rollbacks. To rollback:

1. Create a new migration that reverses changes
2. Apply the rollback migration
3. Document in this file

Example:
```sql
-- 000X_rollback_feature.sql
DROP TABLE IF EXISTS new_table;
ALTER TABLE old_table ADD COLUMN removed_column TEXT;
```

