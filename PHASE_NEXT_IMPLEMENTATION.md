# Phase Next Implementation - Assistant Visibility & E-E-A-T

This document outlines the implementation of Phase Next features for Optiview, focusing on assistant visibility tracking and E-E-A-T (Experience, Expertise, Authority, Trust) scoring.

## 🚀 Features Implemented

### 1. Database Schema Extensions
- **Assistant Runs**: Track AI assistant query runs and their status
- **Assistant Prompts**: Store individual prompts used in runs
- **Assistant Outputs**: Store raw responses and parsed data
- **AI Citations Extended**: Enhanced citation tracking with prompt relationships
- **AI Visibility Metrics**: Daily aggregated metrics for MVA calculations

### 2. 5-Pillar Scoring System
- **Pillar A: Access & Indexability (35 pts)**
  - robots.txt presence
  - AI bot access testing
  - sitemap discovery
  - answer engine accessibility
  - render parity analysis

- **Pillar B: Entities & Structured Fitness (25 pts)**
  - Schema fitness validation
  - Entity graph analysis
  - Schema variety scoring

- **Pillar C: Answer Fitness (20 pts)**
  - Title and H1 presence
  - Content depth analysis
  - Chunkability assessment
  - Q&A scaffold detection

- **Pillar D: Authority/Safety/Provenance (12 pts)**
  - E-E-A-T scoring
  - Authority signals
  - Safety indicators

- **Pillar E: Performance & Stability (8 pts)**
  - Core Web Vitals
  - Performance metrics
  - Stability scoring

### 3. Advanced Detectors

#### Access Tester
- Tests access for multiple AI bot user agents
- Detects CDN/WAF blocking
- Identifies Cloudflare challenges
- Tracks response differences

#### Render Parity Detector
- Compares raw HTML vs headless-rendered content
- Uses Sørensen-Dice similarity on token trigrams
- Identifies content differences

#### Page Type Classifier
- Heuristic classification based on URL patterns and DOM signals
- Supports: article, product, faq, howto, about, qapage, other
- Confidence scoring for classifications

#### Schema Fitness Validator
- Validates JSON-LD schemas against page types
- Checks required properties per schema type
- Provides detailed validation feedback

#### Answer Fitness Detector
- Analyzes content for AI assistant answerability
- Measures chunkability, Q&A scaffolds, snippetability
- Tracks citation friendliness

#### E-E-A-T Detector
- **Experience**: Original images, methods phrasing, unique content
- **Expertise**: Person schemas, sameAs links, topical focus
- **Authority**: MVA scores, internal hub prominence
- **Trust**: About/contact pages, licensing, freshness

#### Performance Detector
- Core Web Vitals analysis (LCP, INP, CLS)
- Performance scoring with thresholds
- Stability assessment

### 4. Assistant Visibility System

#### Connectors
- **Perplexity**: Fetches and parses Perplexity results
- **ChatGPT Search**: Handles ChatGPT search results
- **Copilot**: Processes Copilot responses

#### MVA (Multi-Vector Authority) Service
- Calculates daily MVA scores
- Tracks mentions, diversity, stability, depth, freshness
- Generates impression estimates
- Identifies competitor domains

#### Visibility Service
- Manages assistant runs and prompts
- Executes queries asynchronously
- Stores citations and outputs
- Provides citation retrieval

### 5. Cloudflare Configuration Generator
- Bot Management rules for AI assistants
- robots.txt snippets
- Page rules for optimization
- Workers scripts for AI bot handling
- GA4 channel group configuration
- GA4 exploration templates

### 6. API Routes
- `POST /api/visibility/runs` - Create assistant runs
- `GET /api/visibility/runs/:id` - Get run status and results
- `GET /api/visibility/citations` - Retrieve citations
- `GET /api/visibility/mva` - Get MVA metrics
- `POST /api/visibility/cloudflare-config` - Generate Cloudflare config
- `GET /api/visibility/ga4-config` - Generate GA4 config

## 🔧 Configuration

### Environment Variables
```bash
# Feature flags
FEATURE_ASSISTANT_VISIBILITY=false
FEATURE_EEAT_SCORING=false

# Browser settings
BROWSER_CLUSTER_MAX=2
FETCH_TIMEOUT_MS=20000

# Rate limiting
VISIBILITY_RATE_LIMIT_PER_PROJECT=30

# Allowed answer engines
ALLOWED_ANSWER_ENGINES="perplexity,claude-web"

# GA4 configuration
GA4_REGEX_SNIPPET_URL=""
```

### KV Namespaces
- `PROMPT_PACKS`: Store prompt configurations per project
- `ASSISTANT_SCHEDULES`: Store scheduling configurations
- `HEURISTICS`: Store heuristic rules and weights

## 📊 Usage Examples

### Creating an Assistant Run
```typescript
const response = await fetch('/api/visibility/runs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    projectId: 'proj_123',
    assistant: 'perplexity',
    prompts: [
      { text: 'What is the best way to optimize for AI?', intentTag: 'definition' },
      { text: 'How do I improve my website for AI assistants?', intentTag: 'howto' }
    ]
  })
});
```

### Getting MVA Metrics
```typescript
const response = await fetch('/api/visibility/mva?project_id=proj_123&days=30');
const { metrics } = await response.json();
```

### Generating Cloudflare Config
```typescript
const response = await fetch('/api/visibility/cloudflare-config', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    domain: 'example.com',
    config: {
      allowedBots: ['PerplexityBot', 'Claude-Web', 'GPTBot'],
      rateLimit: 1,
      cacheTtl: 300,
      bypassChallenges: true
    }
  })
});
```

## 🧪 Testing

### Running Tests
```bash
# Run all tests
npm test

# Run specific test suites
npm test detectors
npm test scoring-v2
```

### Test Coverage
- Page type classification
- Schema fitness validation
- Answer fitness analysis
- E-E-A-T detection
- Render parity calculation
- Scoring system v2
- API route handling

## 🚦 Rollout Plan

### Phase 1: Feature Flags (Current)
- All features behind `FEATURE_ASSISTANT_VISIBILITY=false`
- All features behind `FEATURE_EEAT_SCORING=false`
- Database migrations ready
- API routes implemented

### Phase 2: Staging Testing
- Enable features for 1-2 test projects
- Validate scoring stability (±5% vs current model)
- Test assistant connectors
- Verify UI updates

### Phase 3: Gradual Rollout
- Enable `FEATURE_EEAT_SCORING=true` for all projects
- Enable `FEATURE_ASSISTANT_VISIBILITY=true` for premium projects
- Monitor performance and accuracy

### Phase 4: Full Deployment
- Enable all features for all projects
- Update documentation
- Provide user training

## 📈 Monitoring

### Key Metrics
- MVA score trends
- Citation volume by assistant
- E-E-A-T score improvements
- Performance impact
- Error rates

### Alerts
- Assistant connector failures
- High error rates in scoring
- Performance degradation
- Database migration issues

## 🔮 Future Enhancements

### Planned Features
- Real-time assistant monitoring
- Advanced competitor analysis
- Automated optimization recommendations
- Integration with more AI assistants
- Advanced E-E-A-T signals

### Technical Improvements
- Caching for assistant responses
- Batch processing for large projects
- Advanced rate limiting
- Performance optimizations

## 📚 Documentation

### API Reference
- [Visibility API Routes](./packages/api-worker/src/routes/visibility.ts)
- [Assistant Connectors](./packages/api-worker/src/assistant-connectors/)
- [Detectors](./packages/api-worker/src/detectors/)

### Database Schema
- [Migrations](./db/migrations/)
- [Schema Documentation](./db/MIGRATIONS.md)

### Configuration
- [Environment Variables](./packages/api-worker/wrangler.toml)
- [Cloudflare Setup](./packages/api-worker/src/cloudflare-config-generator.ts)

## 🤝 Contributing

### Development Setup
1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables
4. Run migrations: `npm run migrate`
5. Start development server: `npm run dev`

### Code Style
- TypeScript for all new code
- Comprehensive test coverage
- JSDoc documentation
- ESLint configuration

### Pull Request Process
1. Create feature branch from `main`
2. Implement changes with tests
3. Update documentation
4. Submit PR with description
5. Address review feedback

## 📞 Support

### Issues
- Report bugs via GitHub Issues
- Include reproduction steps
- Provide relevant logs

### Questions
- Check documentation first
- Ask in team chat
- Create discussion thread

---

**Status**: ✅ Implementation Complete
**Last Updated**: January 2025
**Version**: Phase Next v1.0
