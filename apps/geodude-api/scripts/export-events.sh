#!/bin/bash

# Export interaction events script
# This script exports the last 1000 interaction events from project prj_UHoetismrowc

echo "🔄 Starting interaction events export..."

# Create output directory
mkdir -p exports
output_file="exports/interaction-events-$(date +%Y%m%d-%H%M%S).csv"

echo "📊 Exporting last 1000 interaction events from project prj_UHoetismrowc..."
echo "💾 Output file: $output_file"

# Create CSV header
echo "id,project_id,property_id,content_id,ai_source_id,event_type,metadata,occurred_at,sampled,class,bot_category" > "$output_file"

# Export data using wrangler and convert to CSV
echo "📥 Fetching data from database..."
wrangler d1 execute optiview_db --remote --command="SELECT id, project_id, property_id, content_id, ai_source_id, event_type, metadata, occurred_at, sampled, class, bot_category FROM interaction_events WHERE project_id = 'prj_UHoetismrowc' ORDER BY occurred_at DESC LIMIT 1000;" | tail -n +3 | head -n -1 | sed 's/│/,/g' | sed 's/^,//' | sed 's/,$//' | sed 's/^ *//' | sed 's/ *$//' >> "$output_file"

echo "✅ Export completed!"
echo "📁 File saved to: $output_file"
echo "📊 Total rows exported: $(wc -l < "$output_file")"
