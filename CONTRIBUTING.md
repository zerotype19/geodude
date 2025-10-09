# Contributing to Optiview

Thank you for contributing! This guide outlines our simple, boring workflow to keep the repo clean and deployments smooth.

---

## 🎯 **Working Model**

### **Branch Naming**
- **Feature**: `feat/<short-scope>` (e.g., `feat/citations-bing`)
- **Fix**: `fix/<short-scope>` (e.g., `fix/email-template`)
- **Ops/Docs**: `chore/<thing>` or `docs/<thing>` (e.g., `chore/update-deps`)

### **Development Flow**
1. **Create a short-lived branch from `main`**:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feat/your-feature
   ```

2. **Make your changes**:
   - Keep scope minimal
   - Write clear commit messages
   - Build locally: `pnpm -C apps/app build`
   - Test if applicable

3. **Open a Pull Request**:
   - Target `main`
   - Fill out the PR template
   - Request review if needed

4. **Squash merge to `main`**:
   - Use GitHub's "Squash and merge" button
   - Keeps linear history
   - Auto-deletes the branch (if enabled)

5. **Tag releases on `main`** (maintainers only):
   ```bash
   git tag v0.X.Y -m "Release v0.X.Y: Brief description"
   git push origin v0.X.Y
   ```

---

## 📦 **Release Process**

### **Versioning** (Semantic Versioning)
- **Patch** (`v0.13.1`): Bugfixes, UI copy, small tweaks
- **Minor** (`v0.14.0`): New features, API additions
- **Major** (`v1.0.0`): Breaking changes (rare for now)

### **Tagging**
Only maintainers tag releases on `main` after successful deployment:
```bash
# After deploy succeeds
git tag v0.X.Y -m "Release v0.X.Y: Feature description"
git push origin v0.X.Y
```

### **Changelog**
Update `CHANGELOG.md` in your PR if the change is user-facing:
```markdown
## [vX.Y.Z] - YYYY-MM-DD

### Added
- New feature description

### Changed
- Modified behavior description

### Fixed
- Bug fix description
```

---

## 🔨 **Local Development**

### **Prerequisites**
- Node.js 20+
- pnpm 9+
- Cloudflare Wrangler CLI (for worker development)

### **Setup**
```bash
# Clone and install
git clone https://github.com/zerotype19/geodude.git
cd geodude
pnpm install

# Build dashboard
pnpm -C apps/app build

# Run dashboard dev server
pnpm -C apps/app dev

# Deploy API worker (requires Cloudflare auth)
cd packages/api-worker
npx wrangler deploy
```

### **Testing**
```bash
# Dashboard build
pnpm -C apps/app build

# API worker build (if build script exists)
pnpm -C packages/api-worker build || true

# Lint (if configured)
pnpm lint
```

---

## 🧹 **Repo Hygiene**

### **Branch Cleanup**
- **Automatic**: Merged branches are auto-deleted by GitHub
- **Weekly**: Auto-prune workflow runs Mondays at 07:00 UTC
- **Manual** (if needed):
  ```bash
  # List branches merged into main
  git fetch --all --prune
  git branch -r --merged origin/main | sed 's|origin/||' | grep -v -E '^(main|HEAD)$'

  # Delete remote branches
  for b in $(git branch -r --merged origin/main | sed 's|origin/||' | grep -v -E '^(main|HEAD)$'); do
    git push origin --delete "$b" || true
  done
  ```

### **Keep It Clean**
- ✅ Short-lived branches (< 1 week)
- ✅ Squash merge to main
- ✅ Delete after merge
- ✅ Tag only on main
- ❌ No long-running feature branches
- ❌ No tags on feature branches

---

## 🚀 **Deployment**

### **Dashboard** (`apps/app`)
- **Platform**: Cloudflare Pages
- **Project**: `geodude-app`
- **Production Branch**: `main`
- **Custom Domain**: `app.optiview.ai`
- **Deploy**: Push to `main` auto-deploys

### **API Worker** (`packages/api-worker`)
- **Platform**: Cloudflare Workers
- **Worker**: `geodude-api`
- **Custom Domain**: `api.optiview.ai`
- **Deploy**: `npx wrangler deploy` (manual)

### **Collector Worker** (`packages/collector-worker`)
- **Platform**: Cloudflare Workers
- **Worker**: `geodude-collector`
- **Custom Domain**: `collector.optiview.ai`
- **Deploy**: `npx wrangler deploy` (manual)

---

## 📚 **Documentation**

When adding features, update:
- `CHANGELOG.md` - User-facing changes
- `README.md` - If setup/usage changes
- `V0_XX_YY_QA_GUIDE.md` - For new features (optional)

---

## 🔒 **Security**

### **Secrets**
Never commit:
- API keys (`BING_SEARCH_KEY`, `RESEND_API_KEY`)
- Database credentials
- Hash salts (except prod placeholder)

Set secrets via Wrangler:
```bash
cd packages/api-worker
echo "YOUR_KEY" | wrangler secret put SECRET_NAME
```

### **Reporting Issues**
For security issues, email: security@optiview.ai (or create private issue)

---

## ✅ **PR Checklist**

Before opening a PR, ensure:
- [ ] Scope is minimal and focused
- [ ] Builds locally (`pnpm -C apps/app build`)
- [ ] Commit messages are clear
- [ ] PR template is filled out
- [ ] Changelog entry added (if user-facing)
- [ ] No secrets committed
- [ ] Tests pass (if applicable)

---

## 🎉 **Thank You!**

Your contributions make Optiview better for everyone. If you have questions, open an issue or start a discussion.

**Happy coding!** 🚀

