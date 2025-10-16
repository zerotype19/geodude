# Optiview Release Process

This document outlines the complete release process for Optiview audit system updates.

## 🏷️ Versioning Strategy

### Semantic Versioning
- **Major (X.0.0)**: Breaking changes, major feature overhauls
- **Minor (X.Y.0)**: New features, significant improvements (backward compatible)
- **Patch (X.Y.Z)**: Bug fixes, minor improvements

### Model Versions
- **v1.0**: Legacy 4-pillar scoring system
- **v2.1**: Enhanced 5-pillar scoring with EEAT and Visibility
- **v2.2**: Planned - Enhanced visibility scoring
- **v3.0**: Future - Multi-language, industry-specific models

## 🚀 Release Checklist

### Pre-Release
- [ ] All tests passing (unit, integration, e2e)
- [ ] Feature flags implemented and tested
- [ ] Backward compatibility verified
- [ ] Documentation updated
- [ ] Performance benchmarks completed
- [ ] Security review completed
- [ ] Rollback plan documented

### Release
- [ ] Code merged to main branch
- [ ] Git tag created with release notes
- [ ] GitHub release created
- [ ] Deployment to staging environment
- [ ] Smoke tests on staging
- [ ] Production deployment
- [ ] Feature flags enabled
- [ ] Monitoring dashboards updated

### Post-Release
- [ ] Monitor system metrics for 24h
- [ ] Validate user feedback
- [ ] Performance monitoring
- [ ] Error rate monitoring
- [ ] Documentation updates if needed

## 📋 Release Process Steps

### 1. Feature Development
```bash
# Create feature branch
git checkout -b feature/v21-scoring
# Develop and test
# Create PR for review
```

### 2. Testing and Validation
```bash
# Run comprehensive validation
tsx scripts/validate_v21_deployment.ts

# Run mixed audits analysis
tsx scripts/batch_mixed_audits_v21.ts --limit=25

# Review CSV outputs for score consistency
```

### 3. Documentation Updates
- Update `AUDIT_MODEL_VERSIONS.md`
- Update API documentation
- Update user guides
- Update internal runbooks

### 4. Git Tagging
```bash
# Create release tag
./scripts/tag_release.sh

# Verify tag
git show v2.1.0
```

### 5. Deployment
```bash
# Deploy API
cd packages/api-worker
npx wrangler deploy

# Deploy App
cd apps/app
npm run build
npx wrangler pages deploy dist --project-name geodude-app
```

### 6. Feature Flag Activation
```bash
# Enable v2.1 scoring
./scripts/rollout-v21.sh enable

# Verify activation
./scripts/rollout-v21.sh status
```

### 7. Monitoring Setup
```bash
# Set up scheduled QA job
# Configure Slack/email notifications
# Monitor dashboard queries
```

## 🔄 Rollback Procedures

### Immediate Rollback (Feature Flags)
```bash
# Disable v2.1 scoring immediately
./scripts/rollout-v21.sh disable

# Verify rollback
./scripts/rollout-v21.sh status
```

### Code Rollback (Emergency)
```bash
# Revert to previous tag
git checkout v2.0.0
git push --force-with-lease origin main

# Redeploy previous version
npx wrangler deploy
```

## 📊 Monitoring and Metrics

### Key Metrics to Monitor
- **Adoption Rate**: % of audits using v2.1
- **Score Accuracy**: Comparison with v1.0 baselines
- **Performance**: Response times and error rates
- **User Impact**: UI functionality and user experience
- **System Health**: Overall system stability

### Dashboard Queries
```sql
-- Run these queries daily
-- See scripts/dashboard_queries.sql for complete set
SELECT score_model_version, COUNT(*) FROM audit_scores GROUP BY score_model_version;
```

### Alert Thresholds
- **Error Rate**: > 5% triggers warning, > 10% triggers critical
- **Response Time**: > 5s triggers warning, > 10s triggers critical
- **Score Variance**: > 20% difference from v1.0 triggers review
- **Zero Scores**: > 1% triggers investigation

## 🧪 Testing Scripts

### Validation Scripts
- `scripts/validate_v21_deployment.ts` - Comprehensive validation
- `scripts/compare_v1_v21.ts` - Score comparison analysis
- `scripts/batch_mixed_audits_v21.ts` - Mixed verticals testing

### Monitoring Scripts
- `scripts/scheduled_qa_job.ts` - Daily QA monitoring
- `scripts/dashboard_queries.sql` - Database monitoring queries

### Utility Scripts
- `scripts/rollout-v21.sh` - Feature flag management
- `scripts/tag_release.sh` - Release tagging
- `scripts/fetch_real_audits.ts` - Audit data retrieval

## 📈 Continuous Improvement

### v2.2 Roadmap
- Enhanced visibility scoring with more AI providers
- Advanced EEAT analysis with author authority scoring
- Real-time score updates during audit
- Machine learning-based score calibration

### v3.0 Vision
- Multi-language support
- Industry-specific scoring models
- Predictive scoring based on historical data
- Advanced competitor analysis integration

## 🚨 Emergency Procedures

### Critical Issues
1. **Immediate**: Disable feature flags
2. **Investigate**: Check logs and metrics
3. **Fix**: Deploy hotfix if needed
4. **Verify**: Confirm resolution
5. **Document**: Update incident log

### Communication
- **Internal**: Slack #optiview-alerts
- **External**: Status page updates
- **Users**: Email notifications if needed

## 📚 Documentation Links

- [Model Versions](AUDIT_MODEL_VERSIONS.md)
- [Testing Guide](scripts/README_v21_testing.md)
- [API Documentation](docs/api.md)
- [Deployment Guide](docs/deployment.md)
- [Monitoring Guide](docs/monitoring.md)

## 🔗 External Resources

- [GitHub Releases](https://github.com/zerotype19/geodude/releases)
- [Status Page](https://status.optiview.ai)
- [API Health](https://geodude-api.kevin-mcgovern.workers.dev/status)
- [App Dashboard](https://04a0b5ae.geodude-app.pages.dev)
