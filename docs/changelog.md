# Changelog

## [v0.8.0-phase-next-b] - 2025-10-13

### Added
- **Phase Next Step B**: E-E-A-T scoring system with 5-pillar methodology
- **7 Advanced Detectors**: Access testing, render parity, page type classification, schema fitness, answer fitness, E-E-A-T detection, performance metrics
- **Assistant Visibility Tracking**: Perplexity, ChatGPT Search, and Copilot integration (gated)
- **MVA (Multi-Vector Authority) Scoring**: Competitive analysis and citation tracking
- **Cloudflare Configuration Generator**: Bot management rules and robots.txt optimization
- **GA4 Integration**: AI traffic tracking and channel group management
- **Comprehensive API Routes**: `/api/visibility/*` endpoints for all new features
- **Monitoring & Rollback Scripts**: Automated health checks and emergency procedures
- **Robots.txt Optimization**: Proper crawler directives and sitemap integration

### Changed
- **Scoring System**: Upgraded from 4-card to 5-pillar methodology
- **Database Schema**: Added 5 new tables for Phase Next features (additive only)
- **Feature Flags**: All new features behind `FEATURE_EEAT_SCORING` and `FEATURE_ASSISTANT_VISIBILITY`

### Technical Details
- **Database**: 5 new tables (assistant_runs, assistant_prompts, assistant_outputs, ai_citations, ai_visibility_metrics)
- **KV Storage**: 3 new namespaces (PROMPT_PACKS, ASSISTANT_SCHEDULES, HEURISTICS)
- **API Endpoints**: 6 new visibility-related endpoints
- **Monitoring**: Automated drift detection and health checks

### Status
- ✅ **Step B (E-E-A-T Beta)**: Active and monitoring
- ⏳ **Step C (Visibility Rollout)**: Pending 48-hour validation
- 🔒 **Production Safety**: All features gated behind flags

---

## Previous Versions
- [v0.7.x] - Legacy 4-card scoring system
- [v0.6.x] - Basic audit functionality
