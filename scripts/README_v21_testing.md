# v2.1 Testing Scripts

This directory contains scripts to safely test the v2.1 scoring system against existing audits without recrawling.

## 🚀 Quick Start

### Test a Specific Audit
```bash
# Test recompute (fast - uses existing analysis)
tsx scripts/test_v21_audit.ts aud_1760616884674_hmddpnay8 recompute

# Test reanalyze (slower - re-parses stored HTML)
tsx scripts/test_v21_audit.ts aud_1760616884674_hmddpnay8 reanalyze
```

### Batch Process Multiple Audits
```bash
# Recompute last 10 audits (fast)
tsx scripts/batch_recompute_v21.ts --limit=10

# Reanalyze last 5 audits (slower but more thorough)
tsx scripts/batch_reanalyze_v21.ts --limit=5

# Dry run to see what would be processed
tsx scripts/batch_reanalyze_v21.ts --limit=10 --dry-run
```

## 📋 Script Details

### `test_v21_audit.ts`
- **Purpose**: Test v2.1 on a single specific audit
- **Usage**: `tsx scripts/test_v21_audit.ts <audit_id> [recompute|reanalyze]`
- **Features**:
  - Shows current audit info before processing
  - Tests either recompute or reanalyze
  - Displays results and scores
  - Quick validation for specific audits

### `batch_recompute_v21.ts`
- **Purpose**: Recalculate scores for multiple audits using existing analysis data
- **Usage**: `tsx scripts/batch_recompute_v21.ts [--limit=10] [--dry-run]`
- **Features**:
  - Fast processing (no HTML re-parsing)
  - Uses existing `audit_page_analysis` data
  - Applies v2.1 scoring weights
  - Progress logging and summary
  - Safe for production use

### `batch_reanalyze_v21.ts`
- **Purpose**: Full re-analysis of stored HTML with v2.1 enhanced analysis
- **Usage**: `tsx scripts/batch_reanalyze_v21.ts [--limit=5] [--dry-run]`
- **Features**:
  - Re-parses stored `audit_pages.body_text`
  - Populates new EEAT fields (author, dates, FAQ schema)
  - Computes v2.1 scores with enhanced data
  - More thorough but slower
  - Best for audits missing structured data

## 🔄 What Each Script Does

### Recompute (Fast)
1. Reads existing `audit_page_analysis` data
2. Applies v2.1 scoring weights (30/25/20/15/10)
3. Computes new scores
4. Saves to `audit_scores` table with `score_model_version='v2.1'`
5. UI automatically shows 5-card layout

### Reanalyze (Thorough)
1. Reads stored HTML from `audit_pages.body_text`
2. Runs enhanced v2.1 analyzer (EEAT, FAQ schema, etc.)
3. Updates `audit_page_analysis` with new fields
4. Computes v2.1 scores with enhanced data
5. Saves to `audit_scores` table
6. UI shows enhanced analysis and 5-card layout

## 🎯 Recommended Workflow

1. **Start with recompute** for quick validation:
   ```bash
   tsx scripts/test_v21_audit.ts aud_1760616884674_hmddpnay8 recompute
   ```

2. **Check the UI** - should show 5 cards with v2.1 scores

3. **If missing structured data**, run reanalyze:
   ```bash
   tsx scripts/test_v21_audit.ts aud_1760616884674_hmddpnay8 reanalyze
   ```

4. **For batch processing**, start small:
   ```bash
   tsx scripts/batch_recompute_v21.ts --limit=5
   ```

5. **Scale up** once validated:
   ```bash
   tsx scripts/batch_reanalyze_v21.ts --limit=20
   ```

## 🛡️ Safety Features

- **Dry run mode**: `--dry-run` shows what would be processed
- **Error handling**: Continues processing even if individual audits fail
- **Rate limiting**: Built-in delays to avoid overwhelming the API
- **Progress logging**: Shows real-time progress and results
- **Summary reports**: Detailed statistics after completion

## 📊 Expected Results

After running these scripts, you should see:

- **UI Updates**: 5-card layout with Visibility card
- **Model Badge**: "model v2.1" in scores tab
- **Enhanced Analysis**: FAQ chips, better structured data
- **Improved Scores**: More accurate scoring with v2.1 weights
- **New Issues**: v2.1 specific issue detection

## 🔧 Troubleshooting

### Script Fails to Run
- Ensure you have `tsx` installed: `npm install -g tsx`
- Check API is accessible: `curl https://geodude-api.kevin-mcgovern.workers.dev/status`

### No Changes in UI
- Check that v2.1 flags are enabled: `./scripts/rollout-v21.sh status`
- Verify audit has `score_model_version: "v2.1"` in API response
- Hard refresh the browser page

### Missing Structured Data
- Run reanalyze instead of recompute
- Check that `audit_pages.body_text` contains valid HTML
- Verify the audit completed successfully

## 🎉 Success Indicators

- ✅ 5 cards visible in UI (including Visibility)
- ✅ Model version shows "v2.1"
- ✅ FAQ chips appear in Pages tab
- ✅ Enhanced issue detection in Issues tab
- ✅ More accurate scoring with v2.1 weights
