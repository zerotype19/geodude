# Visibility Intelligence Methodology

## 📊 **Scoring Algorithm Overview**

Our Visibility Intelligence platform uses a sophisticated scoring system to measure how frequently and prominently domains appear in AI assistant responses.

### 🎯 **Core Metrics**

**Visibility Score (0-100)**
The primary metric that quantifies a domain's visibility across AI assistants.

```
Visibility Score = (Citation Frequency × 50%) + (Domain Diversity × 30%) + (Recency × 20%)

Where:
- Citation Frequency = (citations_today / median_citations_30d) × 50
- Domain Diversity = (unique_domains / total_domains_30d) × 30  
- Recency = Weighted score based on days since last citation
```

**Weekly Rankings**
Competitive analysis showing share-of-voice across AI assistants.

```
Share of Voice = (domain_mentions / total_mentions) × 100
Domain Rank = Position among all cited domains (1 = most cited)
```

### 🔍 **Data Collection Process**

**AI Assistant Integration**
- **Perplexity**: Native API integration with structured citation extraction
- **ChatGPT Search**: Heuristic URL extraction from response text
- **Claude**: Heuristic URL extraction from response text

**Citation Processing**
1. **Extraction**: URLs are extracted from AI responses using native APIs or heuristic parsing
2. **Normalization**: Domains are normalized (lowercase, www. stripping, canonical form)
3. **Deduplication**: Citations are deduplicated by domain, assistant, and time window
4. **Validation**: URLs are verified and categorized by source type (native vs heuristic)

**Scoring Calculation**
1. **Daily Aggregation**: Citations are aggregated by domain and assistant per day
2. **Frequency Analysis**: Citation counts are normalized against 30-day medians
3. **Diversity Scoring**: Unique domain counts are calculated and weighted
4. **Recency Weighting**: Recent citations receive higher weights (decay over 30 days)
5. **Final Score**: Components are combined into 0-100 visibility score

### 📅 **Update Cadence**

**Real-Time Processing**
- Citations processed every 5 minutes
- New citations immediately available in Recent Citations feed
- Live updates to citation counts and domain activity

**Daily Rollups**
- Visibility scores calculated daily at 4 AM UTC
- 30-day rolling averages updated
- Median normalization values refreshed

**Weekly Analysis**
- Competitive rankings updated weekly
- Share-of-voice calculations refreshed
- Trend analysis and drift detection

### 🎛️ **Scoring Components**

**Citation Frequency (50% weight)**
- Measures how often a domain appears in AI responses
- Normalized against 30-day median to prevent runaway leaders
- Accounts for seasonal variations and trending topics

**Domain Diversity (30% weight)**
- Measures how many unique domains cite the target domain
- Prevents gaming through single-source citation farming
- Encourages broad, organic citation patterns

**Recency (20% weight)**
- Recent citations receive higher weights
- Decay function over 30 days
- Ensures fresh, relevant content is prioritized

### 🔧 **Technical Implementation**

**Database Schema**
```sql
-- Daily visibility scores
ai_visibility_scores (
  day, assistant, domain, score_0_100,
  citations_count, unique_domains_count, recency_score, drift_pct
)

-- Weekly competitive rankings  
ai_visibility_rankings (
  week_start, assistant, domain, domain_rank,
  mentions_count, share_pct, rank_change
)

-- Raw citation data
ai_citations (
  project_id, assistant, source_domain, source_url,
  occurred_at, source_type, title, snippet
)
```

**Processing Pipeline**
1. **Citation Ingestion**: Raw citations stored with metadata
2. **Domain Normalization**: Consistent domain formatting
3. **Daily Aggregation**: Rollup to daily scores and metrics
4. **Weekly Analysis**: Competitive ranking calculations
5. **Trend Detection**: Drift analysis and alert generation

### 📈 **Quality Assurance**

**Data Validation**
- Citation URLs are validated for accessibility
- Domain normalization prevents duplicate counting
- Source type classification ensures data quality

**Scoring Accuracy**
- 30-day rolling normalization prevents bias
- Multiple assistant coverage reduces single-source dependency
- Recency weighting ensures relevance

**Performance Monitoring**
- Health checks every minute
- Error rate monitoring per assistant
- Cost tracking and rate limiting

### 🚨 **Edge Cases & Limitations**

**Assistant-Specific Behaviors**
- **Perplexity**: Provides structured citations with high accuracy
- **ChatGPT**: Often requires explicit prompts for URL inclusion
- **Claude**: Heuristic extraction may miss some citations

**Scoring Adjustments**
- If all scores cluster at 100, normalization may need adjustment
- Median-based normalization prevents outlier domination
- Recency decay ensures fresh content relevance

**Data Gaps**
- Empty results from assistants indicate prompt strategy needs
- Heuristic extraction may miss some citations
- Rate limiting may affect citation volume

### 🔄 **Continuous Improvement**

**Algorithm Refinements**
- Scoring weights adjusted based on performance data
- Normalization methods refined for better distribution
- New assistants added as APIs become available

**Prompt Optimization**
- Resource-style prompts improve URL inclusion rates
- Industry-specific prompts increase relevance
- A/B testing of prompt strategies

**Quality Enhancements**
- Improved heuristic URL extraction
- Better domain normalization rules
- Enhanced citation validation

### 📊 **Interpretation Guidelines**

**Score Ranges**
- **90-100**: Exceptional visibility, industry leader
- **70-89**: Strong visibility, regular citations
- **50-69**: Moderate visibility, occasional citations  
- **30-49**: Limited visibility, infrequent citations
- **0-29**: Minimal visibility, rare citations

**Trend Analysis**
- **Positive Drift**: Increasing visibility over time
- **Negative Drift**: Decreasing visibility (investigate causes)
- **Stable**: Consistent visibility (maintain current strategy)

**Competitive Context**
- Rankings show relative position among all cited domains
- Share-of-voice indicates market presence
- Assistant-specific rankings reveal platform strengths

---

*This methodology is continuously refined based on performance data and user feedback. For questions about specific scoring details, contact our data science team.*
