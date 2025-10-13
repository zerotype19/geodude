# Phase 5 Implementation Checklist for Cursor

## 🎯 **Sprint 1: Drift Tracking & Visibility Scoring (Weeks 1-3)**

### **Phase 5.1: Database Schema & Migrations**

#### **1.1 Create New Tables Migration**
```sql
-- File: db/migrations/0016_phase5_visibility_tables.sql
CREATE TABLE ai_visibility_scores (
  id TEXT PRIMARY KEY,
  day DATE NOT NULL,
  assistant TEXT NOT NULL,
  domain TEXT NOT NULL,
  score_0_100 REAL NOT NULL,
  citations_count INTEGER DEFAULT 0,
  unique_domains_count INTEGER DEFAULT 0,
  recency_score REAL DEFAULT 0,
  drift_pct REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(day, assistant, domain)
);

CREATE TABLE ai_visibility_rankings (
  id TEXT PRIMARY KEY,
  week_start DATE NOT NULL,
  assistant TEXT NOT NULL,
  domain TEXT NOT NULL,
  domain_rank INTEGER NOT NULL,
  mentions_count INTEGER DEFAULT 0,
  share_pct REAL DEFAULT 0,
  previous_rank INTEGER,
  rank_change INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(week_start, assistant, domain)
);

CREATE TABLE ai_geo_index (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  assistants_seen INTEGER DEFAULT 0,
  backlinks_ai INTEGER DEFAULT 0,
  recency_score REAL DEFAULT 0,
  geo_index_score REAL NOT NULL,
  citations_count INTEGER DEFAULT 0,
  content_quality_score REAL DEFAULT 0,
  measured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(url, measured_at)
);

CREATE TABLE ai_alerts (
  id TEXT PRIMARY KEY,
  day DATE NOT NULL,
  type TEXT NOT NULL, -- 'drift', 'error', 'threshold', 'trend'
  message TEXT NOT NULL,
  severity TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
  domain TEXT,
  assistant TEXT,
  resolved BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Performance indices
CREATE INDEX idx_visibility_scores_day_assistant ON ai_visibility_scores(day, assistant);
CREATE INDEX idx_visibility_scores_domain ON ai_visibility_scores(domain);
CREATE INDEX idx_rankings_week_assistant ON ai_visibility_rankings(week_start, assistant);
CREATE INDEX idx_geo_index_domain ON ai_geo_index(domain);
CREATE INDEX idx_alerts_day_type ON ai_alerts(day, type);
```

#### **1.2 Run Migration**
```bash
# Apply migration to production
wrangler d1 execute optiview_db --file=db/migrations/0016_phase5_visibility_tables.sql --remote
```

### **Phase 5.2: Visibility Scoring Algorithm**

#### **2.1 Create Visibility Scoring Service**
```typescript
// File: src/services/visibility/visibility-scorer.ts
export class VisibilityScorer {
  async calculateVisibilityScore(
    domain: string, 
    assistant: string, 
    day: string
  ): Promise<{
    score: number;
    citationsCount: number;
    uniqueDomainsCount: number;
    recencyScore: number;
    driftPct: number;
  }> {
    // Get citations for domain/assistant/day
    const citations = await this.getCitations(domain, assistant, day);
    
    // Get 30-day median for normalization
    const medianCitations = await this.getMedianCitations(domain, assistant, 30);
    
    // Calculate components
    const citationScore = (citations.length / Math.max(medianCitations, 1)) * 50;
    const diversityScore = await this.calculateDiversityScore(domain, assistant, day) * 30;
    const recencyScore = await this.calculateRecencyScore(domain, assistant, day) * 20;
    
    const totalScore = Math.min(100, citationScore + diversityScore + recencyScore);
    
    // Calculate drift from previous week
    const driftPct = await this.calculateDrift(domain, assistant, day);
    
    return {
      score: Math.round(totalScore * 100) / 100,
      citationsCount: citations.length,
      uniqueDomainsCount: await this.getUniqueDomainsCount(domain, assistant, day),
      recencyScore: Math.round(recencyScore * 100) / 100,
      driftPct: Math.round(driftPct * 100) / 100
    };
  }
  
  private async getCitations(domain: string, assistant: string, day: string) {
    // Implementation to fetch citations from ai_citations table
  }
  
  private async getMedianCitations(domain: string, assistant: string, days: number) {
    // Implementation to calculate 30-day median citations
  }
  
  private async calculateDiversityScore(domain: string, assistant: string, day: string) {
    // Implementation to calculate domain diversity score
  }
  
  private async calculateRecencyScore(domain: string, assistant: string, day: string) {
    // Implementation to calculate recency score
  }
  
  private async calculateDrift(domain: string, assistant: string, day: string) {
    // Implementation to calculate week-over-week drift percentage
  }
}
```

#### **2.2 Create GEO Index Calculator**
```typescript
// File: src/services/visibility/geo-index-calculator.ts
export class GeoIndexCalculator {
  async calculateGeoIndex(url: string): Promise<{
    geoIndexScore: number;
    assistantsSeen: number;
    backlinksAi: number;
    recencyScore: number;
    citationsCount: number;
    contentQualityScore: number;
  }> {
    // Get citations for this URL across all assistants
    const citations = await this.getUrlCitations(url);
    
    // Calculate components
    const aiVisibilityScore = (citations.length / await this.getTotalAiAnswers()) * 60;
    const diversityScore = (citations.length / 3) * 25; // 3 assistants max
    const freshnessScore = await this.calculateFreshnessScore(url) * 15;
    
    const geoIndexScore = Math.min(100, aiVisibilityScore + diversityScore + freshnessScore);
    
    return {
      geoIndexScore: Math.round(geoIndexScore * 100) / 100,
      assistantsSeen: await this.getAssistantsSeen(url),
      backlinksAi: citations.length,
      recencyScore: await this.calculateRecencyScore(url),
      citationsCount: citations.length,
      contentQualityScore: await this.calculateContentQualityScore(url)
    };
  }
  
  private async getUrlCitations(url: string) {
    // Implementation to fetch citations for specific URL
  }
  
  private async getTotalAiAnswers() {
    // Implementation to get total AI answers in system
  }
  
  private async calculateFreshnessScore(url: string) {
    // Implementation to calculate freshness score (≤7 days = 15 points)
  }
  
  private async getAssistantsSeen(url: string) {
    // Implementation to count unique assistants that cited this URL
  }
  
  private async calculateRecencyScore(url: string) {
    // Implementation to calculate recency score
  }
  
  private async calculateContentQualityScore(url: string) {
    // Implementation to calculate content quality score
  }
}
```

### **Phase 5.3: Nightly Rollup Worker**

#### **3.1 Create Nightly Rollup Service**
```typescript
// File: src/services/visibility/nightly-rollup.ts
export class NightlyRollupService {
  async runNightlyRollup(): Promise<void> {
    console.log('[NightlyRollup] Starting nightly visibility rollup...');
    
    const today = new Date().toISOString().split('T')[0];
    const assistants = ['perplexity', 'chatgpt_search', 'claude'];
    
    for (const assistant of assistants) {
      await this.processAssistant(assistant, today);
    }
    
    await this.calculateRankings(today);
    await this.generateAlerts(today);
    
    console.log('[NightlyRollup] Nightly rollup completed successfully');
  }
  
  private async processAssistant(assistant: string, day: string) {
    // Get all domains that had citations for this assistant today
    const domains = await this.getDomainsWithCitations(assistant, day);
    
    for (const domain of domains) {
      const score = await this.visibilityScorer.calculateVisibilityScore(domain, assistant, day);
      await this.saveVisibilityScore(domain, assistant, day, score);
    }
  }
  
  private async calculateRankings(day: string) {
    // Calculate weekly rankings for each assistant
    const weekStart = this.getWeekStart(day);
    const assistants = ['perplexity', 'chatgpt_search', 'claude'];
    
    for (const assistant of assistants) {
      const rankings = await this.calculateAssistantRankings(assistant, weekStart);
      await this.saveRankings(assistant, weekStart, rankings);
    }
  }
  
  private async generateAlerts(day: string) {
    // Generate alerts for significant changes, errors, etc.
    await this.checkDriftAlerts(day);
    await this.checkErrorAlerts(day);
    await this.checkThresholdAlerts(day);
  }
}
```

#### **3.2 Add to Cron Schedule**
```typescript
// File: src/index.ts (update scheduled handler)
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const cron = event.cron;
    
    if (cron === '0 2 * * *') { // 2 AM daily
      // Existing nightly metrics
      await runNightlyMetrics(env);
    }
    
    if (cron === '0 3 * * *') { // 3 AM daily - NEW
      // Phase 5 nightly rollup
      const rollupService = new NightlyRollupService(env);
      await rollupService.runNightlyRollup();
    }
    
    // ... existing cron handlers
  }
}
```

### **Phase 5.4: API Endpoints**

#### **4.1 Create Visibility Analytics Routes**
```typescript
// File: src/routes/visibility-analytics.ts
export function createVisibilityAnalyticsRoutes(env: Env) {
  return {
    async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url);
      const path = url.pathname;
      
      // CORS headers
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      };
      
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
      }
      
      try {
        // GET /api/visibility/score?domain=x&assistant=y&day=z
        if (path === '/api/visibility/score') {
          const domain = url.searchParams.get('domain');
          const assistant = url.searchParams.get('assistant') || 'all';
          const day = url.searchParams.get('day') || new Date().toISOString().split('T')[0];
          
          if (!domain) {
            return new Response(JSON.stringify({ error: 'Domain parameter required' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          const scorer = new VisibilityScorer(env);
          const score = await scorer.getVisibilityScore(domain, assistant, day);
          
          return new Response(JSON.stringify(score), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // GET /api/visibility/rankings?assistant=x&period=7d
        if (path === '/api/visibility/rankings') {
          const assistant = url.searchParams.get('assistant') || 'all';
          const period = url.searchParams.get('period') || '7d';
          
          const rankings = await getVisibilityRankings(env, assistant, period);
          
          return new Response(JSON.stringify(rankings), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // GET /api/visibility/drift?domain=x&assistant=y
        if (path === '/api/visibility/drift') {
          const domain = url.searchParams.get('domain');
          const assistant = url.searchParams.get('assistant') || 'all';
          
          if (!domain) {
            return new Response(JSON.stringify({ error: 'Domain parameter required' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          const drift = await getVisibilityDrift(env, domain, assistant);
          
          return new Response(JSON.stringify(drift), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // GET /api/geo-index?domain=x
        if (path === '/api/geo-index') {
          const domain = url.searchParams.get('domain');
          
          if (!domain) {
            return new Response(JSON.stringify({ error: 'Domain parameter required' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          const geoIndex = await getGeoIndex(env, domain);
          
          return new Response(JSON.stringify(geoIndex), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } catch (error) {
        console.error('[VisibilityAnalytics] Error:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
  };
}
```

### **Phase 5.5: Testing & Validation**

#### **5.1 Create Unit Tests**
```typescript
// File: src/tests/visibility-scorer.test.ts
import { VisibilityScorer } from '../services/visibility/visibility-scorer';

describe('VisibilityScorer', () => {
  test('should calculate visibility score correctly', async () => {
    const scorer = new VisibilityScorer(mockEnv);
    const result = await scorer.calculateVisibilityScore('example.com', 'perplexity', '2025-10-13');
    
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.citationsCount).toBeGreaterThanOrEqual(0);
    expect(result.driftPct).toBeDefined();
  });
  
  test('should handle empty citations gracefully', async () => {
    const scorer = new VisibilityScorer(mockEnv);
    const result = await scorer.calculateVisibilityScore('nonexistent.com', 'perplexity', '2025-10-13');
    
    expect(result.score).toBe(0);
    expect(result.citationsCount).toBe(0);
  });
});
```

#### **5.2 Create Integration Tests**
```typescript
// File: src/tests/visibility-analytics.test.ts
import { createVisibilityAnalyticsRoutes } from '../routes/visibility-analytics';

describe('Visibility Analytics API', () => {
  test('GET /api/visibility/score should return score for domain', async () => {
    const routes = createVisibilityAnalyticsRoutes(mockEnv);
    const request = new Request('https://api.example.com/api/visibility/score?domain=example.com');
    const response = await routes.fetch(request);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.score).toBeDefined();
    expect(data.citationsCount).toBeDefined();
  });
  
  test('GET /api/visibility/rankings should return rankings', async () => {
    const routes = createVisibilityAnalyticsRoutes(mockEnv);
    const request = new Request('https://api.example.com/api/visibility/rankings?assistant=perplexity');
    const response = await routes.fetch(request);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });
});
```

### **Phase 5.6: Feature Flags & Environment**

#### **6.1 Add Phase 5 Feature Flag**
```toml
# File: wrangler.toml
[env.production.vars]
# ... existing vars
FEATURE_PHASE5_ANALYTICS = "true"
```

#### **6.2 Update Environment Interface**
```typescript
// File: src/index.ts
interface Env {
  // ... existing env vars
  FEATURE_PHASE5_ANALYTICS?: string;
}
```

### **Phase 5.7: Monitoring & Alerts**

#### **7.1 Create Phase 5 Monitoring Script**
```javascript
// File: scripts/phase5-monitoring.js
const { execSync } = require('child_process');

async function monitorPhase5() {
  console.log('=== Phase 5 Analytics Monitoring ===');
  
  // Check if Phase 5 tables exist
  console.log('1. Checking Phase 5 tables...');
  const tablesResult = execSync('wrangler d1 execute optiview_db --command "SELECT name FROM sqlite_master WHERE type=\'table\' AND name LIKE \'ai_visibility%\' OR name LIKE \'ai_geo%\' OR name LIKE \'ai_alert%\'" --remote', { encoding: 'utf8' });
  console.log(tablesResult);
  
  // Check visibility scores
  console.log('2. Checking visibility scores...');
  const scoresResult = execSync('wrangler d1 execute optiview_db --command "SELECT COUNT(*) as count, MAX(day) as latest FROM ai_visibility_scores" --remote', { encoding: 'utf8' });
  console.log(scoresResult);
  
  // Check rankings
  console.log('3. Checking rankings...');
  const rankingsResult = execSync('wrangler d1 execute optiview_db --command "SELECT COUNT(*) as count, MAX(week_start) as latest FROM ai_visibility_rankings" --remote', { encoding: 'utf8' });
  console.log(rankingsResult);
  
  // Check alerts
  console.log('4. Checking alerts...');
  const alertsResult = execSync('wrangler d1 execute optiview_db --command "SELECT COUNT(*) as count, type, severity FROM ai_alerts WHERE day >= date(\'now\', \'-7 days\') GROUP BY type, severity" --remote', { encoding: 'utf8' });
  console.log(alertsResult);
  
  // Test API endpoints
  console.log('5. Testing API endpoints...');
  try {
    const scoreResponse = execSync('curl -s "https://geodude-api.kevin-mcgovern.workers.dev/api/visibility/score?domain=example.com"', { encoding: 'utf8' });
    console.log('Score API:', scoreResponse);
  } catch (error) {
    console.log('Score API not yet available');
  }
  
  console.log('=== Phase 5 Monitoring Complete ===');
}

monitorPhase5().catch(console.error);
```

### **Phase 5.8: Deployment Checklist**

#### **8.1 Pre-Deployment**
- [ ] Create feature branch: `feature/visibility-scoring`
- [ ] Run migration on staging database
- [ ] Test scoring algorithms with sample data
- [ ] Verify API endpoints respond correctly
- [ ] Run unit and integration tests

#### **8.2 Deployment**
- [ ] Deploy to production with feature flag OFF
- [ ] Run migration on production database
- [ ] Enable feature flag: `FEATURE_PHASE5_ANALYTICS=true`
- [ ] Deploy updated worker
- [ ] Verify nightly rollup runs successfully

#### **8.3 Post-Deployment**
- [ ] Run monitoring script to verify tables populated
- [ ] Test API endpoints with real data
- [ ] Verify scoring calculations are accurate
- [ ] Check alert generation is working
- [ ] Monitor for 24 hours before proceeding to Sprint 2

---

## 🎯 **Sprint 1 Success Criteria**

- [ ] All 4 new database tables created and populated
- [ ] Visibility scoring algorithm working (0-100 scale)
- [ ] Nightly rollup processing citations and generating scores
- [ ] 4 API endpoints responding with correct data
- [ ] Unit tests passing for scoring algorithms
- [ ] Monitoring script showing healthy data flow
- [ ] Feature flag controlling Phase 5 functionality
- [ ] No performance impact on existing Phase 4 system

---

## 🚀 **Ready to Start Sprint 1!**

This checklist provides everything needed to implement Phase 5 Sprint 1 cleanly. Each task is specific, testable, and builds toward the complete AI Visibility Intelligence Platform.

**Next: Create the feature branch and start with the database migration!** 🎯
