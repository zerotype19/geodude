# Scoring Criteria Exports

This directory contains exports of the `scoring_criteria` D1 table for editing and re-importing.

## Files

- `scoring_criteria_current_formatted.json` - **Latest export** - Use this for editing
- `scoring_criteria_current_YYYYMMDD_HHMMSS.json` - Raw wrangler output (timestamped)
- `scoring_criteria_latest.json` - Previous export (for reference)

## Export Process

To export current D1 content:
```bash
cd packages/audit-worker
wrangler d1 execute optiview --remote --json --command "SELECT * FROM scoring_criteria ORDER BY display_order, id" > exports/scoring_criteria_export.json
jq '.[0].results' exports/scoring_criteria_export.json > exports/scoring_criteria_current_formatted.json
```

## Import Process

After editing `scoring_criteria_current_formatted.json`:
```bash
cd packages/audit-worker
node scripts/import-enriched-criteria.js
```

Or manually via SQL:
```bash
wrangler d1 execute optiview --remote --file=path/to/update.sql
```

## Schema

Each criterion has these fields:

### Core Fields
- `id` - Unique identifier (e.g., "C1_title_quality")
- `version` - Schema version (currently 1)
- `label` - Display name
- `description` - Brief description
- `category` - One of: Technical Foundations, Structure & Organization, Content & Clarity, Authority & Trust, Crawl & Discoverability, Experience & Performance
- `scope` - "page" or "site"
- `weight` - Scoring weight (1-12)
- `impact_level` - "High", "Medium", or "Low"
- `pass_threshold` - Score threshold for passing (typically 85)
- `warn_threshold` - Score threshold for warning (typically 60)
- `check_type` - "html_dom", "llm", "aggregate", or "http"
- `enabled` - 1 (enabled) or 0 (disabled)
- `preview` - 0 (production) or 1 (preview mode)

### Educational Fields
- `why_it_matters` - Why this check is important (required)
- `how_to_fix` - Step-by-step fix instructions (required)
- `common_issues` - Typical problems found (required)
- `quick_fixes` - Fast remediation steps (required)
- `scoring_approach` - How the check is evaluated (e.g., "Automated HTML analysis")
- `examples` - Real examples (optional, currently null)
- `learn_more_links` - Educational resources (optional, currently null)
- `official_docs` - Official documentation links (optional, currently null)
- `references_json` - JSON array of reference URLs (optional, currently null)

### Metadata Fields
- `display_order` - Order within category for UI display
- `view_in_ui` - Where to find in UI (legacy field)
- `importance_rank` - 1 (Critical), 2 (High), 3 (Medium)
- `points_possible` - Maximum points (always 100)
- `created_at` - Timestamp
- `updated_at` - Timestamp

## Current Status (as of 2025-10-23)

- **Total Criteria**: 36 (23 page-level, 13 site-level)
- **All Enabled**: Yes (preview=0 for all)
- **Populated Fields**: 
  - ✅ why_it_matters: 36/36
  - ✅ how_to_fix: 36/36
  - ✅ common_issues: 36/36
  - ✅ quick_fixes: 36/36
  - ⚪ examples: 0/36 (null)
  - ⚪ learn_more_links: 0/36 (null)
  - ⚪ official_docs: 0/36 (null)

## Tips for Editing

1. **Keep IDs unchanged** - They're referenced throughout the codebase
2. **Maintain JSON structure** - Use `jq` to validate before importing
3. **Escape single quotes** - Use `''` in SQL strings or use the import script
4. **Test in local D1 first** - Remove `--remote` flag when testing
5. **Back up before importing** - Export current version first

## Validation

Before importing, validate the JSON:
```bash
jq empty scoring_criteria_current_formatted.json && echo "Valid JSON"
jq 'length' scoring_criteria_current_formatted.json  # Should be 36
jq 'map(select(.id == null or .label == null))' scoring_criteria_current_formatted.json  # Should be []
```
