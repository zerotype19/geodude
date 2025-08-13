# JavaScript Tag Installation

The Optiview Analytics JavaScript tag is a lightweight tracking script that you can add to your website to collect analytics data.

> **⚠️ Important**: For production use, you must set up a custom domain for your Optiview API. See [Custom Domain Setup](./custom-domain.md) for detailed instructions.

## Quick Start

### 1. Get Your Tracking Code
1. Log into your Optiview dashboard
2. Go to **Install** → **JavaScript Tag**
3. Copy the generated tracking code

### 2. Add to Your Website
Add the tracking code to the `<head>` section of your HTML pages:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Your Website</title>
  
  <!-- Optiview Analytics -->
  <script>
    // Your tracking code will be here
  </script>
</head>
<body>
  <!-- Your website content -->
</body>
</html>
```

## Manual Installation

If you prefer to create the tracking code manually, use this template:

```javascript
// Optiview Analytics Tag v1.0
!function(){
  try{
    var pid = "{{PROPERTY_ID}}"; 
    var kid = "{{KEY_ID}}";
    var ep = "{{PUBLIC_BASE_URL}}/api/events";
    
    var payload = {
      project_id: {{PROJECT_ID}},
      property_id: pid,
      event_type: "view",
      metadata: {
        p: location.pathname,
        r: document.referrer ? new URL(document.referrer).hostname : "",
        t: document.title.slice(0,120),
        ua: navigator.userAgent.slice(0,100)
      }
    };
    
    var body = JSON.stringify(payload);
    var timestamp = Math.floor(Date.now() / 1000);
    
    // Send the event
    fetch(ep, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-optiview-key-id": kid,
        "x-optiview-timestamp": timestamp
      },
      body: body
    }).catch(function(e) {
      // Silent fail for analytics
    });
  }catch(e){
    // Silent fail for analytics
  }
}();
```

### Replace Placeholders
- `{{PROJECT_ID}}`: Your project ID from the dashboard
- `{{PROPERTY_ID}}`: Your property/website ID
- `{{KEY_ID}}`: Your API key ID
- `{{PUBLIC_BASE_URL}}`: Your custom domain (e.g., `https://api.yourdomain.com`)

## Advanced Configuration

### Custom Event Tracking
Track custom events beyond page views:

```javascript
// Track a button click
document.getElementById('signup-button').addEventListener('click', function() {
  optiviewTrack('signup_click', {
    button_text: this.textContent,
    page: location.pathname
  });
});

// Track form submissions
document.getElementById('contact-form').addEventListener('submit', function() {
  optiviewTrack('form_submit', {
    form_name: 'contact',
    page: location.pathname
  });
});

// Helper function for custom events
function optiviewTrack(eventType, metadata) {
  var payload = {
    project_id: {{PROJECT_ID}},
    property_id: "{{PROPERTY_ID}}",
    event_type: eventType,
    metadata: {
      ...metadata,
      p: location.pathname,
      t: document.title.slice(0,120)
    }
  };
  
  fetch("{{PUBLIC_BASE_URL}}/api/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-optiview-key-id": "{{KEY_ID}}",
      "x-optiview-timestamp": Math.floor(Date.now() / 1000)
    },
    body: JSON.stringify(payload)
  }).catch(function(e) {
    // Silent fail for analytics
  });
}
```

### Enhanced Metadata
Collect additional context about user interactions:

```javascript
var enhancedMetadata = {
  // Page information
  p: location.pathname,
  t: document.title.slice(0,120),
  u: location.href,
  
  // User agent details
  ua: navigator.userAgent.slice(0,100),
  lang: navigator.language,
  
  // Screen and viewport
  sw: screen.width,
  sh: screen.height,
  vw: window.innerWidth,
  vh: window.innerHeight,
  
  // Referrer information
  r: document.referrer ? new URL(document.referrer).hostname : "",
  
  // Timing information
  load_time: performance.now(),
  
  // Custom business data
  user_type: getUserType(), // Your custom function
  page_category: getPageCategory() // Your custom function
};
```

## Google Tag Manager Integration

For GTM users, we provide a ready-to-import template:

1. Download the [GTM Template](./../assets/gtm/optiview-tag.json)
2. Import into your GTM container
3. Configure the variables:
   - `PROJECT_ID`
   - `PROPERTY_ID` 
   - `KEY_ID`
   - `ENDPOINT`
4. Set trigger to "All Pages" or your preferred trigger

See [GTM Setup](./gtm.md) for detailed instructions.

## Testing Your Installation

### 1. Check Network Tab
1. Open browser Developer Tools
2. Go to Network tab
3. Navigate to a page with the tracking code
4. Look for requests to `/api/events`
5. Verify the request includes correct headers and payload

### 2. Verify Dashboard
1. Check your Optiview dashboard
2. Look for the "Install Verification" banner
3. Should show "Installed" within 60 seconds of first event
4. Events should appear in real-time

### 3. Test Custom Events
1. Trigger custom events (clicks, form submissions)
2. Check dashboard for custom event types
3. Verify metadata is captured correctly

## Troubleshooting

### Common Issues

#### No Events Appearing
- Check browser console for JavaScript errors
- Verify API key is correct
- Ensure custom domain is configured
- Check CORS settings allow your domain

#### CORS Errors
- Verify your domain is in the allowed origins list
- Check that `PUBLIC_BASE_URL` matches your custom domain
- Ensure SSL certificates are valid

#### Authentication Errors
- Verify API key ID and secret are correct
- Check timestamp skew (should be within 5 minutes)
- Ensure API key hasn't expired or been revoked

### Debug Mode
Enable debug logging by adding this before the tracking code:

```javascript
window.OPTIVIEW_DEBUG = true;
```

This will log tracking attempts to the console.

## Performance Considerations

### Lightweight Design
- Script size: ~2KB minified
- No external dependencies
- Asynchronous loading
- Silent failure handling

### Best Practices
- Load in `<head>` for early tracking
- Use `async` attribute if loading script separately
- Consider lazy loading for non-critical pages
- Monitor performance impact

### CDN Integration
For high-traffic sites, consider hosting the tracking code on a CDN:

```html
<script src="https://cdn.yourdomain.com/optiview-tag.js" async></script>
```

## Security Features

### API Key Authentication
- HMAC-based request signing
- Timestamp validation (5-minute skew tolerance)
- Rate limiting per API key
- Automatic key rotation support

### Data Privacy
- No personally identifiable information collected by default
- Configurable data retention policies
- GDPR compliance features
- Data export and deletion capabilities

## Support

If you need help with installation:

1. Check the [troubleshooting section](#troubleshooting)
2. Review your browser's console for errors
3. Verify your configuration matches the examples
4. Contact support with specific error messages

## Next Steps

After installing the tracking code:

1. **Verify installation** using the testing steps above
2. **Set up custom events** for important user interactions
3. **Configure goals** in your dashboard
4. **Set up alerts** for unusual traffic patterns
5. **Review data** to ensure accurate collection

---

**Need help?** Check our [Installation Guide](../install.md) or contact support.
