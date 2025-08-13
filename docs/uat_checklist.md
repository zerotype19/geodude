# Optiview Analytics - User Acceptance Testing Checklist

## Overview
This checklist covers manual testing scenarios for the Optiview Analytics platform. Use this to verify all features are working correctly before deployment.

## Authentication & Sessions ✅

### OTP Login Flow
- [ ] **Request Code**
  - [ ] Enter valid email → receives success message
  - [ ] Enter invalid email format → shows validation error
  - [ ] Rate limiting: rapid requests → shows rate limit error
  - [ ] Dev mode: code appears in console logs
  - [ ] SMTP mode: code sent via email (if configured)

- [ ] **Verify Code**
  - [ ] Enter correct 6-digit code → login successful, redirects to dashboard
  - [ ] Enter incorrect code → shows "Invalid or expired code"
  - [ ] Enter expired code → shows "Invalid or expired code"
  - [ ] 5 failed attempts → code locked, shows lockout message
  - [ ] Session cookie set with correct flags (HttpOnly, Secure, SameSite=Lax)

- [ ] **Session Management**
  - [ ] `/auth/me` returns user data when logged in
  - [ ] `/auth/me` returns 401 when not logged in
  - [ ] Logout clears session cookie
  - [ ] Session expires after configured TTL
  - [ ] Multiple browser tabs maintain separate sessions

### Admin Authentication
- [ ] **Admin Routes Protection**
  - [ ] `/admin/rules` requires admin login
  - [ ] `/admin/env-check` requires admin login
  - [ ] `/admin/bootstrap` rate limited (3/hour)
  - [ ] Non-admin users get 403 on admin routes

- [ ] **Admin Bootstrap**
  - [ ] First admin creation works when `ADMIN_BOOTSTRAP_EMAIL` set
  - [ ] Subsequent bootstrap attempts return "Admin already exists"
  - [ ] Bootstrap without config returns "Bootstrap not configured"

## API Key Management ✅

### Key Rotation
- [ ] **Grace Period**
  - [ ] Old key accepted during grace window
  - [ ] Old key rejected after grace expiry
  - [ ] New key works immediately
  - [ ] Audit log records rotation

- [ ] **Key Revocation**
  - [ ] Revoked key returns 401
  - [ ] Audit log records revocation
  - [ ] Revoked key cannot be used for new requests

### Install Verification
- [ ] **Banner Status**
  - [ ] Shows "Not Installed" for new properties
  - [ ] Shows "Installed" within 60s of first event
  - [ ] Updates in real-time as events arrive
  - [ ] Requires authentication to view

## CSV Export Functionality ✅

### Events Export
- [ ] **Large Dataset Handling**
  - [ ] Export >30k rows across multiple chunks
  - [ ] Cursor pagination works correctly
  - [ ] Next cursor returned in headers
  - [ ] Cursor roundtrip: use returned cursor → get next page

- [ ] **Data Accuracy**
  - [ ] All required columns present in correct order
  - [ ] Data matches dashboard filters
  - [ ] Date range filtering works
  - [ ] Project scoping enforced

- [ ] **Rate Limiting**
  - [ ] 1 req/sec per user enforced
  - [ ] Rate limit headers returned
  - [ ] Retry-After guidance provided

### Referrals Export
- [ ] **Same as Events Export**
  - [ ] Large dataset handling
  - [ ] Data accuracy
  - [ ] Rate limiting
  - [ ] Correct column format

## Rules Admin & Versioning ✅

### Rules Management
- [ ] **Version Control**
  - [ ] POST updates bump version number
  - [ ] New events stamped with incremented `ruleset_version`
  - [ ] Version history maintained
  - [ ] `updated_at` and `updated_by` tracked

- [ ] **Classifier Integration**
  - [ ] Rules reload after edit (no redeploy needed)
  - [ ] New rules apply to incoming requests
  - [ ] Version stamped in event metadata
  - [ ] Cache refresh works correctly

### UI Functionality
- [ ] **Admin Interface**
  - [ ] Rules table displays current configuration
  - [ ] JSON editor allows rule modifications
  - [ ] Preview diff shows changes
  - [ ] Save increments version number

## Documentation System ✅

### Markdown Rendering
- [ ] **Page Rendering**
  - [ ] All docs pages render without errors
  - [ ] No CSP violations in console
  - [ ] Links stay in-app (no external redirects)
  - [ ] Navigation sidebar works correctly

- [ ] **Content Features**
  - [ ] Code blocks have copy buttons
  - [ ] Placeholders replaced with actual values
  - [ ] Mobile responsive design
  - [ ] Search functionality (if implemented)

### GTM Integration
- [ ] **Template Import**
  - [ ] JSON file imports into GTM without errors
  - [ ] All required variables present
  - [ ] Documentation explains setup process
  - [ ] Screenshot placeholders noted

## Demo Data System ✅

### Data Generation
- [ ] **Synthetic Events**
  - [ ] Generator creates 30-60 events per minute
  - [ ] Events distributed across traffic classes
  - [ ] Events tagged with `metadata.demo=true`
  - [ ] Ruleset version stamped correctly

- [ ] **Demo Project**
  - [ ] "Optiview Demo" organization created
  - [ ] Sample project with realistic data
  - [ ] Content assets with proper URLs
  - [ ] AI sources configured

### UI Integration
- [ ] **Demo Toggle**
  - [ ] Settings page shows demo toggle
  - [ ] Toggle state persists across sessions
  - [ ] Demo data clearly labeled with "Sample" badges
  - [ ] Toggle hides demo when disabled

## Security & Privacy ✅

### Content Type Enforcement
- [ ] **API Protection**
  - [ ] `multipart/*` requests return 415
  - [ ] `text/*` requests return 415
  - [ ] `application/json` accepted
  - [ ] Error messages include request ID

### Metadata Sanitization
- [ ] **PII Detection**
  - [ ] Email keys dropped (case-insensitive)
  - [ ] Phone keys dropped
  - [ ] Password keys dropped
  - [ ] SSN patterns detected and dropped

- [ ] **Size Limits**
  - [ ] Maximum 20 metadata keys enforced
  - [ ] Maximum 200 chars per value enforced
  - [ ] Shorter keys prioritized when capping
  - [ ] Dropped keys/values logged

### Security Headers
- [ ] **CSP Implementation**
  - [ ] HTML pages get full CSP
  - [ ] API endpoints get `nosniff` only
  - [ ] No CSP violations in console
  - [ ] Referrer-Policy set correctly

- [ ] **Trace Headers**
  - [ ] `x-optiview-trace` added when xray enabled
  - [ ] Traffic class and ruleset version included
  - [ ] Headers only on dashboard pages
  - [ ] Toggle works correctly

### Rate Limiting
- [ ] **Admin Routes**
  - [ ] 30 rpm per IP enforced
  - [ ] Rate limit headers returned
  - [ ] Retry-After guidance provided
  - [ ] Different limits for different endpoints

## Performance & Reliability ✅

### Large Dataset Handling
- [ ] **Export Performance**
  - [ ] 50k+ row exports complete within reasonable time
  - [ ] Memory usage remains stable
  - [ ] Streaming works correctly
  - [ ] Backpressure handled properly

- [ ] **Database Performance**
  - [ ] Queries execute efficiently
  - [ ] Indexes used correctly
  - [ ] No timeout errors on large exports
  - [ ] Connection pooling works

### Error Handling
- [ ] **Graceful Degradation**
  - [ ] Network errors handled gracefully
  - [ ] Invalid input returns appropriate errors
  - [ ] Error messages are user-friendly
  - [ ] Request IDs included for debugging

## Environment & Configuration ✅

### Environment Variables
- [ ] **Required Variables**
  - [ ] `/admin/env-check` shows all required vars present
  - [ ] Missing variables clearly identified
  - [ ] Values redacted for security
  - [ ] Environment status reported

### Custom Domain Setup
- [ ] **Documentation**
  - [ ] Custom domain instructions clear
  - [ ] Cloudflare dashboard steps documented
  - [ ] Screenshot placeholders noted
  - [ ] Production requirements explained

## Cross-Browser & Device Testing ✅

### Browser Compatibility
- [ ] **Modern Browsers**
  - [ ] Chrome (latest)
  - [ ] Firefox (latest)
  - [ ] Safari (latest)
  - [ ] Edge (latest)

- [ ] **Mobile Browsers**
  - [ ] iOS Safari
  - [ ] Chrome Mobile
  - [ ] Responsive design works
  - [ ] Touch interactions work

## Final Validation ✅

### Integration Testing
- [ ] **End-to-End Flows**
  - [ ] Complete user journey: signup → setup → analytics
  - [ ] Admin workflow: login → rules → monitoring
  - [ ] Data flow: collection → processing → export
  - [ ] Error scenarios handled gracefully

### Performance Validation
- [ ] **Load Testing**
  - [ ] Multiple concurrent users
  - [ ] Large data exports
  - [ ] Real-time updates
  - [ ] Memory and CPU usage

### Security Validation
- [ ] **Penetration Testing**
  - [ ] Authentication bypass attempts
  - [ ] SQL injection attempts
  - [ ] XSS attempts
  - [ ] CSRF attempts

## Sign-off

- [ ] **QA Engineer**: _________________ Date: ________
- [ ] **Product Manager**: _____________ Date: ________
- [ ] **Engineering Lead**: _____________ Date: ________
- [ ] **DevOps Engineer**: _____________ Date: ________

## Notes
- Test environment: ________________
- Test data: _______________________
- Special considerations: _____________
- Known issues: ____________________

---

**Status**: 🟡 In Progress / 🟢 Complete / 🔴 Blocked
**Last Updated**: [Date]
**Version**: 1.0
