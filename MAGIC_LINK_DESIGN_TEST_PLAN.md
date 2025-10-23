# Magic Link Design System Test Plan

**Status:** Ready for Testing  
**Date:** October 23, 2025  
**Deployment:** https://app.optiview.ai

---

## 🎯 What We Changed

### Session 1: Navigation Fix
- ✅ Removed redundant `/audits/:id/pages` route
- ✅ Updated "Back to Pages" links to use `?tab=pages`

### Session 2: Magic Link UX Fix
- ✅ Changed redirect from audit detail → dashboard after magic link
- ✅ Added "Starting Your Audit" message
- ✅ Prevents landing on empty page with 0.0 scores

### Session 3: Design System Refresh
- ✅ Removed all gradients and emojis
- ✅ Applied Card and Button UI primitives
- ✅ Used semantic color tokens
- ✅ Modernized all magic link flow screens

---

## 🧪 Test Scenarios

### Test 1: Sign-In Modal (New Design)
**URL:** `https://app.optiview.ai/`

**Steps:**
1. Click "Sign In" button in header
2. Verify modal opens with new design:
   - ✅ No gradient icon
   - ✅ Clean card layout
   - ✅ "Sign In to Optiview" heading
   - ✅ Email input uses `input` class
   - ✅ Button uses new Button primitive
3. Enter email address
4. Click "Send Magic Link"
5. Verify loading state shows "Sending..." (no spinner icon)
6. Verify redirects to check email page

**Expected Result:**
- Clean, modern modal
- No emojis or gradient icons
- Smooth transition to check email page

---

### Test 2: Check Email Page (No Emojis)
**URL:** `https://app.optiview.ai/auth/check-email?email=test@example.com`

**Steps:**
1. Arrive at check email page (from Test 1)
2. Verify design elements:
   - ✅ No emoji icons (no 📧, no ⏱️)
   - ✅ Card-based layout
   - ✅ "Check your email" heading
   - ✅ Shows email address
   - ✅ "What to do next" info box (no emoji)
   - ✅ "Link expires in 20 minutes" warning (no emoji)
   - ✅ Soft border colors (brand/20, warn/20)
3. Verify "Back to home" link works

**Expected Result:**
- Professional, emoji-free design
- Clear instructions
- Soft, modern styling

---

### Test 3: Magic Link Callback (Sign-In Flow)
**URL:** Click magic link from email

**Steps:**
1. Open email inbox
2. Click magic link
3. Verify callback page shows:
   - ✅ "Signing you in" or "Starting Your Audit"
   - ✅ Card-based layout
   - ✅ No gradient icon
   - ✅ Animated dots (3 bouncing dots)
4. Wait for redirect

**Expected Result:**
- Clean loading state
- No gradient icons
- Smooth redirect to destination

---

### Test 4: Magic Link Audit Creation (Dashboard Redirect)
**From:** Landing page audit creation flow

**Steps:**
1. Go to `https://optiview.ai/`
2. Enter domain (e.g., `example.com`)
3. Enter email address
4. Click "Start Free Audit"
5. Check email and click magic link
6. Verify shows "Starting Your Audit" message
7. **CRITICAL:** Verify redirects to `/audits` (dashboard), NOT `/audits/:id`
8. Verify dashboard shows audit with "RUNNING" status
9. Wait for audit to complete
10. Click into completed audit

**Expected Result:**
- ✅ Lands on dashboard (list view), not empty audit detail
- ✅ Audit shows "RUNNING" status in table
- ✅ No 0.0 score confusion
- ✅ Can click into audit when ready

---

### Test 5: Error Page (No Emojis)
**URL:** `https://app.optiview.ai/auth/error?reason=expired_or_invalid`

**Test Different Error States:**

#### 5a. Expired Link
```
https://app.optiview.ai/auth/error?reason=expired_or_invalid
```
- ✅ No emojis (⏱️ removed)
- ✅ Clear error title
- ✅ "What happened?" explanation box
- ✅ "Request a new link" button (primary)
- ✅ "View my audits" button (soft)
- ✅ "Tip" box at bottom (no 💡 emoji)

#### 5b. Missing Token
```
https://app.optiview.ai/auth/error?reason=missing
```
- ✅ No 🔍 emoji
- ✅ Card-based layout
- ✅ Button primitives

#### 5c. Unauthorized Access
```
https://app.optiview.ai/auth/error?reason=unauthorized
```
- ✅ No 🔒 emoji
- ✅ Clear explanation
- ✅ Action buttons work

#### 5d. Internal Error
```
https://app.optiview.ai/auth/error?reason=internal_error
```
- ✅ No ⚠️ emoji
- ✅ Professional error handling

**Expected Result:**
- All error states use consistent design
- No emojis anywhere
- Card and Button primitives throughout
- Clear, actionable error messages

---

### Test 6: Page Detail Navigation (Back to Pages)
**URL:** `https://app.optiview.ai/audits/:id/pages/:pageId`

**Steps:**
1. Navigate to any completed audit
2. Click "Pages" tab
3. Click on any page card
4. Verify page detail loads
5. Click "← Back to Pages" link
6. **CRITICAL:** Verify navigates to `?tab=pages` (NOT `/pages` route)
7. Verify pages tab is active
8. Verify page list is visible

**Expected Result:**
- ✅ "Back to Pages" goes to `?tab=pages`
- ✅ No 404 or route errors
- ✅ Tab state is correct
- ✅ Page list shows immediately

---

### Test 7: New Audit Creation Page (Loading State)
**URL:** Automatic redirect during audit creation

**Steps:**
1. Trigger new audit creation (via magic link)
2. Verify `/audits/new?root_url=...` shows:
   - ✅ "Starting Your Audit" heading
   - ✅ Card-based layout
   - ✅ No gradient icon
   - ✅ Animated loading dots
   - ✅ Clean, centered design
3. Verify redirects to `/audits` (dashboard)
4. Verify audit appears in list with "RUNNING" status

**Expected Result:**
- Professional loading state
- No old gradient/icon styles
- Correct redirect to dashboard

---

## 🎨 Visual Checklist

### What Should Be GONE:
- ❌ All gradient backgrounds (`from-purple-500 to-indigo-600`)
- ❌ All emojis (📧, ⏱️, 🔍, 🔒, ⚠️, ❌, 💡)
- ❌ Large circular icon containers
- ❌ Inline SVG icons in content areas
- ❌ Old button styles with gradients

### What Should Be PRESENT:
- ✅ Card components (`card` class)
- ✅ CardBody components for content
- ✅ Button primitives (`btn`, `btn-primary`, `btn-soft`)
- ✅ Semantic color tokens (`brand`, `danger`, `warn`, `muted`)
- ✅ Soft borders (`brand/20`, `danger/20`, `warn/20`)
- ✅ Consistent typography
- ✅ Clean, modern spacing

---

## 🐛 Known Issues to Check

### Issue 1: CSS Caching
If old styles still appear:
- Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)
- Clear browser cache
- Try incognito/private window
- Check deployment URL vs production URL

### Issue 2: Route Conflicts
If `/audits/:id/pages` still loads:
- Verify App.tsx route was removed
- Check for cached JS bundle
- Verify deployment completed

### Issue 3: Magic Link Timing
If redirect happens too fast to see loading state:
- This is okay! It means the API is fast
- Loading state is still there for slow connections

---

## 📊 Success Criteria

### Critical (Must Pass):
- [ ] No 0.0 scores on landing after magic link
- [ ] Redirects to dashboard, not audit detail
- [ ] "Back to Pages" uses `?tab=pages`
- [ ] No emojis visible anywhere
- [ ] No gradient backgrounds
- [ ] All buttons use Button primitive
- [ ] All cards use Card component

### Important (Should Pass):
- [ ] Sign-in modal is clean and modern
- [ ] Check email page is professional
- [ ] Error pages are consistent
- [ ] Loading states are smooth
- [ ] All links work correctly

### Nice to Have:
- [ ] Animations are smooth
- [ ] Colors are consistent
- [ ] Spacing feels natural
- [ ] Typography is readable

---

## 🚀 Quick Test Commands

### Test Sign-In Flow:
```bash
# 1. Go to app
open https://app.optiview.ai/

# 2. Click Sign In
# 3. Enter email
# 4. Check inbox
# 5. Click link
```

### Test Audit Creation Flow:
```bash
# 1. Go to marketing site
open https://optiview.ai/

# 2. Enter domain and email
# 3. Check inbox
# 4. Click link
# 5. Verify lands on /audits (dashboard)
```

### Test Error Pages:
```bash
open "https://app.optiview.ai/auth/error?reason=expired_or_invalid"
open "https://app.optiview.ai/auth/error?reason=missing"
open "https://app.optiview.ai/auth/error?reason=unauthorized"
open "https://app.optiview.ai/auth/error?reason=internal_error"
```

### Test Navigation:
```bash
# 1. Go to any audit
open https://app.optiview.ai/audits/fd66d271-8620-4877-9a17-6767ff0902b7

# 2. Click Pages tab
# 3. Click any page
# 4. Click "Back to Pages"
# 5. Verify URL ends with ?tab=pages
```

---

## 📝 Test Results Template

```markdown
## Test Results - [Date/Time]

### Test 1: Sign-In Modal
- Status: [ ] Pass / [ ] Fail
- Notes:

### Test 2: Check Email Page
- Status: [ ] Pass / [ ] Fail
- Notes:

### Test 3: Magic Link Callback
- Status: [ ] Pass / [ ] Fail
- Notes:

### Test 4: Magic Link Audit Creation
- Status: [ ] Pass / [ ] Fail
- Notes:

### Test 5: Error Pages
- Status: [ ] Pass / [ ] Fail
- Notes:

### Test 6: Page Detail Navigation
- Status: [ ] Pass / [ ] Fail
- Notes:

### Test 7: New Audit Creation Page
- Status: [ ] Pass / [ ] Fail
- Notes:

### Overall Status: [ ] All Pass / [ ] Some Issues
```

---

## 🔧 Rollback Plan

If critical issues found:

```bash
# Revert to previous commit
git revert d29d9d4  # Design system update
git revert cd9e554  # Dashboard redirect fix
git revert 441480c  # Navigation fix

# Or rollback to specific commit
git reset --hard ebd1730  # Before all changes

# Redeploy
cd apps/app
npm run build
wrangler pages deploy dist --project-name=geodude-app
```

---

## ✅ Sign-Off

- [ ] All critical tests pass
- [ ] No regressions found
- [ ] Design is consistent
- [ ] User experience is smooth
- [ ] Ready for production

**Tested By:** _______________  
**Date:** _______________  
**Approved By:** _______________

---

**End of Test Plan**

