# Optiview Visibility Intelligence v1.0

## 🚀 Production Status: LIVE

**Optiview Visibility Intelligence** is now the **first working LLM-visibility tracker** spanning the three major AI assistants: Perplexity, ChatGPT Search, and Claude.

---

## 🎯 What It Does

> "Optiview now captures how each AI assistant—Perplexity, ChatGPT Search, and Claude—references web content. Every citation feeds into a normalized visibility score (0-100) and weekly share-of-voice ranking. The dashboard reveals where your content is discoverable *inside* generative engines, not just search engines."

### Key Capabilities

- **Multi-Assistant Tracking**: Real-time citation monitoring across 3 AI platforms
- **Visibility Scoring**: 0-100 normalized scores based on citation frequency, domain diversity, and recency
- **Weekly Rankings**: Share-of-voice analysis showing competitive positioning
- **Real-Time Filtering**: Switch between assistants to see unique citation ecosystems
- **CSV Export**: Download filtered data for analysis and reporting
- **Trend Analysis**: Track visibility drift and changes over time

---

## 📊 Live Data Summary

| Assistant | Status | Citations | Unique Domains | Sample Ecosystem |
|-----------|--------|-----------|----------------|------------------|
| **Perplexity** | ✅ Live | 90+ | 55+ | SEO tools, marketing sites, search engines |
| **ChatGPT Search** | ✅ Live | 10+ | 10+ | AI platforms, GitHub, Google services |
| **Claude** | ✅ Live | 10+ | 10+ | Development tools, Anthropic, programming resources |

---

## 🎮 Demo Flow

1. **Open Dashboard** → `/insights/visibility`
2. **Toggle Assistant Chips** → See unique ecosystems for each AI platform
3. **Export CSV** → One-click download for analysis
4. **Click Domain** → View score drawer (0-100 + drift percentage)
5. **Explain Insight** → "Each assistant forms its own ecosystem of citations"

---

## 🔧 Technical Architecture

### Backend
- **Real API Integrations**: Live connections to Perplexity, OpenAI ChatGPT, and Anthropic Claude
- **Citation Parsing**: Heuristic URL extraction with Markdown link support
- **Rollup Engine**: Automated daily scoring and weekly ranking calculations
- **Cost Management**: $10/day cap with automatic throttling

### Frontend
- **React Dashboard**: Real-time filtering and visualization
- **Assistant Filtering**: Instant switching between AI platforms
- **Export Capabilities**: CSV download with current filter applied
- **Responsive Design**: Works across desktop and mobile

### Data Pipeline
- **Queue Processing**: 5-minute cron jobs for run processing
- **Atomic Operations**: Prevents duplicate processing and race conditions
- **Error Handling**: Graceful fallbacks and circuit breaker patterns
- **Monitoring**: 72-hour observation scripts with alert thresholds

---

## 📈 Monitoring & Alerts

### Health Checks (Every 6 Hours)
- **Rollup Freshness**: < 6 hours gap
- **Error Rate**: < 5% connector failures
- **Cost Utilization**: < 80% of daily cap
- **Data Integrity**: All assistants generating citations

### Alert Thresholds
- Rollup gap > 6h → Manual rerun required
- Error rate > 5% → Disable problematic connector
- Cost > 80% cap → Pause new runs
- UI latency > 2s → Verify cache headers

---

## 🚀 Next Milestones

### Sprint 2: Trend Analysis (Post 72h)
- **Trend Lines**: 7-day visibility sparklines per assistant
- **Competitor Tagging**: Identify and track competitor domains
- **Drift Analysis**: Week-over-week visibility changes
- **Alert System**: Notifications for significant changes

### Sprint 3: Advanced Analytics
- **Content Performance**: Which pages get cited most
- **Assistant Preferences**: Platform-specific optimization insights
- **Competitive Benchmarking**: Industry visibility comparisons
- **Predictive Scoring**: Forecast visibility trends

---

## 🎯 Partner Benefits

1. **Unique Visibility**: First platform to track AI assistant citations
2. **Competitive Intelligence**: See where competitors appear in AI responses
3. **Content Optimization**: Understand what content AI assistants prefer
4. **Multi-Platform Strategy**: Optimize for each AI ecosystem differently
5. **Real-Time Monitoring**: Track visibility changes as they happen

---

## 📞 Support & Documentation

- **Dashboard**: `https://app.optiview.ai/insights/visibility`
- **API Health**: `https://api.optiview.ai/api/health/visibility`
- **Monitoring Scripts**: `scripts/live-verification.js` and `scripts/72h-monitoring.js`
- **Documentation**: Full API documentation and methodology guides

---

**Status**: ✅ **Production Ready**  
**Version**: v1.0  
**Last Updated**: October 13, 2025  
**Next Review**: 72-hour observation completion
