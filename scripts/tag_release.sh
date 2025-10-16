#!/bin/bash

# Tag Release Script for v2.1.0
# Creates and pushes a git tag for the v2.1.0 release

set -e

VERSION="v2.1.0"
MESSAGE="5-pillar EEAT + Visibility scoring system

Features:
- Enhanced 5-pillar scoring (Crawlability 30%, Structured 25%, Answerability 20%, Trust 15%, Visibility 10%)
- EEAT (Experience, Expertise, Authoritativeness, Trustworthiness) analysis
- FAQ schema detection and prioritization
- Author and date coverage analysis
- Canonical URL and robots meta analysis
- AI visibility scoring with citation tracking
- Advanced v2.1 issue detection rules
- Sitemap-first URL collection with depth filtering
- Dual storage system with backward compatibility
- Feature flags for safe rollout
- Comprehensive validation and benchmarking tools

Breaking Changes: None (backward compatible)
Migration: Automatic via feature flags
Documentation: Complete with testing scripts and validation tools"

echo "🏷️  Creating release tag: $VERSION"
echo "=================================="

# Check if tag already exists
if git tag -l | grep -q "^$VERSION$"; then
    echo "❌ Tag $VERSION already exists"
    echo "   Delete it first with: git tag -d $VERSION && git push origin :refs/tags/$VERSION"
    exit 1
fi

# Check if working directory is clean
if ! git diff-index --quiet HEAD --; then
    echo "❌ Working directory is not clean"
    echo "   Commit or stash your changes first"
    exit 1
fi

# Create the tag
echo "📝 Creating annotated tag..."
git tag -a "$VERSION" -m "$MESSAGE"

# Push the tag
echo "🚀 Pushing tag to remote..."
git push origin "$VERSION"

echo ""
echo "✅ Release $VERSION tagged and pushed successfully!"
echo ""
echo "📋 Next steps:"
echo "   1. Review the tag: git show $VERSION"
echo "   2. Create GitHub release from tag"
echo "   3. Update deployment documentation"
echo "   4. Monitor v2.1 adoption metrics"
echo ""
echo "🔗 GitHub release URL:"
echo "   https://github.com/zerotype19/geodude/releases/tag/$VERSION"
