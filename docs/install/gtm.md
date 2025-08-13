# Google Tag Manager Integration

Integrate Optiview Analytics with Google Tag Manager (GTM) for easy deployment and management of your tracking code.

## Overview

GTM integration provides several benefits:
- **Centralized management** of all tracking tags
- **Easy deployment** across multiple websites
- **Version control** and rollback capabilities
- **Testing and preview** before going live
- **No code changes** required for updates

## Prerequisites

- Google Tag Manager account and container
- Access to your website's GTM container
- Optiview project ID, property ID, and API key
- Custom domain configured for your Optiview API

## Quick Setup

### 1. Download the GTM Template

1. Download the [Optiview GTM Template](../assets/gtm/optiview-tag.json)
2. This template includes all necessary configurations

### 2. Import into GTM

1. Log into [Google Tag Manager](https://tagmanager.google.com/)
2. Select your container
3. Click **Admin** → **Import Container**
4. Choose the downloaded JSON file
5. Select **Merge** to add to existing container
6. Click **Continue** and **Confirm**

### 3. Configure Variables

After import, you'll need to configure these variables:

#### Required Variables

| Variable Name | Description | Example |
|---------------|-------------|---------|
| `PROJECT_ID` | Your Optiview project ID | `123` |
| `PROPERTY_ID` | Your website/property ID | `456` |
| `KEY_ID` | Your Optiview API key ID | `key_abc123` |
| `ENDPOINT` | Your Optiview API endpoint | `https://api.yourdomain.com/api/events` |
| `PUBLIC_BASE_URL` | Your custom domain base URL | `https://api.yourdomain.com` |

#### How to Set Variables

1. Go to **Variables** in the left sidebar
2. Click **New** for each variable
3. Choose **Variable Type**: `Constant`
4. Enter the variable name and value
5. Click **Save**

### 4. Configure the Tag

1. Go to **Tags** in the left sidebar
2. Find **Optiview Analytics** tag
3. Click to edit the configuration
4. Verify all variables are correctly mapped
5. Set the trigger to **All Pages** (or your preferred trigger)

### 5. Test and Publish

1. Click **Preview** to test in a new tab
2. Navigate to your website
3. Check the GTM debug panel for Optiview events
4. Verify events appear in your Optiview dashboard
5. If everything works, click **Submit** to publish

## Manual Setup

If you prefer to create the configuration manually:

### 1. Create Variables

#### PROJECT_ID (Constant)
```
Variable Type: Constant
Variable Name: PROJECT_ID
Value: [Your Project ID]
```

#### PROPERTY_ID (Constant)
```
Variable Type: Constant
Variable Name: PROPERTY_ID
Value: [Your Property ID]
```

#### KEY_ID (Constant)
```
Variable Type: Constant
Variable Name: KEY_ID
Value: [Your API Key ID]
```

#### ENDPOINT (Constant)
```
Variable Type: Constant
Variable Name: ENDPOINT
Value: [Your Custom Domain]/api/events
```

#### PUBLIC_BASE_URL (Constant)
```
Variable Type: Constant
Variable Name: PUBLIC_BASE_URL
Value: [Your Custom Domain]
```

### 2. Create the Tag

#### Tag Configuration
```
Tag Type: Custom HTML
Tag Name: Optiview Analytics
HTML: [See template below]
```

#### HTML Template
```html
<script>
// Optiview Analytics Tag v1.0
!function(){
  try{
    var pid = "{{PROPERTY_ID}}"; 
    var kid = "{{KEY_ID}}";
    var ep = "{{ENDPOINT}}";
    
    var payload = {
      project_id: {{PROJECT_ID}},
      property_id: pid,
      event_type: "view",
      metadata: {
        p: location.pathname,
        r: document.referrer ? new URL(document.referrer).hostname : "",
        t: document.title.slice(0,120),
        ua: navigator.userAgent.slice(0,100),
        gtm: true
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
</script>
```

### 3. Set Trigger

```
Trigger Type: Page View
Trigger Name: All Pages
```

## Advanced Configuration

### Custom Event Tracking

To track custom events, create additional tags:

#### Button Click Tracking
```html
<script>
document.addEventListener('click', function(e) {
  if (e.target.matches('[data-optiview-track]')) {
    var eventType = e.target.getAttribute('data-optiview-track');
    var metadata = JSON.parse(e.target.getAttribute('data-optiview-data') || '{}');
    
    optiviewTrack(eventType, metadata);
  }
});

function optiviewTrack(eventType, metadata) {
  var payload = {
    project_id: {{PROJECT_ID}},
    property_id: "{{PROPERTY_ID}}",
    event_type: eventType,
    metadata: {
      ...metadata,
      p: location.pathname,
      t: document.title.slice(0,120),
      gtm: true
    }
  };
  
  fetch("{{ENDPOINT}}", {
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
</script>
```

#### Form Submission Tracking
```html
<script>
document.addEventListener('submit', function(e) {
  if (e.target.matches('[data-optiview-track]')) {
    var eventType = e.target.getAttribute('data-optiview-track');
    var metadata = {
      form_name: e.target.name || e.target.id,
      form_action: e.target.action
    };
    
    optiviewTrack(eventType, metadata);
  }
});
</script>
```

### Enhanced Triggers

#### Specific Pages
```
Trigger Type: Page View
Trigger Name: Homepage Only
Fire On: Some Page Views
Page URL: equals /home
```

#### User Interaction
```
Trigger Type: Click - All Elements
Trigger Name: Button Clicks
Fire On: Some Clicks
Click Element: matches CSS selector .btn
```

#### Form Interactions
```
Trigger Type: Form Submission
Trigger Name: Contact Form
Fire On: Some Forms
Form ID: equals contact-form
```

## Testing and Debugging

### 1. GTM Preview Mode

1. Click **Preview** in GTM
2. Open your website in a new tab
3. Look for the GTM debug panel
4. Check that Optiview tag fires on page load
5. Verify variables are populated correctly

### 2. Browser Developer Tools

1. Open Developer Tools → Network tab
2. Navigate to a page with the tag
3. Look for requests to your Optiview API
4. Verify request headers and payload
5. Check for any JavaScript errors

### 3. Optiview Dashboard

1. Check your Optiview dashboard
2. Look for real-time events
3. Verify event metadata includes `gtm: true`
4. Check that events appear within 60 seconds

### 4. Common Issues

#### Tag Not Firing
- Check trigger configuration
- Verify variables are set correctly
- Look for JavaScript errors in console
- Ensure GTM container is properly installed

#### Events Not Reaching API
- Verify endpoint URL is correct
- Check CORS settings allow your domain
- Verify API key is valid
- Check network tab for failed requests

#### Variable Errors
- Ensure all required variables are created
- Check variable names match exactly
- Verify variable values are correct
- Test variables in GTM preview mode

## Performance Optimization

### 1. Tag Loading

- **Load in `<head>`** for early tracking
- **Use async loading** to avoid blocking page render
- **Minimize tag size** by removing unnecessary code
- **Consider lazy loading** for non-critical pages

### 2. Event Batching

For high-traffic sites, consider batching events:

```html
<script>
var eventQueue = [];
var batchSize = 10;
var flushInterval = 5000; // 5 seconds

function queueEvent(eventType, metadata) {
  eventQueue.push({
    event_type: eventType,
    metadata: metadata,
    timestamp: Date.now()
  });
  
  if (eventQueue.length >= batchSize) {
    flushEvents();
  }
}

function flushEvents() {
  if (eventQueue.length === 0) return;
  
  var events = eventQueue.splice(0);
  var payload = {
    project_id: {{PROJECT_ID}},
    property_id: "{{PROPERTY_ID}}",
    events: events
  };
  
  fetch("{{ENDPOINT}}/batch", {
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

// Flush events periodically
setInterval(flushEvents, flushInterval);
</script>
```

## Security Considerations

### 1. API Key Protection

- Store API keys in GTM variables (not hardcoded)
- Use environment-specific containers for dev/staging/prod
- Regularly rotate API keys
- Monitor API usage for unusual patterns

### 2. Data Validation

- Validate all user inputs before sending to API
- Sanitize metadata to prevent injection attacks
- Implement rate limiting on the client side
- Monitor for suspicious activity

### 3. Privacy Compliance

- Ensure GDPR compliance if applicable
- Implement data retention policies
- Provide opt-out mechanisms
- Document data collection practices

## Troubleshooting

### Debug Checklist

- [ ] GTM container properly installed on website
- [ ] All variables configured correctly
- [ ] Tag trigger set to appropriate pages
- [ ] No JavaScript errors in console
- [ ] Network requests reaching Optiview API
- [ ] API responding with success status
- [ ] Events appearing in Optiview dashboard

### Support Resources

1. **GTM Help Center**: [support.google.com/tagmanager](https://support.google.com/tagmanager)
2. **GTM Community**: [groups.google.com/forum/#!forum/tag-manager](https://groups.google.com/forum/#!forum/tag-manager)
3. **Optiview Documentation**: Check our main docs for API details
4. **Browser Developer Tools**: Use console and network tabs for debugging

## Best Practices

### 1. Tag Management

- Use descriptive names for tags, triggers, and variables
- Document your configuration for team members
- Test changes in preview mode before publishing
- Use workspaces for collaborative development

### 2. Performance

- Minimize the number of tags firing on each page
- Use appropriate triggers to avoid unnecessary executions
- Monitor tag performance impact
- Consider using tag firing rules for optimization

### 3. Maintenance

- Regularly review and update configurations
- Monitor for deprecated features
- Keep GTM container up to date
- Document any custom modifications

## Next Steps

After setting up GTM integration:

1. **Test thoroughly** in preview mode
2. **Monitor performance** and adjust as needed
3. **Set up custom events** for important interactions
4. **Configure goals** in your Optiview dashboard
5. **Train your team** on GTM management
6. **Plan for future enhancements** and customizations

---

**Need help?** Check our [Installation Guide](../install.md) or contact support.
