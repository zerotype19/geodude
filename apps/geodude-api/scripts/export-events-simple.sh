#!/bin/bash

# Simple export script for interaction events
echo "🔄 Starting interaction events export..."

# Create output directory
mkdir -p exports
output_file="exports/interaction-events-$(date +%Y%m%d-%H%M%S).csv"

echo "📊 Exporting last 1000 interaction events from project prj_UHoetismrowc..."
echo "💾 Output file: $output_file"

# Create CSV header
echo "id,project_id,property_id,content_id,ai_source_id,event_type,metadata,occurred_at,sampled,class,bot_category" > "$output_file"

# Export data and save to temporary file
echo "📥 Fetching data from database..."
wrangler d1 execute optiview_db --remote --command="SELECT id, project_id, property_id, content_id, ai_source_id, event_type, metadata, occurred_at, sampled, class, bot_category FROM interaction_events WHERE project_id = 'prj_UHoetismrowc' ORDER BY occurred_at DESC LIMIT 1000;" > temp_export.txt

echo "📝 Processing data..."
# Remove the first 2 lines (wrangler header) and last line (summary)
tail -n +3 temp_export.txt | head -n -1 > temp_data.txt

# Convert to CSV format (replace │ with , and clean up)
sed 's/│/,/g' temp_data.txt | sed 's/^,//' | sed 's/,$//' | sed 's/^ *//' | sed 's/ *$//' >> "$output_file"

# Clean up temp files
rm temp_export.txt temp_data.txt

echo "✅ Export completed!"
echo "📁 File saved to: $output_file"
echo "📊 Total rows exported: $(wc -l < "$output_file")"
