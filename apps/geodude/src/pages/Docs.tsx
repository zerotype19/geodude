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
    title: 'Install / JS Tag',
    path: '/docs/install/js',
    content: `# JavaScript Tag Installation

## Quick Start

Add this script tag to your HTML `<head>` section:

\`\`\`html
<script src="{{PUBLIC_BASE_URL}}/v1/tag.js?pid=YOUR_PROPERTY_ID&kid=YOUR_KEY_ID"></script>
\`\`\`

## Parameters

- \`pid\`: Your property ID from the dashboard
- \`kid\`: Your API key ID from the dashboard

## Automatic Tracking

The tag automatically tracks:
- Page views
- Referrer information
- User agent patterns
- AI traffic classification

## Custom Events

Track custom events:

\`\`\`javascript
// Track a custom event
window.optiview?.track('purchase', {
  value: 99.99,
  currency: 'USD'
});
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
  // Your existing worker logic here
  
  // Add Optiview tracking
  const optiviewData = {
    project_id: {{PROJECT_ID}},
    property_id: '{{PROPERTY_DOMAIN}}',
    event_type: 'page_view',
    metadata: {
      url: request.url,
      method: request.method,
      user_agent: request.headers.get('user-agent'),
      referer: request.headers.get('referer')
    }
  };

  // Send to Optiview API
  fetch('{{PUBLIC_BASE_URL}}/api/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-optiview-key-id': '{{KEY_ID}}',
      'x-optiview-timestamp': Math.floor(Date.now() / 1000).toString(),
      'x-optiview-signature': await generateSignature(optiviewData, '{{SECRET}}')
    },
    body: JSON.stringify(optiviewData)
  }).catch(console.error);

  // Continue with your response
  return new Response('Hello World!')
}

async function generateSignature(data, secret) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(JSON.stringify(data))
  )
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
}
\`\`\`

## Environment Variables

Set these in your Worker:

- \`{{PROJECT_ID}}\`: Your Optiview project ID
- \`{{PROPERTY_DOMAIN}}\`: Your domain
- \`{{KEY_ID}}\`: Your API key ID
- \`{{SECRET}}\`: Your API key secret

## Deployment

1. Deploy your worker
2. Add custom domain if needed
3. Test tracking in Optiview dashboard
4. Monitor for any errors

## Advanced Usage

Track custom events:

\`\`\`javascript
// Track API calls
await trackEvent('api_call', {
  endpoint: '/api/users',
  response_time: 150,
  status: 200
})

async function trackEvent(type, metadata) {
  // Implementation similar to above
}
\`\`\``
  },
  {
    id: 'api-reference',
    title: 'API Reference',
    path: '/docs/api',
    content: `# API Reference

## Authentication

All API requests require HMAC authentication:

\`\`\`http
x-optiview-key-id: YOUR_KEY_ID
x-optiview-timestamp: 1640995200
x-optiview-signature: BASE64_HMAC_SIGNATURE
\`\`\`

## Endpoints

### Events

#### POST /api/events

Track user interactions and page views.

**Request Body:**
\`\`\`json
{
  "project_id": 123,
  "property_id": "example.com",
  "event_type": "page_view",
  "metadata": {
    "url": "/products/123",
    "title": "Product Page",
    "referer": "https://google.com"
  }
}
\`\`\`

**Response:**
\`\`\`json
{
  "id": 456,
  "event_type": "page_view",
  "project_id": 123
}
\`\`\`

#### GET /api/events/export.csv

Export events as CSV.

**Query Parameters:**
- \`project_id\`: Required
- \`from\`: ISO date string (optional)
- \`to\`: ISO date string (optional)
- \`cursor\`: Pagination cursor (optional)
- \`limit\`: Max rows (default: 10000)

**Response Headers:**
- \`x-optiview-next-cursor\`: Next page cursor
- \`x-optiview-total-rows\`: Rows in current response

### Referrals

#### POST /api/referrals

Track AI referral traffic.

**Request Body:**
\`\`\`json
{
  "ai_source_id": 1,
  "content_id": 456,
  "ref_type": "search_result",
  "detected_at": 1640995200000
}
\`\`\`

#### GET /api/referrals/export.csv

Export referrals as CSV.

**Query Parameters:**
- \`project_id\`: Required
- \`from\`: ISO date string (optional)
- \`to\`: ISO date string (optional)
- \`cursor\`: Pagination cursor (optional)
- \`limit\`: Max rows (default: 10000)

## Rate Limits

- **Events API**: 10 requests/second per key
- **CSV Exports**: 1 request/second per user
- **Admin Routes**: 30 requests/minute per IP

## Error Codes

- \`400\`: Bad Request (validation failed)
- \`401\`: Unauthorized (authentication failed)
- \`403\`: Forbidden (access denied)
- \`415\`: Unsupported Media Type
- \`429\`: Rate Limited
- \`500\`: Internal Server Error

## Response Headers

All responses include:
- \`x-optiview-request-id\`: Unique request identifier
- \`x-optiview-trace\`: Traffic classification (if enabled)`
  },
  {
    id: 'security-privacy',
    title: 'Security & Privacy',
    path: '/docs/security',
    content: `# Security & Privacy

## Data Protection

### What We Collect

**Automatically Tracked:**
- Page view URLs
- Referrer domains
- User agent strings (hashed)
- IP addresses (hashed)
- Timestamp of interactions

**Never Collected:**
- Personal identifying information
- Form input data
- Credit card information
- Passwords or credentials
- Private messages or content

### Data Retention

Data is automatically deleted based on your plan:
- **Starter**: 30 days
- **Pro**: 90 days
- **Enterprise**: 365 days

You can also manually purge data via the admin API.

## Security Measures

### Authentication

- **HMAC-SHA256** signatures for all API requests
- **API key rotation** with grace periods
- **Rate limiting** to prevent abuse
- **CORS protection** for browser requests

### Data Security

- **End-to-end encryption** in transit (TLS 1.3)
- **At-rest encryption** for all stored data
- **Access controls** with project-level isolation
- **Audit logging** for all administrative actions

### Privacy Controls

- **GDPR compliance** with data export/deletion
- **CCPA compliance** for California residents
- **Cookie consent** integration support
- **Do Not Track** header respect

## Compliance

### GDPR

- **Right to Access**: Export your data via CSV
- **Right to Deletion**: Use admin purge API
- **Data Portability**: Standard JSON format
- **Consent Management**: Integrate with your consent system

### CCPA

- **Consumer Rights**: Access, deletion, portability
- **Opt-out Mechanisms**: Respect browser DNT headers
- **Data Categories**: Clear disclosure of collected data

### HIPAA

- **No PHI Collection**: We don't collect health information
- **Business Associate**: Can sign BAAs for covered entities
- **Audit Trails**: Complete logging of all access

## Best Practices

### Implementation

1. **Secure API Keys**: Store secrets securely
2. **HTTPS Only**: Always use secure connections
3. **Regular Rotation**: Rotate API keys quarterly
4. **Monitor Usage**: Watch for unusual patterns

### Privacy

1. **Clear Notice**: Inform users about tracking
2. **Consent**: Get explicit consent where required
3. **Minimization**: Only collect necessary data
4. **Transparency**: Provide privacy policy

## Incident Response

### Security Breaches

- **24/7 Monitoring**: Automated threat detection
- **Immediate Response**: Security team notification
- **Customer Notification**: Within 72 hours
- **Forensic Analysis**: Complete incident review

### Data Breaches

- **Breach Notification**: Legal compliance
- **Customer Support**: Dedicated response team
- **Regulatory Reporting**: Required notifications
- **Remediation**: Security improvements

## Contact

For security concerns:
- **Security Team**: security@optiview.ai
- **Bug Bounty**: security.optiview.ai
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
- Dashboard shows >5% error rate
- Customer reports missing data
- API response times >2s

**Immediate Actions:**
1. Check `/admin/health` endpoint
2. Review Cloudflare logs for errors
3. Check D1 database connectivity
4. Verify KV namespace access

**Escalation:**
- **5-10% error rate**: On-call engineer
- **10-20% error rate**: Senior engineer
- **>20% error rate**: Engineering manager

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
- **<1% data loss**: On-call engineer
- **1-5% data loss**: Senior engineer
- **>5% data loss**: Engineering manager + CTO

**Resolution:**
1. Stop any running purge jobs
2. Restore from backup if needed
3. Investigate root cause
4. Implement safeguards

### Performance Degradation

**Symptoms:**
- API response times >5s
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
- **>10s response time**: Engineering manager

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
3. Notify customer urgently
4. Provide new key via secure channel

### Rate Limit Adjustments

**Increase limits:**
1. Verify customer need
2. Check current usage patterns
3. Adjust limits gradually
4. Monitor for abuse

**Decrease limits:**
1. Identify abuse patterns
2. Apply new limits
3. Notify affected customers
4. Monitor for compliance

## Monitoring & Alerting

### Key Metrics

**Performance:**
- API response time (P50, P95, P99)
- Error rate by endpoint
- Database query performance
- KV operation latency

**Business:**
- Events per second
- Active projects
- API key usage
- Data retention compliance

**Infrastructure:**
- CPU/memory usage
- Database connections
- KV namespace size
- Cron job success rate

### Alert Thresholds

**Critical (P0):**
- Service completely down
- Data corruption detected
- Security breach suspected

**High (P1):**
- Error rate >10%
- Response time >5s
- Data loss detected

**Medium (P2):**
- Error rate >5%
- Response time >2s
- Performance degradation

**Low (P3):**
- Error rate >1%
- Response time >1s
- Minor issues

### Escalation Matrix

**On-call Engineer (P3, P2):**
- Initial response within 15 minutes
- Resolution within 2 hours
- Escalate if unable to resolve

**Senior Engineer (P1):**
- Response within 5 minutes
- Resolution within 1 hour
- Coordinate with on-call

**Engineering Manager (P0):**
- Immediate response
- Coordinate team response
- Customer communication
- Executive updates

## Customer Support

### Common Issues

**Installation Problems:**
1. Verify API key permissions
2. Check property ID matching
3. Test endpoint accessibility
4. Review browser console errors

**Data Accuracy:**
1. Verify tracking code placement
2. Check for ad blockers
3. Review referrer policies
4. Test with different browsers

**Performance Issues:**
1. Check rate limiting
2. Verify data retention settings
3. Review query patterns
4. Optimize tracking implementation

### Support Tiers

**Tier 1 (Basic):**
- Installation assistance
- Configuration help
- Basic troubleshooting
- Documentation guidance

**Tier 2 (Technical):**
- API debugging
- Performance optimization
- Custom implementation
- Integration support

**Tier 3 (Advanced):**
- Custom development
- Enterprise features
- SLA compliance
- Strategic consulting

## Post-Incident

### Postmortem Process

**Within 24 hours:**
1. Complete incident timeline
2. Identify root cause
3. Document lessons learned
4. Assign action items

**Within 1 week:**
1. Implement preventive measures
2. Update runbooks
3. Train team on new procedures
4. Customer communication

**Within 1 month:**
1. Review incident response
2. Update monitoring
3. Test new procedures
4. Document improvements`
  }
];

const Docs: React.FC = () => {
  const [selectedDoc, setSelectedDoc] = useState<DocPage>(docs[0]);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const renderMarkdown = (content: string) => {
    // Replace placeholders with actual values
    const processedContent = content
      .replace(/{{PUBLIC_BASE_URL}}/g, 'https://api.optiview.ai')
      .replace(/{{PROJECT_ID}}/g, '123')
      .replace(/{{PROPERTY_ID}}/g, '456')
      .replace(/{{KEY_ID}}/g, 'key_abc123')
      .replace(/{{SECRET}}/g, 'your_secret_here')
      .replace(/{{PROPERTY_DOMAIN}}/g, 'example.com');

    const rawHtml = marked(processedContent);
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
              dangerouslySetInnerHTML={renderMarkdown(selectedDoc.content)}
              className="markdown-content"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Docs;
