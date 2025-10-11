# AI Bot Log Ingestion Guide

This guide explains how to upload real AI crawler access logs to Optiview for Phase G: Real AI-crawler signals + page-level readiness.

---

## Overview

Optiview can ingest real AI bot access logs from your web server (Cloudflare, NGINX, Apache, IIS, etc.) to track which AI crawlers are actually visiting your site. This data is combined with simulated probes to give you complete visibility into AI bot access.

**Benefits:**
- Track real AI bot traffic to your site (30-90 day rolling window)
- See which pages AI bots are accessing
- Identify discrepancies between simulated probes and real traffic
- +2 bonus points to Crawlability score when real traffic is detected

---

## Supported AI Bots

Optiview currently detects these AI crawlers:

| Bot Name          | User-Agent Pattern    | Owner           |
|-------------------|-----------------------|-----------------|
| GPTBot            | `gptbot`              | OpenAI          |
| ChatGPT-User      | `chatgpt-user`        | OpenAI          |
| Claude-Web        | `claude-web|claudebot`| Anthropic       |
| PerplexityBot     | `perplexitybot`       | Perplexity AI   |
| CCBot             | `ccbot`               | Common Crawl    |
| Google-Extended   | `google-extended`     | Google          |
| Amazonbot         | `amazonbot`           | Amazon          |
| Bingbot           | `bingbot`             | Microsoft       |
| FacebookBot       | `facebookbot`         | Meta            |
| Applebot          | `applebot`            | Apple           |

> More bots will be added as they become widely used.

---

## Data Format

Optiview accepts flexible JSON input. Each log entry should include:

### Required Fields
- **User-Agent**: One of `user_agent`, `ua`
- **Domain**: One of `domain`, `host`, `hostname`, or full `url`
- **Path**: One of `path`, `uri`, `url` (pathname will be extracted)

### Optional Fields
- **Status**: HTTP response code (one of `status`, `code`)
- **Timestamp**: One of `ts` (epoch ms), `timestamp` (ISO string or epoch)
- **IP Hash**: SHA-256 hash of IP address (never send raw IPs)
- **Extra Data**: Any additional fields stored as JSON

### Example JSON Entry

```json
{
  "domain": "cologuard.com",
  "path": "/",
  "user_agent": "Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)",
  "status": 200,
  "timestamp": "2025-01-10T10:00:00Z"
}
```

---

## Ingestion Methods

### 1. API Ingestion (Recommended)

**Endpoint**: `POST https://api.optiview.ai/v1/botlogs/ingest`  
**Auth**: Basic Auth (Username: `ops`, Password: Admin password)

#### Example: Upload JSON Array

```bash
curl -u ops:YOUR_ADMIN_PASSWORD \
  -X POST https://api.optiview.ai/v1/botlogs/ingest \
  -H "content-type: application/json" \
  -d '{
    "data": [
      {
        "domain": "cologuard.com",
        "path": "/",
        "user_agent": "GPTBot/1.0",
        "status": 200,
        "timestamp": "2025-01-10T10:00:00Z"
      },
      {
        "domain": "cologuard.com",
        "path": "/faq",
        "user_agent": "Claude-Web/1.0",
        "status": 200,
        "timestamp": "2025-01-11T09:17:00Z"
      }
    ]
  }'
```

#### Response

```json
{
  "ok": true,
  "accepted": 2,
  "rejected": 0,
  "reasons": {}
}
```

If logs are rejected, the `reasons` object will show why:
- `"missing UA"`: User-Agent not provided
- `"not ai bot"`: User-Agent doesn't match any known AI bot
- `"missing domain"`: Domain not provided

---

### 2. Parsing Common Log Formats

#### Cloudflare Logs (JSON Lines)

Cloudflare logs are already in JSON format. Extract relevant fields:

```bash
# Download Cloudflare logs via API or Logpush
# Filter for AI bots and convert to Optiview format

jq -c 'select(.ClientRequestUserAgent | test("gptbot|claudebot|perplexitybot"; "i")) | {
  domain: .ClientRequestHost,
  path: .ClientRequestPath,
  user_agent: .ClientRequestUserAgent,
  status: .EdgeResponseStatus,
  timestamp: .EdgeStartTimestamp,
  ip_hash: (.ClientIP | @sh "echo -n \(.) | sha256sum | cut -d\" \" -f1")
}' cloudflare-logs.json > optiview-ready.jsonl

# Upload to Optiview
curl -u ops:PASSWORD -X POST https://api.optiview.ai/v1/botlogs/ingest \
  -H "content-type: application/json" \
  -d "{\"data\": $(cat optiview-ready.jsonl | jq -s '.')}"
```

#### NGINX Access Logs

Parse NGINX combined format logs:

```bash
# Filter for AI bot user-agents
grep -iE 'gptbot|claudebot|perplexitybot|ccbot|google-extended' access.log | \
awk '{
  print "{\"domain\":\"example.com\",\"path\":\""$7"\",\"user_agent\":\""substr($0, index($0,$12))"\",\"status\":"$9",\"timestamp\":\""$4" "$5"\"}"
}' | jq -s '{data: .}' > payload.json

# Upload
curl -u ops:PASSWORD -X POST https://api.optiview.ai/v1/botlogs/ingest \
  -H "content-type: application/json" \
  -d @payload.json
```

#### Apache Access Logs

Similar to NGINX:

```bash
grep -iE 'gptbot|claudebot|perplexitybot' access_log | \
perl -lane 'print qq({"domain":"example.com","path":"$F[6]","user_agent":"$F[11..$#F]","status":$F[8],"timestamp":"$F[3]"})' | \
jq -s '{data: .}' > payload.json

# Upload
curl -u ops:PASSWORD -X POST https://api.optiview.ai/v1/botlogs/ingest \
  -H "content-type: application/json" \
  -d @payload.json
```

---

## Automation

### Daily Cron Job

Set up a daily cron job to automatically upload logs:

```bash
#!/bin/bash
# /etc/cron.daily/optiview-bot-logs

# Parse yesterday's logs
YESTERDAY=$(date -d "yesterday" +%Y-%m-%d)
LOG_FILE="/var/log/nginx/access.log"

grep -iE 'gptbot|claudebot|perplexitybot' "$LOG_FILE" | \
awk '{
  print "{\"domain\":\"example.com\",\"path\":\""$7"\",\"user_agent\":\""substr($0, index($0,$12))"\",\"status\":"$9",\"timestamp\":\""$4" "$5"\"}"
}' | jq -s '{data: .}' > /tmp/optiview-payload.json

# Upload to Optiview
curl -u ops:$OPTIVIEW_ADMIN_PASSWORD \
  -X POST https://api.optiview.ai/v1/botlogs/ingest \
  -H "content-type: application/json" \
  -d @/tmp/optiview-payload.json

rm /tmp/optiview-payload.json
```

Make it executable:

```bash
chmod +x /etc/cron.daily/optiview-bot-logs
```

---

## Viewing Crawler Data

### 1. API: Get Crawler Summary

**Endpoint**: `GET https://api.optiview.ai/v1/audits/:auditId/crawlers?days=30`

```bash
curl https://api.optiview.ai/v1/audits/aud_1760188075328_ks0crs9m6/crawlers?days=30
```

**Response:**

```json
{
  "ok": true,
  "summary": {
    "total": 123,
    "byBot": {
      "gptbot": 56,
      "claude-web": 11,
      "perplexitybot": 8
    },
    "lastSeen": {
      "gptbot": 1715345345000,
      "claude-web": 1715234567000
    }
  },
  "byPage": [
    {
      "path": "/",
      "hits": 17,
      "byBot": {
        "gptbot": 10,
        "claude-web": 7
      }
    },
    {
      "path": "/faq",
      "hits": 11,
      "byBot": {
        "gptbot": 6,
        "claude-web": 4,
        "perplexitybot": 1
      }
    }
  ]
}
```

### 2. UI: Audit Dashboard

Real crawler data appears in three places:

1. **Audit Header**: "AI Bot Traffic (30d): gptbot:56 • claude-web:11 • …"
2. **Pages Table**: "AI Hits" column shows per-page traffic
3. **Page Report**: "AI Crawlers (30d)" panel with detailed breakdown

---

## Privacy & Security

- **No Raw IPs**: Never send raw IP addresses. Use SHA-256 hashes if IP tracking is needed.
- **Admin-Only Upload**: Ingestion endpoints require admin credentials.
- **Public Read Access**: Crawler summaries are tied to audits (public once audit is complete).
- **Data Retention**: 30-90 days (configurable).

---

## Troubleshooting

### No Data Showing Up

1. **Check API Response**: Look for `rejected` count and `reasons` in the upload response.
2. **Verify User-Agent**: Make sure the UA matches one of the supported bot patterns.
3. **Check Domain**: Domain must match the property's domain in Optiview.
4. **Timestamp**: Use recent logs (within 30-90 days).

### Duplicate Hits

Optiview uses composite IDs (`domain:path:bot:timestamp`) to prevent duplicates. Re-uploading the same logs is safe.

### False Positives

If you see non-AI traffic in the logs, ensure your log parser is filtering correctly. Optiview rejects any UA that doesn't match known bot patterns.

---

## FAQs

**Q: How often should I upload logs?**  
A: Daily uploads are recommended. Real-time ingestion is not yet supported.

**Q: What happens if I don't upload logs?**  
A: Optiview will still show simulated probe results. Real logs add +2 to Crawlability score and provide per-page insights.

**Q: Can I upload logs for multiple domains?**  
A: Yes! The `domain` field in each log entry determines which property it's associated with.

**Q: Do I need to upload all traffic?**  
A: No, only AI bot traffic. Filter logs before uploading to reduce bandwidth and processing time.

**Q: Is there a rate limit?**  
A: The ingestion endpoint is admin-only and not publicly rate-limited. Batch uploads (10-10,000 entries) are recommended.

---

## Support

For questions or issues with log ingestion:

- **Email**: support@optiview.ai
- **Docs**: https://optiview.ai/docs
- **Status**: https://status.optiview.ai

---

**Last Updated**: January 11, 2025  
**Version**: Phase G v1.0

