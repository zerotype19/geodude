# Design System Overhaul Plan

**Date:** October 26, 2025  
**Status:** 🚧 IN PROGRESS

---

## Executive Summary

Comprehensive design overhaul to ensure visual consistency, professional presentation, and factual accuracy across all public-facing properties (app.optiview.ai + optiview.ai).

---

## Core Principles

1. **Single Source of Truth**: App styles are canonical - marketing must use same design system
2. **No Emojis**: Replace all emojis with proper SVG icons
3. **Mobile-First**: All layouts must work perfectly on mobile
4. **Factual Only**: Zero false claims - only real capabilities
5. **Demo-Ready**: Score guide and home page must be presentation-quality

---

## Task Breakdown

### Phase 1: Critical UX Fixes (PRIORITY)

#### 1.1 Fix Card Title Wrapping on Mobile
**Issue:** Headlines extend outside card borders on mobile  
**Fix:** 
- Add `word-wrap: break-word` and `overflow-wrap: break-word`
- Set `max-width: 100%` on card titles
- Test on mobile viewports

#### 1.2 Fix Footer Links on Mobile
**Issue:** Footer links missing on mobile devices  
**Fix:**
- Check footer display CSS
- Ensure `flex-wrap: wrap` is set
- Test mobile visibility

---

### Phase 2: Visual Consistency

#### 2.1 Standardize Logo Treatment
**Current Issue:** Different logos on app vs marketing  
**App Logo Style:** Smaller, bolder, single color, uppercase  
**Action:** Apply app logo style to marketing site

#### 2.2 Consolidate Stylesheets
**Issue:** Marketing has own styles instead of using app's design system  
**Action:**
- Create `marketing-shared.css` that imports app design tokens
- Use same Tailwind v4 theme
- Same colors, typography, spacing
- Remove duplicate/conflicting styles

#### 2.3 Replace All Emojis with Icons
**Emojis to Replace:**
- 📊 → Chart/Analytics icon
- 🎯 → Target icon  
- 📄 → Document icon
- 🧠 → Brain/Intelligence icon
- ⚙️ → Settings/Gear icon
- 🔍 → Search/Magnify icon
- ✨ → Sparkles/Star icon
- 🚀 → Rocket icon
- 📈 → Trending Up icon
- 💡 → Lightbulb icon
- 🤖 → Robot icon
- etc.

**Implementation:**
- Use inline SVG with consistent sizing (24x24px default)
- Use CSS variables for colors
- Ensure accessibility (aria-hidden or aria-label)

---

### Phase 3: Design Improvements

#### 3.1 Hero Banner Redesign (optiview.ai)
**Current:** Plain background with text  
**New Design:**
- Gradient background (brand purple gradient)
- Larger, bolder headline
- Standout CTA button with elevation/shadow
- Icons integrated into design
- Better visual hierarchy

#### 3.2 Make Feature Cards Clickable
**Current:** Static cards  
**New:**
- Make entire card clickable
- Add hover states
- Link destinations:
  - 36-Point Diagnostic → `/score-guide`
  - Citation Testing → `/citations`
  - Executive Reports → `/reports` (new page)

#### 3.3 Improve Score Guide Design
**Goal:** Demo/presentation quality  
**Actions:**
- Better typography hierarchy
- Card-based layout for criteria
- Clear visual indicators for impact levels
- Collapsible sections
- Professional color scheme
- Print-friendly option

---

### Phase 4: Content & New Pages

#### 4.1 Create Executive Summary Detail Page
**URL:** `/reports` or `/executive-summary`  
**Content:**
- What's included in report
- Detailed breakdown with screenshots
- Example report sections
- Value proposition
- Call to action

#### 4.2 Verify All Claims are Factual
**Review:**
- Home page claims
- Feature descriptions
- Stats (36 criteria, 200+ taxonomies, etc.)
- Capability statements
- Ensure nothing is aspirational - only live features

---

## Implementation Checklist

### Files to Modify

**Marketing Site (apps/web/public/):**
- [ ] `index.html` - Hero, cards, emojis, footer, logo
- [ ] `citations.html` - Emojis, consistency
- [ ] `faq/index.html` - Emojis, logo
- [ ] All FAQ sub-pages - Logo, footer
- [ ] `methodology.html` - Logo, consistency
- [ ] Create: `styles-shared.css` - Shared design system

**App (apps/app/src/):**
- [ ] `routes/score-guide/index.tsx` - Design overhaul
- [ ] Remove emojis from any components
- [ ] Ensure consistency

### New Files to Create
- [ ] `apps/web/public/reports.html` - Executive summary page
- [ ] `apps/web/public/styles-shared.css` - Shared styles
- [ ] SVG icon definitions (inline where used)

---

## Design Tokens (From App)

```css
/* Brand Colors */
--color-brand: oklch(63% 0.23 274);
--color-brand-foreground: oklch(100% 0 0);
--color-brand-soft: oklch(96% 0.03 274);

/* Text */
--color-ink: oklch(22% 0.02 250);
--color-ink-muted: oklch(52% 0.01 250);
--color-ink-subtle: oklch(60% 0.01 250);

/* Surfaces */
--color-surface-1: oklch(100% 0 0);
--color-surface-2: oklch(97% 0 0);
--color-surface-3: oklch(94% 0 0);

/* Status */
--color-success: oklch(52% 0.14 158);
--color-warn: oklch(70% 0.18 85);
--color-danger: oklch(62% 0.23 20);
--color-info: oklch(61% 0.18 240);
```

---

## Icon System

Using inline SVG with consistent patterns:

```html
<!-- Example: Chart Icon -->
<svg class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
  <path d="M3 3v18h18" stroke-width="2"/>
  <path d="M18 17V9M12 17v-4M6 17v-2" stroke-width="2"/>
</svg>

<!-- Example: Target Icon -->
<svg class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
  <circle cx="12" cy="12" r="10" stroke-width="2"/>
  <circle cx="12" cy="12" r="6" stroke-width="2"/>
  <circle cx="12" cy="12" r="2" fill="currentColor"/>
</svg>
```

---

## Mobile Breakpoints

```css
/* Mobile First */
@media (max-width: 640px) { /* Mobile */ }
@media (min-width: 641px) and (max-width: 1024px) { /* Tablet */ }
@media (min-width: 1025px) { /* Desktop */ }
```

---

## Quality Assurance

### Pre-Deployment Checklist
- [ ] All emojis replaced with icons
- [ ] Mobile layout tested (iPhone, Android)
- [ ] Footer visible on all viewports
- [ ] Cards don't overflow on mobile
- [ ] Logo consistent across sites
- [ ] All links functional
- [ ] Claims verified as factual
- [ ] Score guide demo-ready
- [ ] Hero design impressive

### Post-Deployment Verification
- [ ] Test on real mobile devices
- [ ] Test all page routes
- [ ] Verify no console errors
- [ ] Check accessibility
- [ ] Performance check (PageSpeed)

---

## Risks & Mitigations

**Risk:** Breaking existing styles during consolidation  
**Mitigation:** Test thoroughly, deploy incrementally

**Risk:** Icon replacements look inconsistent  
**Mitigation:** Use standardized SVG patterns, consistent sizing

**Risk:** Mobile fixes break desktop  
**Mitigation:** Test all viewports, use progressive enhancement

---

## Success Criteria

✅ **Visual:** Professional, cohesive design across all pages  
✅ **Mobile:** Perfect experience on all devices  
✅ **Consistency:** Same design language everywhere  
✅ **Accuracy:** Zero false claims  
✅ **Demo-Ready:** Score guide suitable for presentations  

---

## Timeline

**Phase 1:** Critical UX fixes - 30 min  
**Phase 2:** Visual consistency - 45 min  
**Phase 3:** Design improvements - 60 min  
**Phase 4:** Content & new pages - 45 min  

**Total:** ~3 hours of focused work

---

**Status:** 🚧 Implementing Phase 1...


