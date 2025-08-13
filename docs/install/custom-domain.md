# Custom Domain Setup for Production

## Overview
For production use, you'll need to set up a custom domain for your Optiview Analytics API. This ensures your tracking code works across all your websites and provides a professional appearance.

## Prerequisites
- A Cloudflare account with a domain
- Access to your Cloudflare dashboard
- Your Optiview Worker deployed and running

## Step-by-Step Setup

### 1. Deploy Your Worker
First, ensure your Optiview Worker is deployed to Cloudflare:

```bash
cd apps/geodude-api
pnpm run deploy
```

### 2. Add Custom Domain in Cloudflare

#### 2.1 Access Workers & Pages
1. Log into your [Cloudflare dashboard](https://dash.cloudflare.com)
2. Select your domain
3. Navigate to **Workers & Pages** in the left sidebar

#### 2.2 Configure Custom Domain
1. Find your Optiview Worker in the list
2. Click on the Worker name to open its details
3. Go to the **Settings** tab
4. Scroll down to **Custom Domains**
5. Click **Add Custom Domain**

#### 2.3 Domain Configuration
1. **Domain**: Enter your desired subdomain (e.g., `api.yourdomain.com`)
2. **Zone**: Select your domain from the dropdown
3. **Environment**: Choose `Production`
4. Click **Add Custom Domain**

#### 2.3 DNS Configuration
Cloudflare will automatically create the necessary DNS records. You should see:
- An A record pointing to `192.0.2.1` (Cloudflare's placeholder IP)
- A CNAME record for the subdomain

### 3. Update Environment Variables

#### 3.1 Update PUBLIC_BASE_URL
Set your environment variable to use the new custom domain:

```bash
# In your .env file or Cloudflare dashboard
PUBLIC_BASE_URL=https://api.yourdomain.com
```

#### 3.2 Verify Configuration
Test that your custom domain is working:

```bash
curl https://api.yourdomain.com/health
```

### 4. Update Tracking Code

#### 4.1 JavaScript Tag
Update your tracking code to use the new domain:

```javascript
// Old version
var ep = "https://api.optiview.ai/api/events";

// New version
var ep = "https://api.yourdomain.com/api/events";
```

#### 4.2 GTM Template
If using Google Tag Manager, update the endpoint variable in your GTM template.

## SSL/TLS Configuration

### Automatic SSL
Cloudflare automatically provides SSL certificates for custom domains. Ensure:
- **SSL/TLS encryption mode** is set to `Full (strict)` in your domain settings
- **Always Use HTTPS** is enabled in **SSL/TLS > Edge Certificates**

### SSL Verification
Test your SSL configuration:
```bash
curl -I https://api.yourdomain.com
# Should return 200 OK with HTTPS
```

## Security Considerations

### CORS Configuration
Update your CORS settings to allow your production domains:

```typescript
// In your worker configuration
const allowedOrigins = [
  'https://yourdomain.com',
  'https://www.yourdomain.com',
  'https://app.yourdomain.com'
];
```

### Rate Limiting
Consider adjusting rate limits for production:
```bash
# Production rate limits
INGEST_RATE_LIMIT_RPS=100
INGEST_RATE_LIMIT_BURST=500
CSV_EXPORT_RATE_LIMIT_RPS=5
```

## Testing Your Setup

### 1. Health Check
```bash
curl https://api.yourdomain.com/health
```

### 2. Event Tracking
Test event tracking with your new domain:
```javascript
fetch('https://api.yourdomain.com/api/events', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    project_id: 1,
    property_id: 'test',
    event_type: 'view',
    metadata: { test: true }
  })
});
```

### 3. Dashboard Access
Verify your dashboard works with the new domain:
```bash
curl -H "Cookie: ov_sess=your-session-id" \
     https://api.yourdomain.com/auth/me
```

## Troubleshooting

### Common Issues

#### DNS Not Propagating
- Wait up to 24 hours for DNS changes to propagate globally
- Check your DNS records in Cloudflare dashboard
- Verify the A record points to `192.0.2.1`

#### SSL Certificate Issues
- Ensure SSL/TLS mode is set to `Full (strict)`
- Check that `Always Use HTTPS` is enabled
- Verify your domain has a valid SSL certificate

#### CORS Errors
- Update your CORS configuration to include your production domains
- Check browser console for specific CORS error messages
- Verify the `Access-Control-Allow-Origin` header is set correctly

#### Worker Not Responding
- Verify your Worker is deployed and running
- Check Worker logs in Cloudflare dashboard
- Ensure the custom domain is properly configured

### Debug Commands
```bash
# Check DNS resolution
nslookup api.yourdomain.com

# Test SSL certificate
openssl s_client -connect api.yourdomain.com:443

# Verify Worker response
curl -v https://api.yourdomain.com/health
```

## Production Checklist

Before going live, verify:

- [ ] Custom domain resolves correctly
- [ ] SSL certificate is valid
- [ ] Worker responds on custom domain
- [ ] CORS allows your production domains
- [ ] Environment variables updated
- [ ] Tracking code updated
- [ ] Dashboard accessible via custom domain
- [ ] Rate limits configured for production
- [ ] Monitoring and alerts configured

## Support

If you encounter issues:

1. Check the [Cloudflare documentation](https://developers.cloudflare.com/workers/platform/triggers/custom-domains/)
2. Review your Worker logs in Cloudflare dashboard
3. Verify your DNS and SSL configuration
4. Test with a simple endpoint first

## Next Steps

After setting up your custom domain:

1. **Update your documentation** with the new API endpoint
2. **Configure monitoring** for your production API
3. **Set up alerts** for downtime or errors
4. **Test thoroughly** before deploying to production websites
5. **Monitor performance** and adjust rate limits as needed

---

**Note**: This guide assumes you're using Cloudflare Workers. If you're using a different platform, the steps may vary but the principles remain the same.
