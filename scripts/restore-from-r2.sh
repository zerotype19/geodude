#!/bin/bash

# Optiview D1 Restore from R2 Backups
# Usage: ./scripts/restore-from-r2.sh [YYYY-MM-DD] [--remote]

set -e

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                                                                      ║"
echo "║              📦 D1 RESTORE FROM R2 BACKUP                           ║"
echo "║                                                                      ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# Parse arguments
BACKUP_DATE=${1:-$(date -u +%F)}
ENV_FLAG=""
if [ "$2" = "--remote" ]; then
    ENV_FLAG="--remote"
    echo "⚠️  REMOTE MODE: Will restore to PRODUCTION database"
else
    ENV_FLAG="--local"
    echo "📍 LOCAL MODE: Will restore to local D1 database"
fi

echo "Backup date: $BACKUP_DATE"
echo ""

# Confirmation for remote
if [ "$ENV_FLAG" = "--remote" ]; then
    echo "⚠️  WARNING: This will modify PRODUCTION data!"
    read -p "Type 'RESTORE' to continue: " CONFIRM
    if [ "$CONFIRM" != "RESTORE" ]; then
        echo "Aborted."
        exit 1
    fi
    echo ""
fi

TABLES=("audits" "audit_pages" "audit_issues" "citations")
RESTORE_DIR="./restore_temp_$BACKUP_DATE"

echo "════════════════════════════════════════════════════════════════════════"
echo "Step 1: Download backup files from R2"
echo "════════════════════════════════════════════════════════════════════════"
echo ""

mkdir -p "$RESTORE_DIR"

for TABLE in "${TABLES[@]}"; do
    echo "Downloading $TABLE.jsonl..."
    npx wrangler r2 object get geodude-backups \
        "backups/$BACKUP_DATE/$TABLE.jsonl" \
        --file "$RESTORE_DIR/$TABLE.jsonl" 2>/dev/null || {
        echo "⚠️  Failed to download $TABLE.jsonl (may not exist)"
    }
done

echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo "Step 2: Verify downloaded files"
echo "════════════════════════════════════════════════════════════════════════"
echo ""

for TABLE in "${TABLES[@]}"; do
    if [ -f "$RESTORE_DIR/$TABLE.jsonl" ]; then
        LINE_COUNT=$(wc -l < "$RESTORE_DIR/$TABLE.jsonl")
        echo "✅ $TABLE.jsonl: $LINE_COUNT rows"
    else
        echo "❌ $TABLE.jsonl: missing"
    fi
done

echo ""
read -p "Continue with restore? (y/N): " CONTINUE
if [ "$CONTINUE" != "y" ] && [ "$CONTINUE" != "Y" ]; then
    echo "Aborted."
    rm -rf "$RESTORE_DIR"
    exit 1
fi

echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo "Step 3: Clear existing data (if requested)"
echo "════════════════════════════════════════════════════════════════════════"
echo ""

read -p "Clear existing tables before restore? (y/N): " CLEAR
if [ "$CLEAR" = "y" ] || [ "$CLEAR" = "Y" ]; then
    echo ""
    echo "Clearing tables..."
    for TABLE in "${TABLES[@]}"; do
        echo "  Clearing $TABLE..."
        npx wrangler d1 execute optiview_db $ENV_FLAG \
            --command "DELETE FROM $TABLE" 2>/dev/null || {
            echo "    ⚠️  Failed to clear $TABLE (may not exist)"
        }
    done
fi

echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo "Step 4: Restore data to D1"
echo "════════════════════════════════════════════════════════════════════════"
echo ""

for TABLE in "${TABLES[@]}"; do
    if [ ! -f "$RESTORE_DIR/$TABLE.jsonl" ]; then
        echo "⏭️  Skipping $TABLE (no backup file)"
        continue
    fi
    
    echo "Restoring $TABLE..."
    
    # Read JSONL and generate INSERT statements
    ROW_COUNT=0
    while IFS= read -r line; do
        ROW_COUNT=$((ROW_COUNT + 1))
        
        # Parse JSON based on table schema
        case $TABLE in
            "audits")
                ID=$(echo "$line" | jq -r '.id')
                PROPERTY_ID=$(echo "$line" | jq -r '.property_id')
                STATUS=$(echo "$line" | jq -r '.status')
                SCORE_OVERALL=$(echo "$line" | jq -r '.score_overall')
                SCORE_STRUCTURE=$(echo "$line" | jq -r '.score_structure')
                SCORE_IDENTITY=$(echo "$line" | jq -r '.score_identity')
                SCORE_CONTENT=$(echo "$line" | jq -r '.score_content')
                TOTAL_PAGES=$(echo "$line" | jq -r '.total_pages')
                TOTAL_ISSUES=$(echo "$line" | jq -r '.total_issues')
                CREATED_AT=$(echo "$line" | jq -r '.created_at')
                COMPLETED_AT=$(echo "$line" | jq -r '.completed_at // "null"')
                
                npx wrangler d1 execute optiview_db $ENV_FLAG --command \
                    "INSERT OR REPLACE INTO audits (id, property_id, status, score_overall, score_structure, score_identity, score_content, total_pages, total_issues, created_at, completed_at) VALUES ('$ID', '$PROPERTY_ID', '$STATUS', $SCORE_OVERALL, $SCORE_STRUCTURE, $SCORE_IDENTITY, $SCORE_CONTENT, $TOTAL_PAGES, $TOTAL_ISSUES, $CREATED_AT, $COMPLETED_AT)" \
                    2>/dev/null || echo "    ⚠️  Failed to insert row $ROW_COUNT"
                ;;
                
            "audit_pages")
                ID=$(echo "$line" | jq -r '.id')
                AUDIT_ID=$(echo "$line" | jq -r '.audit_id')
                URL=$(echo "$line" | jq -r '.url')
                TITLE=$(echo "$line" | jq -r '.title // ""' | sed "s/'/''/g")
                H1=$(echo "$line" | jq -r '.h1 // ""' | sed "s/'/''/g")
                
                npx wrangler d1 execute optiview_db $ENV_FLAG --command \
                    "INSERT OR REPLACE INTO audit_pages (id, audit_id, url, title, h1) VALUES ('$ID', '$AUDIT_ID', '$URL', '$TITLE', '$H1')" \
                    2>/dev/null || echo "    ⚠️  Failed to insert row $ROW_COUNT"
                ;;
                
            "audit_issues")
                ID=$(echo "$line" | jq -r '.id')
                AUDIT_ID=$(echo "$line" | jq -r '.audit_id')
                CATEGORY=$(echo "$line" | jq -r '.category')
                SEVERITY=$(echo "$line" | jq -r '.severity')
                MESSAGE=$(echo "$line" | jq -r '.message' | sed "s/'/''/g")
                PAGE_URL=$(echo "$line" | jq -r '.page_url // ""')
                
                npx wrangler d1 execute optiview_db $ENV_FLAG --command \
                    "INSERT OR REPLACE INTO audit_issues (id, audit_id, category, severity, message, page_url) VALUES ('$ID', '$AUDIT_ID', '$CATEGORY', '$SEVERITY', '$MESSAGE', '$PAGE_URL')" \
                    2>/dev/null || echo "    ⚠️  Failed to insert row $ROW_COUNT"
                ;;
                
            "citations")
                AUDIT_ID=$(echo "$line" | jq -r '.audit_id')
                ENGINE=$(echo "$line" | jq -r '.engine')
                QUERY=$(echo "$line" | jq -r '.query' | sed "s/'/''/g")
                URL=$(echo "$line" | jq -r '.url')
                TITLE=$(echo "$line" | jq -r '.title // ""' | sed "s/'/''/g")
                CITED_AT=$(echo "$line" | jq -r '.cited_at')
                
                npx wrangler d1 execute optiview_db $ENV_FLAG --command \
                    "INSERT OR REPLACE INTO citations (audit_id, engine, query, url, title, cited_at) VALUES ('$AUDIT_ID', '$ENGINE', '$QUERY', '$URL', '$TITLE', $CITED_AT)" \
                    2>/dev/null || echo "    ⚠️  Failed to insert row $ROW_COUNT"
                ;;
        esac
        
        # Progress indicator
        if [ $((ROW_COUNT % 10)) -eq 0 ]; then
            echo -n "."
        fi
    done < "$RESTORE_DIR/$TABLE.jsonl"
    
    echo ""
    echo "  ✅ Restored $ROW_COUNT rows to $TABLE"
done

echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo "Step 5: Verify restoration"
echo "════════════════════════════════════════════════════════════════════════"
echo ""

for TABLE in "${TABLES[@]}"; do
    COUNT=$(npx wrangler d1 execute optiview_db $ENV_FLAG \
        --command "SELECT COUNT(*) as count FROM $TABLE" \
        --json 2>/dev/null | jq -r '.[0].results[0].count // 0')
    echo "$TABLE: $COUNT rows"
done

echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo "Cleanup"
echo "════════════════════════════════════════════════════════════════════════"
echo ""

rm -rf "$RESTORE_DIR"
echo "✅ Temporary files cleaned up"

echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo "🎉 RESTORE COMPLETE!"
echo "════════════════════════════════════════════════════════════════════════"
echo ""

if [ "$ENV_FLAG" = "--remote" ]; then
    echo "⚠️  PRODUCTION database has been restored from $BACKUP_DATE backup"
    echo ""
    echo "Verify with:"
    echo "  curl -s https://api.optiview.ai/status | jq"
else
    echo "📍 LOCAL database has been restored from $BACKUP_DATE backup"
    echo ""
    echo "Test with:"
    echo "  npx wrangler dev packages/api-worker/src/index.ts"
fi

echo ""

