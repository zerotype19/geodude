import React, { useState, useEffect } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface DocPage {
  id: string;
  title: string;
  path: string;
  content: string;
}

const docs: DocPage[] = [
  {
    id: 'install-js',
    title: 'Install / Hosted Tag',
    path: '/docs/install/js',
    content: `# Hosted Tag Installation

## Quick Start

Add this script tag to your HTML \\<head\\> section:

\`\`\`html
<script async src="https://api.optiview.ai/v1/tag.js"
  data-key-id="YOUR_KEY_ID"
  data-project-id="YOUR_PROJECT_ID"
  data-property-id="YOUR_PROPERTY_ID"
  data-clicks="1"
  data-spa="1"
  data-batch-size="10"
  data-flush-ms="3000"></script>
\`\`\`

## Required Attributes

| Attribute | Description | Example |
|-----------|-------------|---------|
| \`data-key-id\` | Your API Key ID | \`ak_abc123\` |
| \`data-project-id\` | Your project identifier | \`prj_xyz789\` |
| \`data-property-id\` | Numeric property ID | \`123\` |

## Optional Configuration

| Attribute | Description | Default | Valid Values |
|-----------|-------------|---------|--------------|
| \`data-clicks\` | Enable click tracking | \`1\` | \`0\` or \`1\` |
| \`data-spa\` | Enable SPA route tracking | \`1\` | \`0\` or \`1\` |
| \`data-batch-size\` | Events per batch | \`10\` | \`1\` to \`50\` |
| \`data-flush-ms\` | Flush interval (ms) | \`3000\` | \`500\` to \`10000\` |

## Automatic Tracking

The hosted tag automatically tracks:
- **Page views**: On initial load and SPA navigation
- **Click events**: Links, buttons, and interactive elements
- **Referrer information**: Source page tracking
- **User agent patterns**: For AI traffic classification
- **Event batching**: Efficient network usage

## Public API

### Page Views
\`\`\`javascript
// Manual page view tracking
window.optiview.page();
\`\`\`

### Custom Events
\`\`\`javascript
// Track custom events
window.optiview.track('custom_event', {
  category: 'engagement',
  action: 'video_play',
  label: 'product_demo'
});
\`\`\`

### Conversions
\`\`\`javascript
// Track conversions
window.optiview.conversion({
  amount_cents: 1299,
  currency: 'USD',
  metadata: {
    order_id: 'order-123',
    product: 'premium_plan'
  }
});
\`\`\`

## Excluding Elements

To exclude elements from click tracking, add the \`data-optiview="ignore"\` attribute:

\`\`\`html
<button data-optiview="ignore">Not tracked</button>
<a href="/admin" data-optiview="ignore">Admin link</a>
\`\`\`

## Google Tag Manager

For GTM users, create a **Custom HTML** tag with trigger **All Pages**:

\`\`\`html
<script async src="https://api.optiview.ai/v1/tag.js"
  data-key-id="{{YOUR_KEY_ID}}"
  data-project-id="{{YOUR_PROJECT_ID}}"
  data-property-id="{{YOUR_PROPERTY_ID}}"></script>
\`\`\`

## Configuration

The tag respects your project settings for:
- Data retention
- Privacy controls
- Rate limiting`
  },
  {
    id: 'install-gtm',
    title: 'Install / Google Tag Manager',
    path: '/docs/install/gtm',
    content: `# Google Tag Manager Installation

## Import Template

1. Download the [Optiview GTM Template](/docs/assets/gtm/optiview-tag.json)
2. In GTM, go to **Templates** → **Import**
3. Upload the JSON file
4. Configure with your project details

## Configuration

Set these variables in your GTM container:

- \`{{PROJECT_ID}}\`: Your Optiview project ID
- \`{{PROPERTY_ID}}\`: Your property ID
- \`{{KEY_ID}}\`: Your API key ID
- \`{{ENDPOINT}}\`: API endpoint (defaults to {{PUBLIC_BASE_URL}}/api/events)

## Trigger Setup

The template includes:
- **All Pages** trigger for automatic tracking
- **Custom Events** trigger for manual events
- **Form Submissions** trigger for conversions

## Testing

1. Preview your GTM container
2. Navigate to your website
3. Check the Optiview dashboard for events
4. Verify traffic classification is working

## Troubleshooting

Common issues:
- Check API key permissions
- Verify property ID matches
- Ensure endpoint is accessible
- Check browser console for errors`
  },
  {
    id: 'install-worker',
    title: 'Install / Cloudflare Worker',
    path: '/docs/install/worker',
    content: `# Cloudflare Worker Installation

## Worker Setup

Create a new Cloudflare Worker with this code:

\`\`\`javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // Only process requests to your domain
  if (url.hostname !== 'yourdomain.com') {
    return new Response('Not found', { status: 404 })
  }

  // Forward to Optiview API
  const optiviewUrl = new URL('{{PUBLIC_BASE_URL}}/api/events')
  optiviewUrl.searchParams.set('pid', '{{PROPERTY_ID}}')
  optiviewUrl.searchParams.set('kid', '{{KEY_ID}}')
  
  const optiviewRequest = new Request(optiviewUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': request.headers.get('user-agent'),
      'Referer': request.headers.get('referer')
    },
    body: JSON.stringify({
      event_type: 'page_view',
      content_url: url.href,
      user_agent: request.headers.get('user-agent'),
      referer: request.headers.get('referer')
    })
  })

  try {
    const response = await fetch(optiviewRequest)
    
    // Return original response with Optiview headers
    const originalResponse = await fetch(request)
    const newResponse = new Response(originalResponse.body, originalResponse)
    
    newResponse.headers.set('x-optiview-status', response.status.toString())
    newResponse.headers.set('x-optiview-timestamp', Math.floor(Date.now() / 1000).toString())
    
    return newResponse
  } catch (error) {
    // Log error but don't break user experience
    console.error('Optiview tracking error:', error)
    return fetch(request)
  }
}
\`\`\`

## Configuration

Replace these placeholders:
- \`{{PUBLIC_BASE_URL}}\`: Your Optiview API endpoint
- \`{{PROPERTY_ID}}\`: Your property ID
- \`{{KEY_ID}}\`: Your API key ID

## Testing

1. Deploy the worker
2. Visit your website
3. Check the Optiview dashboard
4. Verify events are being tracked`
  },
  {
    id: 'api-reference',
    title: 'API Reference',
    path: '/docs/api',
    content: `# API Reference

## Authentication

All API requests require an API key in the header:

\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`

## Endpoints

### POST /api/events

Track an interaction event.

**Request Body:**
\`\`\`json
{
  "event_type": "page_view",
  "content_url": "https://example.com/page",
  "user_agent": "Mozilla/5.0...",
  "referer": "https://google.com",
  "metadata": {
    "page_title": "Example Page",
    "user_id": "12345"
  }
}
\`\`\`

**Response Headers:**
- \`x-optiview-event-id\`: Unique event identifier
- \`x-optiview-traffic-class\`: AI traffic classification
- \`x-optiview-ruleset-version\`: Rules version used

### GET /api/events

Retrieve events with filtering and pagination.

**Query Parameters:**
- \`project_id\`: Filter by project
- \`from\`: Start date (ISO 8601)
- \`to\`: End date (ISO 8601)
- \`cursor\`: Pagination cursor
- \`limit\`: Maximum results (default: 100)

**Response:**
\`\`\`json
{
  "events": [...],
  "next_cursor": "cursor_string",
  "total": 1234
}
\`\`\`

### GET /api/events/export.csv

Export events as CSV.

**Query Parameters:**
- \`project_id\`: Required project ID
- \`from\`: Start date (ISO 8601)
- \`to\`: End date (ISO 8601)
- \`cursor\`: Pagination cursor
- \`limit\`: Maximum rows (default: 10000)

**Response:**
- CSV file with headers
- Content-Disposition: attachment
- Streaming response for large exports

## Rate Limiting

- **Ingestion**: 10 requests per second per API key
- **Exports**: 1 request per second per user
- **Admin**: 30 requests per minute per IP

## Error Handling

**Rate Limited (429):**
\`\`\`json
{
  "error": "Rate limited",
  "retry_after": 60
}
\`\`\`

**Validation Error (400):**
\`\`\`json
{
  "error": "Validation failed",
  "details": ["Invalid event_type"]
}
\`\`\`

**Unauthorized (401):**
\`\`\`json
{
  "error": "Invalid API key"
}
\`\`\``
  },
  {
    id: 'security-privacy',
    title: 'Security & Privacy',
    path: '/docs/security',
    content: `# Security & Privacy

## Data Protection

### Encryption
- **In Transit**: TLS 1.3 for all API communications
- **At Rest**: AES-256 encryption for stored data
- **API Keys**: SHA-256 hashed with salt

### Access Control
- **API Keys**: Scoped to specific projects
- **Admin Access**: Role-based permissions
- **Session Management**: Secure cookies with expiration

### Privacy Features
- **No PII Collection**: We don't collect personal information
- **Data Minimization**: Only collect necessary analytics data
- **User Consent**: Respect browser privacy settings
- **Do Not Track** header respect

## Compliance

### GDPR
- **Data Processing**: Lawful basis for processing
- **User Rights**: Access, rectification, deletion
- **Data Portability**: Export in standard formats
- **Breach Notification**: 72-hour notification requirement

### CCPA
- **Consumer Rights**: Know, delete, opt-out
- **Data Categories**: Clear disclosure of collected data
- **Opt-out Mechanisms**: Respect browser DNT headers

### SOC 2
- **Security Controls**: Comprehensive security measures
- **Access Management**: Strict access controls
- **Audit Logging**: Complete audit trail
- **Incident Response**: Documented procedures

## Security Measures

### API Security
- **Rate Limiting**: Prevent abuse and DDoS
- **Input Validation**: Sanitize all inputs
- **CORS**: Restrict cross-origin requests
- **Content Security Policy**: Prevent XSS attacks

### Infrastructure
- **Cloudflare Security**: Enterprise-grade protection
- **DDoS Protection**: Automatic mitigation
- **Bot Management**: Advanced bot detection
- **SSL/TLS**: Always-on encryption

## Incident Response

### Security Breach
1. **Immediate**: Isolate affected systems
2. **Assessment**: Determine scope and impact
3. **Notification**: Alert stakeholders and authorities
4. **Remediation**: Fix vulnerabilities
5. **Recovery**: Restore normal operations
6. **Post-mortem**: Document lessons learned

### Contact Information
- **Security Team**: security@optiview.ai
- **Emergency**: +1-555-SECURITY`
  },
  {
    id: 'runbooks',
    title: 'Runbooks',
    path: '/docs/runbooks',
    content: `# Operational Runbooks

## Incident Response

### High Error Rate

**Symptoms:**
- Dashboard shows greater than 5% error rate
- Customer reports missing data
- API response times greater than 2s

**Immediate Actions:**
1. Check /admin/health endpoint
2. Review Cloudflare logs for errors
3. Check D1 database connectivity
4. Verify KV namespace access

**Escalation:**
- **5-10% error rate**: On-call engineer
- **10-20% error rate**: Senior engineer
- **Greater than 20% error rate**: Engineering manager

**Resolution:**
1. Identify root cause (DB, KV, or code)
2. Apply hotfix if needed
3. Monitor error rate for 15 minutes
4. Update incident status

### Data Loss

**Symptoms:**
- Events not appearing in dashboard
- CSV exports return empty results
- Customer reports missing data

**Immediate Actions:**
1. Check retention purge logs
2. Verify database backups
3. Check for accidental deletions
4. Review audit logs

**Escalation:**
- **Less than 1% data loss**: On-call engineer
- **1-5% data loss**: Senior engineer
- **Greater than 5% data loss**: Engineering manager + CTO

**Resolution:**
1. Stop any running purge jobs
2. Restore from backup if needed
3. Investigate root cause
4. Implement safeguards

### Performance Degradation

**Symptoms:**
- API response times greater than 5s
- Dashboard loading slowly
- CSV exports timing out

**Immediate Actions:**
1. Check database query performance
2. Review rate limiting settings
3. Check for DDoS attacks
4. Monitor resource usage

**Escalation:**
- **2-5s response time**: On-call engineer
- **5-10s response time**: Senior engineer
- **Greater than 10s response time**: Engineering manager

**Resolution:**
1. Optimize slow queries
2. Adjust rate limits if needed
3. Scale resources if necessary
4. Monitor performance metrics

## Maintenance Procedures

### Database Migrations

**Pre-migration:**
1. Create backup snapshot
2. Notify customers of downtime
3. Schedule during low-traffic hours
4. Prepare rollback plan

**During migration:**
1. Stop accepting new events
2. Run migration script
3. Verify data integrity
4. Resume normal operations

**Post-migration:**
1. Monitor error rates
2. Verify dashboard functionality
3. Check data accuracy
4. Update documentation

### API Key Rotation

**Scheduled rotation:**
1. Generate new API key
2. Set grace period (24 hours)
3. Notify customer of new key
4. Monitor for errors

**Emergency rotation:**
1. Generate new key immediately
2. Revoke old key
3. Notify customer
4. Monitor for impact

### Monitoring Setup

**Key Metrics:**
- Error rate (target: less than 1%)
- Response time (target: less than 500ms)
- Uptime (target: 99.9%)
- Data freshness (target: less than 5 minutes)

**Alerts:**
- Error rate greater than 5%
- Response time greater than 2s
- Database connectivity issues
- KV namespace errors

**Dashboards:**
- Real-time system health
- Historical performance trends
- Error rate by endpoint
- Resource utilization`
  },
  {
    id: 'sources',
    title: 'AI Sources',
    path: '/docs/sources',
    content: `# AI Sources

## What counts as a "source"?

AI sources are platforms, tools, or services that interact with your content and can be detected 
through various patterns. These include:

- Chat Assistants: ChatGPT, Claude, Gemini, and other AI chat tools
- Search Engines: Perplexity, AI-powered search platforms
- Crawlers: AI web crawlers and content scrapers
- Browser AI: Browser-based AI assistants and extensions
- Model APIs: Direct AI model API calls to your content

## How enable/disable affects dashboards

<strong>Important:</strong> Enabling or disabling sources does not change data ingestion. 
All AI interactions are still logged and stored. The enable/disable setting only affects:

- Whether the source appears in your main dashboard
- Whether you receive alerts for that source
- Whether the source is included in analytics and reports

## Suggesting patterns vs admin-managed rules

<strong>Non-admin users:</strong> Can suggest detection patterns for existing sources. 
These suggestions are reviewed by administrators and may be incorporated into the global 
detection system.

<strong>Admin users:</strong> Can create new global sources, edit existing ones, and 
manage the detection rules that power the entire system.

## Top content definition & window

Top content shows the most frequently accessed URLs for each AI source over the last 24 hours. 
This helps you understand which content is most valuable to AI platforms and users.

<strong>Data window:</strong> 24 hours from the current time<br/>
<strong>Maximum results:</strong> Top 5 URLs per source<br/>
<strong>Update frequency:</strong> Real-time (refreshed when viewing details)

## Pattern schema

When suggesting patterns, use this JSON structure:

\`\`\`json
{
  "ua_regex": ["pattern1", "pattern2"],
  "referer_domains": ["domain1.com", "domain2.com"],
  "header_contains": {
    "header_name": "value_pattern"
  }
}
\`\`\`

<strong>ua_regex:</strong> User agent patterns to match<br/>
<strong>referer_domains:</strong> Referrer domains that indicate AI usage<br/>
<strong>header_contains:</strong> HTTP headers that suggest AI interaction`
  }
];

const Docs: React.FC = () => {
  const [selectedDoc, setSelectedDoc] = useState<DocPage>(docs[0]);
  const [isMobile, setIsMobile] = useState(false);
  const [renderedHtml, setRenderedHtml] = useState<{ __html: string }>({ __html: '' });

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const renderDoc = async () => {
      const html = await renderMarkdown(selectedDoc.content);
      setRenderedHtml(html);
    };
    renderDoc();
  }, [selectedDoc]);

  const renderMarkdown = async (content: string) => {
    // Replace placeholders with actual values
    const processedContent = content
      .replace(/{{PUBLIC_BASE_URL}}/g, 'https://api.optiview.ai')
      .replace(/{{PROJECT_ID}}/g, '123')
      .replace(/{{PROPERTY_ID}}/g, '456')
      .replace(/{{KEY_ID}}/g, 'key_abc123')
      .replace(/{{SECRET}}/g, 'your_secret_here')
      .replace(/{{PROPERTY_DOMAIN}}/g, 'example.com');

    const rawHtml = await marked.parse(processedContent);
    const cleanHtml = DOMPurify.sanitize(rawHtml);
    
    return { __html: cleanHtml };
  };

  const copyCodeBlock = (code: string) => {
    navigator.clipboard.writeText(code);
    // You could add a toast notification here
  };

  // Add copy button functionality to code blocks
  useEffect(() => {
    const codeBlocks = document.querySelectorAll('pre code');
    codeBlocks.forEach((block) => {
      const pre = block.parentElement;
      if (pre && !pre.querySelector('.copy-button')) {
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-button absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 text-white rounded hover:bg-gray-600';
        copyButton.textContent = 'Copy';
        copyButton.onclick = () => copyCodeBlock(block.textContent || '');
        
        pre.style.position = 'relative';
        pre.appendChild(copyButton);
      }
    });
  }, [selectedDoc]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Navigation */}
      <div className={`${isMobile ? 'w-64 absolute left-0 z-10 bg-white shadow-lg' : 'w-64'} bg-white border-r border-gray-200 overflow-y-auto`}>
        <div className="p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Documentation</h2>
          <nav className="space-y-1">
            {docs.map((doc) => (
              <button
                key={doc.id}
                onClick={() => setSelectedDoc(doc)}
                className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                  selectedDoc.id === doc.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {doc.title}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Mobile overlay */}
      {isMobile && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-0"
          onClick={() => setIsMobile(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6">
          <div className="prose prose-lg max-w-none">
            <div 
              dangerouslySetInnerHTML={renderedHtml}
              className="markdown-content"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Docs;
