# Phase 5 PRD Skeleton: AI Visibility Benchmarking & GEO Index

## 🎯 **Phase 5 Vision: AI Visibility Intelligence Platform**

Transform the multi-assistant citation network into a comprehensive **AI Visibility Intelligence Platform** that provides actionable insights, competitive benchmarking, and predictive analytics for Generative Engine Optimization (GEO).

---

## 📊 **Current State (Phase 4 Complete)**

✅ **Multi-Assistant Network Live:**
- Perplexity: 39 citations from 31 domains (native source_type)
- ChatGPT: Live connector with heuristic extraction
- Claude: Live connector with API key fixed
- Database: 49 total citations with proper attribution
- Production monitoring: 48-hour observation active

---

## 🚀 **Phase 5 Goals (4-Week Sprint)**

### **Week 1: Assistant Drift Tracking & Visibility Scoring**
- **Assistant drift tracking**: Compare top cited domains week-to-week per assistant
- **Visibility scoring (0-100)**: Blend citation count, diversity, recency, authority
- **Domain authority mapping**: Track which domains each assistant favors
- **Trend detection**: Identify rising/falling domains in AI visibility

### **Week 2: Competitive Benchmarking & Share-of-Voice**
- **Competitive benchmarking**: Tag rival domains; rank share-of-voice
- **Industry vertical analysis**: Track visibility by business category
- **Competitor tracking**: Monitor specific competitor domains
- **Market share analysis**: Calculate AI visibility market share

### **Week 3: Advanced UI & Dashboard Intelligence**
- **UI assistant filters**: "All / Perplexity / ChatGPT / Claude" toggle
- **Dashboard summaries**: Daily domain trends + top cited pages
- **Interactive charts**: Citation trends, domain rankings, assistant comparisons
- **Export capabilities**: CSV/JSON exports for external analysis

### **Week 4: GEO Index & Predictive Analytics**
- **GEO Index visibility**: Measure how well content performs across AI assistants
- **Generative-answer benchmarking**: Compare content quality vs competitors
- **Predictive insights**: Forecast visibility trends and opportunities
- **Optimization recommendations**: AI-powered suggestions for improving visibility

---

## 🏗️ **Technical Architecture**

### **New Database Tables**
```sql
-- Domain authority and trending
CREATE TABLE domain_authority (
  id TEXT PRIMARY KEY,
  domain TEXT UNIQUE NOT NULL,
  perplexity_score REAL DEFAULT 0,
  chatgpt_score REAL DEFAULT 0,
  claude_score REAL DEFAULT 0,
  combined_score REAL DEFAULT 0,
  trend_direction TEXT, -- 'rising', 'falling', 'stable'
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Competitive benchmarking
CREATE TABLE competitor_domains (
  id TEXT PRIMARY KEY,
  domain TEXT UNIQUE NOT NULL,
  industry_category TEXT,
  competitor_tier TEXT, -- 'primary', 'secondary', 'tertiary'
  tracking_enabled BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Visibility scoring and analytics
CREATE TABLE visibility_scores (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  visibility_score REAL NOT NULL, -- 0-100
  citation_count INTEGER DEFAULT 0,
  domain_diversity REAL DEFAULT 0,
  recency_score REAL DEFAULT 0,
  authority_score REAL DEFAULT 0,
  calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- GEO Index measurements
CREATE TABLE geo_index_metrics (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  page_url TEXT NOT NULL,
  geo_score REAL NOT NULL, -- 0-100
  perplexity_visibility REAL DEFAULT 0,
  chatgpt_visibility REAL DEFAULT 0,
  claude_visibility REAL DEFAULT 0,
  content_quality_score REAL DEFAULT 0,
  answer_fitness_score REAL DEFAULT 0,
  measured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);
```

### **New API Endpoints**
```typescript
// Visibility Intelligence API
GET /api/visibility/analytics/trends?projectId=...&days=30
GET /api/visibility/analytics/competitors?projectId=...&industry=...
GET /api/visibility/analytics/geo-index?projectId=...&url=...
POST /api/visibility/analytics/benchmark
GET /api/visibility/analytics/export?format=csv&projectId=...

// Competitive Intelligence
GET /api/visibility/competitors?domain=...&assistant=...
POST /api/visibility/competitors/track
DELETE /api/visibility/competitors/:id
GET /api/visibility/competitors/analysis?projectId=...

// GEO Index API
GET /api/geo-index/score?url=...&projectId=...
POST /api/geo-index/analyze
GET /api/geo-index/benchmarks?projectId=...
GET /api/geo-index/recommendations?projectId=...
```

### **New Services**
```typescript
// src/services/visibility/analytics/
- trends-analyzer.ts      // Week-over-week trend analysis
- competitor-tracker.ts   // Competitive domain monitoring
- visibility-scorer.ts    // 0-100 visibility scoring algorithm
- geo-index-calculator.ts // GEO Index measurement engine
- export-service.ts       // CSV/JSON export functionality

// src/services/visibility/ui/
- dashboard-widgets.ts    // Interactive dashboard components
- chart-generators.ts     // Chart.js/D3.js visualization
- filter-components.ts    // Assistant/domain filtering
- export-handlers.ts      // Download and export handlers
```

---

## 📈 **Key Metrics & KPIs**

### **Visibility Intelligence Metrics**
- **Visibility Score (0-100)**: Composite score based on citations, diversity, recency
- **Domain Authority**: Per-assistant domain preference scores
- **Trend Direction**: Rising/falling/stable domain visibility
- **Market Share**: Percentage of AI visibility within industry vertical
- **Competitive Gap**: Distance from top competitor in AI visibility

### **GEO Index Metrics**
- **GEO Score (0-100)**: Overall Generative Engine Optimization score
- **Assistant Coverage**: Visibility across Perplexity, ChatGPT, Claude
- **Content Quality**: Answer fitness and snippetability scores
- **Optimization Potential**: Room for improvement in AI visibility
- **Benchmark Position**: Rank vs industry competitors

### **Business Intelligence Metrics**
- **Share of Voice**: Percentage of AI mentions in your industry
- **Competitor Analysis**: Top 10 competitors by AI visibility
- **Opportunity Score**: Untapped AI visibility potential
- **ROI Tracking**: Visibility improvement vs optimization effort

---

## 🎨 **UI/UX Enhancements**

### **New Dashboard Tabs**
1. **Visibility Intelligence**: Trends, scores, competitive analysis
2. **GEO Index**: Content optimization scores and recommendations
3. **Competitive Analysis**: Competitor tracking and benchmarking
4. **Export & Reports**: Data export and scheduled reporting

### **Interactive Components**
- **Assistant Filter Toggle**: All/Perplexity/ChatGPT/Claude
- **Time Range Selector**: 7d/30d/90d/1y views
- **Domain Search**: Find specific domains in citation data
- **Trend Charts**: Line charts showing visibility over time
- **Competitor Comparison**: Side-by-side competitor analysis
- **GEO Score Gauge**: Visual representation of optimization level

### **Export Capabilities**
- **CSV Export**: Raw citation data with filters
- **JSON Export**: Structured data for API integration
- **PDF Reports**: Executive summaries with charts
- **Scheduled Reports**: Weekly/monthly automated reports

---

## 🔧 **Implementation Phases**

### **Phase 5.1: Analytics Foundation (Week 1)**
- [ ] Create new database tables and migrations
- [ ] Implement visibility scoring algorithm
- [ ] Build trend analysis service
- [ ] Add domain authority tracking
- [ ] Create analytics API endpoints

### **Phase 5.2: Competitive Intelligence (Week 2)**
- [ ] Build competitor tracking system
- [ ] Implement share-of-voice calculations
- [ ] Add industry vertical analysis
- [ ] Create competitive benchmarking API
- [ ] Build competitor management UI

### **Phase 5.3: Advanced UI & Visualization (Week 3)**
- [ ] Create interactive dashboard components
- [ ] Implement assistant filtering
- [ ] Build trend visualization charts
- [ ] Add export functionality
- [ ] Create responsive mobile views

### **Phase 5.4: GEO Index & Predictive Analytics (Week 4)**
- [ ] Implement GEO Index calculation
- [ ] Build content quality scoring
- [ ] Add predictive trend analysis
- [ ] Create optimization recommendations
- [ ] Build GEO Index dashboard

---

## 🚀 **Success Criteria**

### **Technical Success**
- [ ] All 4 database tables created and populated
- [ ] 8+ new API endpoints responding < 200ms
- [ ] Interactive dashboard with 5+ chart types
- [ ] Export functionality for CSV/JSON/PDF
- [ ] Mobile-responsive UI across all devices

### **Business Success**
- [ ] Visibility scores calculated for 100+ domains
- [ ] Competitive analysis for 10+ industry verticals
- [ ] GEO Index scores for 50+ pages
- [ ] 90%+ user satisfaction with new features
- [ ] 50%+ increase in user engagement time

### **Data Success**
- [ ] 1000+ citations analyzed for trends
- [ ] 100+ competitor domains tracked
- [ ] 50+ pages with GEO Index scores
- [ ] Weekly trend reports generated automatically
- [ ] Export functionality used by 80%+ of users

---

## 🎯 **Phase 5 Deliverables**

### **Week 1 Deliverables**
- ✅ Database schema with 4 new tables
- ✅ Visibility scoring algorithm (0-100)
- ✅ Trend analysis service
- ✅ Analytics API endpoints
- ✅ Basic dashboard components

### **Week 2 Deliverables**
- ✅ Competitor tracking system
- ✅ Share-of-voice calculations
- ✅ Industry vertical analysis
- ✅ Competitive benchmarking API
- ✅ Competitor management UI

### **Week 3 Deliverables**
- ✅ Interactive dashboard with charts
- ✅ Assistant filtering system
- ✅ Export functionality (CSV/JSON)
- ✅ Mobile-responsive design
- ✅ User testing and feedback

### **Week 4 Deliverables**
- ✅ GEO Index calculation engine
- ✅ Content quality scoring
- ✅ Predictive analytics
- ✅ Optimization recommendations
- ✅ Complete Phase 5 documentation

---

## 🔮 **Future Roadmap (Phase 6+)**

### **Phase 6: AI-Powered Optimization**
- **Content recommendations**: AI-generated suggestions for improving visibility
- **Automated A/B testing**: Test different content variations
- **Predictive modeling**: Forecast visibility changes
- **Integration APIs**: Connect with CMS and marketing tools

### **Phase 7: Enterprise Features**
- **Multi-tenant architecture**: Support for multiple organizations
- **Advanced analytics**: Machine learning-powered insights
- **Custom dashboards**: User-defined analytics views
- **API marketplace**: Third-party integrations and extensions

---

## 📋 **Phase 5 Kickoff Checklist**

### **Pre-Development**
- [ ] Review Phase 4 monitoring data and insights
- [ ] Validate current citation data quality
- [ ] Identify top 10 competitor domains for tracking
- [ ] Define industry vertical categories
- [ ] Create user stories for new features

### **Development Setup**
- [ ] Create Phase 5 feature branch
- [ ] Set up new database migrations
- [ ] Configure new API routes
- [ ] Set up analytics service architecture
- [ ] Create UI component library

### **Testing & Validation**
- [ ] Unit tests for scoring algorithms
- [ ] Integration tests for analytics APIs
- [ ] UI testing for dashboard components
- [ ] Performance testing for large datasets
- [ ] User acceptance testing

---

**Phase 5 represents the evolution from data collection to intelligence platform - transforming raw AI visibility data into actionable business insights and competitive intelligence.** 🚀

**Ready to begin Phase 5 development once 48-hour monitoring completes!** 📊
