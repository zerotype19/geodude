# Partner Onboarding Runbook

This document provides step-by-step instructions for onboarding new beta partners to Optiview.

## Prerequisites

- Access to production admin panel (`https://optiview.ai/admin/*`)
- Slack access for alert testing
- Partner's domain/website information
- Partner contact email

## Step 1: Create Organization + Owner

### 1.1 Create Organization
1. Navigate to `/admin/organizations`
2. Click "Create Organization"
3. Enter organization details:
   - **Name**: Partner company name
   - **Domain**: Partner's primary domain (for email validation)
   - **Plan**: Select appropriate plan tier
4. Save organization and note the `org_id`

### 1.2 Create Owner Account
1. Navigate to `/admin/users` or use magic link flow
2. Send magic link to partner's primary contact email:
   - Go to `/login`
   - Enter partner email
   - Click "Send Magic Link"
3. Partner clicks link to complete account setup
4. Assign owner role in organization

## Step 2: Create Project

### 2.1 Project Setup (Owner-only)
1. Partner logs in and navigates to main dashboard
2. Click "New Project" or project switcher → "Create Project"
3. Enter project details:
   - **Name**: Descriptive project name (e.g., "Main Website")
   - **Domain**: Primary domain (e.g., `example.com`)
   - **Description**: Optional project description

**Domain Policy**:
- Normalize to lowercase
- Strip `www.` prefix if present
- Reject `localhost`, IP addresses, or invalid domains
- Use apex domain (e.g., `example.com` not `blog.example.com`)

### 2.2 Verify Project Creation
- [ ] Project appears in project switcher
- [ ] Domain is properly normalized
- [ ] Default property created automatically

## Step 3: Add Property

### 3.1 Property Configuration
1. Navigate to `/settings` → Properties tab
2. Either use auto-created property or create new one:
   - **Domain**: Exact site domain or apex domain
   - **Type**: Website, App, or API
3. Note the `property_id` for tracking setup

### 3.2 Property Validation
- [ ] Domain matches expected format
- [ ] Property shows as active
- [ ] Property linked to correct project

## Step 4: Create API Key

### 4.1 Generate API Key
1. Navigate to `/api-keys`
2. Click "Create New API Key"
3. Configure key:
   - **Name**: Descriptive name (e.g., "Production Website")
   - **Property**: Select the property created in Step 3
   - **Permissions**: Standard ingestion permissions
4. Copy the `key_id` (format: `key_XXXXXXXXXX`)

### 4.2 Key Security
- [ ] Key ID copied securely
- [ ] No secret/hash exposed in UI
- [ ] Key linked to correct property
- [ ] Key shows as active

## Step 5: Install Hosted Tag

### 5.1 Access Install Wizard
1. Navigate to `/install` (should preselect current project)
2. Or use deep link: `/install?project_id=<project_id>&key_id=<key_id>`
3. Select property and API key if not preselected

### 5.2 Copy Installation Code
1. Copy the generated snippet:
   ```html
   <script async src="https://api.optiview.ai/v1/tag.js" 
           data-key-id="key_XXXXXXXXXX"
           data-project-id="prj_XXXXXXXXXX"
           data-property-id="123"
           data-clicks="1"
           data-spa="1"></script>
   ```
2. Provide to partner for installation in `<head>` section

### 5.3 Installation Requirements
- [ ] Snippet placed in `<head>` section
- [ ] On all pages that should be tracked
- [ ] No modifications to snippet
- [ ] Correct parameters for project/property/key

## Step 6: Verify Events

### 6.1 Test Event Ingestion
1. Partner installs snippet on test/staging site
2. Navigate to `/install` verification widget
3. Trigger test pageview on partner site
4. Verification should turn green within 30 seconds

### 6.2 Production Verification
1. Partner installs on production site
2. Monitor `/events` dashboard for incoming data
3. Verify events show correct:
   - Project ID
   - Property ID
   - Domain
   - User agent classification

### 6.3 Debug if Needed
- Check browser console for errors
- Use `?debug=1` on tag URL to see debug logs
- Verify API key is active and valid
- Check CORS headers on API responses

## Step 7: Enable AI Sources

### 7.1 Configure Sources
1. Navigate to `/sources`
2. Enable relevant AI sources for partner's industry:
   - **ChatGPT**: Usually enabled for all
   - **Claude**: For technical/research content
   - **Perplexity**: For factual/reference content
   - **Gemini**: For general queries
   - Industry-specific sources as needed

### 7.2 Source Verification
- [ ] Sources enabled and showing as active
- [ ] Sources appropriate for partner's content type
- [ ] Partner understands what each source tracks

## Step 8: Sanity Dashboard Review

### 8.1 Events Dashboard
1. Navigate to `/events`
2. Verify data flowing:
   - [ ] Event counts increasing
   - [ ] Proper time bucketing
   - [ ] Geographic distribution reasonable
   - [ ] Device/browser breakdown expected

### 8.2 Content Discovery
1. Navigate to `/content`
2. Wait for content discovery (may take 24-48 hours)
3. Verify:
   - [ ] Pages being automatically discovered
   - [ ] URLs look correct
   - [ ] Content types assigned properly

### 8.3 Journeys Tracking
1. Navigate to `/journeys`
2. After session data accumulates:
   - [ ] User journeys showing
   - [ ] Session tracking working
   - [ ] Event sequences logical

### 8.4 AI Influence Metrics
1. Check `/referrals` for AI-driven traffic
2. Check `/conversions` if conversion events set up
3. Verify AI attribution appears in data (may take time)

## Step 9: Slack Alerts Setup

### 9.1 Configure Alerts
1. Admin configures Slack webhook in production environment
2. Set alert thresholds:
   - Error rate >1% AND ≥500 events (5m window)
   - p95 latency >200ms AND ≥500 events
   - Cron stall >90 minutes
   - 15-minute deduplication

### 9.2 Test Alerts
1. Trigger test alert from `/admin/health`
2. Verify alert appears in designated Slack channel
3. Confirm partner contact is added to channel

## Step 10: Data Retention & Cleanup

### 10.1 Verify Retention Settings
1. Navigate to `/data-policy`
2. Confirm retention periods match partner's plan:
   - **Events**: 90 days (Starter) / 180 days (Growth) / 1 year (Pro)
   - **AI Referrals**: 1 year standard
   - **Sessions**: 90 days standard

### 10.2 Cron Jobs Verification
1. Check `/admin/health` for cron status
2. Verify purge jobs are running regularly
3. Monitor purge logs for proper operation

## Final Verification Checklist

### Technical Verification
- [ ] Events flowing in real-time
- [ ] No JavaScript errors in browser console
- [ ] API responses have correct CORS headers
- [ ] Session tracking working (cookies set)
- [ ] Property-scoped CORS enforced

### Dashboard Verification
- [ ] All main dashboards loading (Events, Content, Journeys)
- [ ] Time zone display correct
- [ ] Empty states show helpful CTAs
- [ ] Navigation working smoothly

### Security Verification
- [ ] Only property domain allowed in CORS
- [ ] No API keys or secrets exposed in frontend
- [ ] Admin functions require proper authentication
- [ ] Rate limits enforced on API endpoints

### Alert System Verification
- [ ] Slack webhook configured and tested
- [ ] Health monitoring active
- [ ] Error thresholds appropriate
- [ ] Alert deduplication working

## Troubleshooting Common Issues

### Events Not Appearing
1. Check browser network tab for 403/404 errors
2. Verify API key is active and correct
3. Check domain matches property configuration
4. Test with `?debug=1` on tag URL

### CORS Errors
1. Verify property domain exactly matches origin
2. Check for `www.` vs apex domain mismatches
3. Ensure OPTIONS preflight responses are correct

### Dashboard Empty
1. Wait 5-10 minutes for data processing
2. Check correct project/property selected
3. Verify events are actually being ingested
4. Check time window selection

### Performance Issues
1. Monitor `/admin/health` metrics
2. Check D1 database performance
3. Verify KV cache hit rates
4. Monitor worker CPU usage

## Success Criteria

A successful partner onboarding includes:

1. **Technical Setup Complete**:
   - Events flowing reliably
   - No console errors
   - Proper session tracking

2. **Dashboard Functional**:
   - Real data in all relevant dashboards
   - Proper time bucketing and filtering
   - AI attribution starting to appear

3. **Monitoring Active**:
   - Slack alerts configured and tested
   - Health monitoring operational
   - Partner has access to support channels

4. **Partner Trained**:
   - Partner team knows how to use main dashboards
   - Understands what metrics mean
   - Knows how to contact support

## Post-Launch Monitoring

### First 24 Hours
- Monitor error rates and performance
- Check for any configuration issues
- Verify data quality and completeness
- Respond quickly to any partner questions

### First Week
- Review AI attribution data quality
- Check for any unusual patterns
- Gather partner feedback on UX
- Monitor system performance under load

### Ongoing
- Weekly check-ins with partner
- Monthly data quality reviews
- Quarterly business review of metrics
- Continuous monitoring of system health

## Contact Information

- **Technical Support**: [Support channel/email]
- **Account Management**: [Account manager contact]
- **Emergency Contact**: [Emergency escalation path]
- **Documentation**: [Link to additional docs]

---

**Document Version**: 1.0  
**Last Updated**: [Date]  
**Maintained By**: [Team responsible]
