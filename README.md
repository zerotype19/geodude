# Optiview — AI Visibility & Optimization Layer

A comprehensive platform for monitoring AI model visibility, optimizing content performance, and driving revenue through intelligent content optimization.

## 🎯 Vision

Optiview transforms how businesses understand and optimize their presence in AI-powered search and conversation. We provide the visibility, insights, and tools needed to win in the AI-first world.

## 🚀 Core Capabilities

### **AI Visibility Monitoring**
- **Real-time tracking** of AI model citations and recommendations
- **Multi-model coverage** across ChatGPT, Claude, Gemini, Perplexity, and more
- **Geographic insights** showing where your content appears globally
- **Persona-based analysis** understanding different AI user contexts

### **Content Optimization Engine**
- **Gap identification** revealing where your content falls short
- **Content action recommendations** with one-click implementation
- **Performance tracking** measuring optimization impact over time
- **A/B testing** for content variations and messaging

### **Revenue Impact Measurement**
- **Conversion tracking** linking AI visibility to business outcomes
- **Attribution modeling** understanding AI's role in customer journeys
- **ROI analysis** quantifying content optimization investments
- **Predictive insights** forecasting future performance

## 🏗️ Architecture

Built on Cloudflare's edge platform for global performance and reliability:

- **Frontend**: React-based dashboard with real-time updates
- **Backend**: Cloudflare Workers with D1 database
- **Storage**: R2 for AI captures and media assets
- **Analytics**: Edge-optimized metrics and reporting

## 🚧 Status

**Project Reset in Progress**

We are currently rebuilding Optiview from the ground up with a focus on AI visibility and optimization. The old redirect-based architecture has been completely removed.

## 📋 Next Steps

1. **Core Infrastructure** - Basic auth, org/project management
2. **AI Monitoring** - Citation tracking and visibility metrics
3. **Content Actions** - Optimization recommendations and tools
4. **Revenue Tracking** - Conversion attribution and ROI measurement

## 🔧 Development

```bash
# Install dependencies
pnpm install

# Run development servers
pnpm run dev

# Build and deploy
pnpm run build
pnpm run cf:publish
```

## 📚 Documentation

- [API Reference](./docs/api.md) - Backend endpoints and data models
- [Dashboard Guide](./docs/dashboard.md) - Frontend features and usage
- [Deployment Guide](./docs/deployment.md) - Production setup and configuration

---

**Optiview** - Making AI work for your business, not against it.
