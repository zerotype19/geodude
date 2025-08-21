# Optiview Database Schema - Current State

## 🎯 Active Tables (Current Development)

### **`interaction_events`** - Main Event Store
**Purpose**: Central table for all traffic events with hardened AI classification

**Schema**:
```sql
- id: INTEGER PRIMARY KEY
- project_id: TEXT NOT NULL
- property_id: INTEGER REFERENCES properties(id)
- content_id: INTEGER REFERENCES content_assets(id)
- ai_source_id: INTEGER REFERENCES ai_sources(id)
- event_type: TEXT ('view', 'click', 'custom')
- class: TEXT ('ai_agent_crawl', 'human_via_ai', 'search', 'direct_human')
- sampled: INTEGER (0/1 for AI-Lite sampling)
- metadata: TEXT (JSON with classification details)
- occurred_at: TIMESTAMP
```

**Key Indexes**:
- `(project_id, occurred_at)` - Primary query pattern
- `(project_id, class, occurred_at)` - Traffic class filtering
- `(project_id, content_id, occurred_at)` - Content-specific queries
- `(project_id, ai_source_id, occurred_at)` - AI source filtering

**Metadata JSON Structure**:
```json
{
  "referrer_host": "lowercased_host",
  "referrer_path": "raw_path_max_256",
  "classification_reason": "string",
  "classification_confidence": 0.95,
  "user_agent": "string",
  "debug": ["array", "of", "debug", "info"]
}
```

### **`ai_sources`** - AI Source Catalog
**Purpose**: Catalog of AI tools, crawlers, and assistants

**Schema**:
```sql
- id: INTEGER PRIMARY KEY
- slug: TEXT (e.g., 'google', 'bing', 'chatgpt')
- name: TEXT (e.g., 'Google', 'Bing', 'ChatGPT')
- category: TEXT ('crawler', 'assistant', 'unknown')
- is_active: INTEGER (0/1)
- created_at: TIMESTAMP
```

### **`content_assets`** - Content URLs
**Purpose**: All content URLs being tracked

**Schema**:
```sql
- id: INTEGER PRIMARY KEY
- property_id: INTEGER REFERENCES properties(id)
- project_id: TEXT REFERENCES project(id)
- url: TEXT NOT NULL
- type: TEXT
- metadata: TEXT
- created_at: TIMESTAMP
```

### **`traffic_rollup_hourly`** - Hourly Aggregations
**Purpose**: Hourly traffic summaries for performance

**Schema**:
```sql
- project_id: TEXT NOT NULL
- property_id: INTEGER NOT NULL
- ts_hour: INTEGER (UTC epoch seconds)
- class: TEXT (traffic class)
- events_count: INTEGER (total events)
- sampled_count: INTEGER (sampled events only)
```

### **`session_v1`** - User Sessions
**Purpose**: User session tracking

### **`session_event_map`** - Session-Event Mapping
**Purpose**: Links events to sessions (many-to-many)

### **`ai_citation_event`** - Real AI Citations
**Purpose**: Explicit citations from AI tools (not just traffic)

**Schema**:
```sql
- id: INTEGER PRIMARY KEY
- project_id: TEXT NOT NULL
- ts: INTEGER (epoch milliseconds)
- surface: TEXT (AI tool name)
- query: TEXT (user query)
- url: TEXT (cited URL)
- rank: INTEGER
- confidence: REAL
```

## 🚫 Legacy Tables (Deprecated)

### **`ai_referrals`** - Legacy Referrals
**Status**: DEPRECATED - Use `interaction_events` with class filtering
**Migration**: Data migrated to `interaction_events`, compatibility view available

### **`property`** - Legacy Properties
**Status**: DEPRECATED - Use `properties` table instead
**Migration**: Compatibility view available

### **`crawler_visit`** - Legacy Crawler Tracking
**Status**: DEPRECATED - Use `interaction_events` with class filtering

### **`edge_click_event`** - Legacy Click Tracking
**Status**: DEPRECATED - Use `interaction_events` with event_type filtering

## 🔄 Data Flow Architecture

```
External Traffic → Cloudflare Worker → Classification → D1 Storage → Rollups → Dashboard
     ↓                    ↓              ↓           ↓           ↓         ↓
  User Agents        Hardened AI    interaction_  traffic_   Frontend   Real-time
  Referrers         Detection      events       rollup_    Queries    Display
  IPs               System         table        hourly     API        Updates
```

## 📊 Traffic Classification

### **Classes**:
- `ai_agent_crawl` - AI tools crawling content
- `human_via_ai` - Humans accessing via AI tools
- `search` - Search engine traffic
- `direct_human` - Direct human traffic

### **AI Sources**:
- **Crawlers**: Googlebot, Bingbot, etc.
- **Assistants**: ChatGPT, Claude, Gemini, etc.
- **Search**: Google Search, Bing Search, etc.

## 🎯 Current Development Focus

1. **Hardened AI Detection System** ✅
2. **Real-time Event Processing** ✅
3. **AI Citation Tracking** ✅
4. **Session Analysis** ✅
5. **Content Performance** ✅

## 🚧 Migration Status

- ✅ `interaction_events` - Active and populated
- ✅ `ai_sources` - Active and populated
- ✅ `content_assets` - Auto-discovered from events
- ✅ `traffic_rollup_hourly` - Hourly aggregations
- ✅ `session_v1` + `session_event_map` - Session tracking
- ✅ `ai_citation_event` - Real citations
- 🔄 `ai_referrals` - Compatibility view created
- 🔄 Legacy tables - Marked for cleanup

## 📋 Next Steps

1. **Verify Indexes**: Ensure all required indexes exist
2. **Test Endpoints**: Verify all API endpoints work correctly
3. **Clean Legacy**: Remove unused legacy tables
4. **Performance**: Monitor query performance and optimize
5. **Documentation**: Keep this schema doc updated
