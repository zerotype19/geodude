# Phase 4: Scalable Visibility — PRD Skeleton

## 🎯 **Executive Summary**

**Objective**: Scale AI visibility tracking across 5+ assistants with intelligent query generation and competitive benchmarking.

**Timeline**: 12 weeks (4 sprints × 3 weeks)
**Success Criteria**: 20%+ MVA improvement, 100+ queries/day, 50+ domains tracked

---

## 📋 **Phase 4 Requirements**

### **R1: Cross-Assistant Coverage**
- **R1.1**: ChatGPT Search connector (real implementation)
- **R1.2**: Copilot connector (real implementation)  
- **R1.3**: Claude Web connector (new)
- **R1.4**: You.com connector (new)
- **R1.5**: Gemini connector (new)
- **R1.6**: Unified connector interface

### **R2: GEO Indexing & Discovery**
- **R2.1**: Query expansion service (10-20 related queries per topic)
- **R2.2**: Intent classification (definition, comparison, best-of, how-to, troubleshooting)
- **R2.3**: Seasonal query generator (holiday, event, trend-based)
- **R2.4**: Competitor query analyzer
- **R2.5**: Topic clustering and trend detection

### **R3: AI Visibility Benchmarks**
- **R3.1**: Multi-assistant MVA scoring
- **R3.2**: Week-over-week trend analysis
- **R3.3**: Competitive positioning reports
- **R3.4**: Content gap analysis
- **R3.5**: Visibility forecasting

### **R4: Performance & Ops**
- **R4.1**: Async chunk processing
- **R4.2**: Rate monitoring and throttling
- **R4.3**: Connector health dashboard
- **R4.4**: Automated failover
- **R4.5**: Performance optimization

### **R5: UI Expansion**
- **R5.1**: Multi-assistant dashboard
- **R5.2**: Trend visualization
- **R5.3**: Competitive analysis tables
- **R5.4**: Content recommendations
- **R5.5**: Real-time activity feed

---

## 🏗️ **Architecture Changes**

### **New Services**
```typescript
// Query Intelligence
- QueryExpansionService
- IntentClassificationService  
- SeasonalQueryGenerator
- CompetitorQueryAnalyzer

// Advanced Analytics
- TrendAnalysisService
- CompetitiveBenchmarkService
- ContentGapAnalyzer
- VisibilityForecastingService

// Multi-Assistant Connectors
- ChatGPTSearchConnector
- CopilotConnector
- ClaudeWebConnector
- YouComConnector
- GeminiConnector
```

### **New Database Tables**
```sql
-- Query Intelligence
CREATE TABLE query_expansions (
  id TEXT PRIMARY KEY,
  base_query TEXT NOT NULL,
  expanded_queries TEXT NOT NULL, -- JSON array
  intent_tag TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Trend Analysis
CREATE TABLE visibility_trends (
  day TEXT NOT NULL,
  project_id TEXT NOT NULL,
  assistant TEXT NOT NULL,
  trend_score REAL NOT NULL,
  change_percentage REAL NOT NULL,
  PRIMARY KEY (day, project_id, assistant)
);

-- Content Gaps
CREATE TABLE content_gaps (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  missing_topic TEXT NOT NULL,
  competitor_domains TEXT, -- JSON array
  priority_score REAL NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### **New API Endpoints**
```typescript
// Query Intelligence
POST /api/visibility/queries/expand
GET /api/visibility/queries/intents
POST /api/visibility/queries/seasonal

// Advanced Analytics  
GET /api/visibility/analytics/trends
GET /api/visibility/analytics/competitive
GET /api/visibility/analytics/gaps
GET /api/visibility/analytics/forecast

// Multi-Assistant
GET /api/visibility/connectors/health
POST /api/visibility/connectors/test
GET /api/visibility/runs/recent
```

---

## 📅 **Sprint Planning**

### **Sprint 1 (Weeks 1-3): Connector Foundation**
- **Week 1**: ChatGPT Search connector
- **Week 2**: Copilot connector
- **Week 3**: Claude Web connector

### **Sprint 2 (Weeks 4-6): Query Intelligence**
- **Week 4**: Query expansion service
- **Week 5**: Intent classification
- **Week 6**: Seasonal query generator

### **Sprint 3 (Weeks 7-9): Advanced Analytics**
- **Week 7**: Trend analysis service
- **Week 8**: Competitive benchmarking
- **Week 9**: Content gap analysis

### **Sprint 4 (Weeks 10-12): UI & Optimization**
- **Week 10**: Multi-assistant dashboard
- **Week 11**: Performance optimization
- **Week 12**: Final testing & launch

---

## 🎯 **Success Metrics**

### **Coverage Metrics**
- **Assistant Coverage**: 5+ assistants (vs. 1 current)
- **Query Volume**: 100+ queries/day (vs. 10+ current)
- **Domain Coverage**: 50+ domains tracked (vs. 2 current)

### **Quality Metrics**
- **Citation Accuracy**: >95% valid citations
- **Parser Success**: >90% successful parsing
- **Data Freshness**: <1 hour from query to citation

### **Business Metrics**
- **MVA Improvement**: 20%+ visibility increase
- **Competitive Insights**: Weekly competitor reports
- **Content Recommendations**: 10+ actionable insights/week

---

## 🚀 **Implementation Strategy**

### **Incremental Rollout**
1. **Week 1**: Add ChatGPT Search connector
2. **Week 2**: Add Copilot connector  
3. **Week 3**: Add Claude Web connector
4. **Week 4**: Implement query expansion
5. **Week 5**: Add intent classification
6. **Week 6**: Add seasonal queries
7. **Week 7**: Implement trend analysis
8. **Week 8**: Add competitive benchmarking
9. **Week 9**: Add content gap analysis
10. **Week 10**: Build multi-assistant dashboard
11. **Week 11**: Performance optimization
12. **Week 12**: Final testing & launch

### **Risk Mitigation**
- **Rate Limiting**: Per-assistant rate limits
- **Fallback Logic**: Graceful degradation if connectors fail
- **Data Validation**: Enhanced citation validation
- **Monitoring**: Real-time connector health checks

---

## 📊 **Deliverables**

### **API Enhancements**
- `/api/visibility/connectors/health` - Connector status
- `/api/visibility/queries/expand` - Query expansion
- `/api/visibility/analytics/trends` - Trend analysis
- `/api/visibility/competitors/benchmark` - Competitive analysis

### **UI Features**
- **Multi-Assistant Dashboard**: Side-by-side visibility comparison
- **Trend Charts**: Week-over-week visibility changes
- **Competitor Analysis**: Domain comparison tables
- **Content Recommendations**: AI-generated content suggestions

### **Data Products**
- **Weekly Visibility Reports**: Automated PDF reports
- **Competitive Intelligence**: Monthly competitor analysis
- **Content Gap Analysis**: Quarterly content recommendations
- **ROI Tracking**: Visibility improvement metrics

---

## 🔧 **Technical Requirements**

### **Dependencies**
- **Phase Next**: Step C stable and monitored
- **48-hour observation**: Complete and green
- **Allowlist expansion**: 3-5 new projects added

### **Infrastructure**
- **Database**: New tables for trends, gaps, expansions
- **KV Storage**: Query cache, connector configs
- **API Routes**: 8 new endpoints
- **UI Components**: Multi-assistant dashboard

### **Performance**
- **Query Processing**: <5 seconds per query
- **Citation Parsing**: <2 seconds per response
- **Dashboard Load**: <3 seconds initial load
- **API Response**: <500ms average

---

## 🎉 **Phase 4 Success Criteria**

**Technical Success**:
- 5+ assistant connectors operational
- 100+ queries processed daily
- <1% error rate across all connectors
- Real-time monitoring and alerting

**Business Success**:
- 20%+ improvement in MVA scores
- Weekly competitive intelligence reports
- Actionable content recommendations
- Measurable ROI on visibility improvements

**User Success**:
- Intuitive multi-assistant dashboard
- Clear trend visualization
- Actionable insights and recommendations
- Seamless user experience

---

**Ready to begin Phase 4 after 48-hour Step C monitoring completes!** 🚀
