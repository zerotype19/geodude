# Magic Link & Onboarding Flow

## Overview
This document describes the complete magic link authentication and onboarding flow implemented in the Optiview API.

## Flow Components

### 1. Magic Link Authentication

#### Request Magic Link
- **Endpoint**: `POST /auth/request-code`
- **Body**: `{ "email": "user@example.com", "continue_path": "/onboarding" }`
- **Rate Limits**: 10 per minute per IP, 50 per day per email
- **Expiration**: 15 minutes (configurable via `MAGIC_LINK_EXP_MIN`)

#### Consume Magic Link
- **Endpoint**: `GET /auth/magic?token=<token>`
- **Action**: Validates token, creates session, redirects to `/onboarding`
- **Session**: Creates `optiview_session` cookie with 24-hour expiration

### 2. Onboarding Wizard API Endpoints

#### Create Organization
- **Endpoint**: `POST /api/onboarding/organization`
- **Body**: `{ "name": "Optiview Internal" }`
- **Creates**: Organization, User (if doesn't exist), Org Member (admin role)

#### Create Project
- **Endpoint**: `POST /api/onboarding/project`
- **Body**: `{ "name": "Marketing Website", "org_id": "org_..." }`
- **Creates**: Project with slug, default project settings

#### Create Property
- **Endpoint**: `POST /api/onboarding/property`
- **Body**: `{ "domain": "example.com", "project_id": "prj_..." }`
- **Creates**: Property record for the domain

#### Create API Key
- **Endpoint**: `POST /api/onboarding/api-key`
- **Body**: `{ "name": "Production site", "project_id": "prj_...", "property_id": "prop_..." }`
- **Returns**: `key_id` and `secret_once` (shown only once)

### 3. JS Tag Installation

#### Tag Endpoint
- **URL**: `GET /v1/tag.js?pid=<PROPERTY_ID>&kid=<KEY_ID>`
- **Returns**: JavaScript code that tracks page views
- **Features**: 
  - Automatic page view tracking
  - Referrer detection
  - User agent capture
  - Silent fail for analytics

#### Tag Code Example
```html
<script async src="https://api.optiview.ai/v1/tag.js?pid=prop_123&kid=key_456"></script>
```

### 4. Event Collection

#### Events Endpoint
- **Endpoint**: `POST /api/events`
- **Headers**: 
  - `x-optiview-key-id`: API key ID
  - `x-optiview-timestamp`: Unix timestamp
- **Body**: Event data with metadata
- **Validation**: API key validation, required fields check

#### Last-Seen Endpoint
- **Endpoint**: `GET /api/events/last-seen?property_id=<PROPERTY_ID>`
- **Returns**: Event counts in last 15 minutes, last event timestamp
- **Purpose**: Verify installation is working

## Database Schema

### New Tables
- **`property`**: Domain properties for projects
- **`api_key`**: API keys with org_id for multi-tenancy

### Updated Tables
- **`edge_click_event`**: Added property_id column
- **`api_key`**: Added org_id column

## Environment Variables

### Required for Production
- `PUBLIC_APP_URL`: App domain (e.g., https://app.optiview.ai)
- `PUBLIC_BASE_URL`: API domain (e.g., https://api.optiview.ai)
- `MAGIC_LINK_EXP_MIN`: Magic link expiration (default: 15)
- `MAGIC_LINK_RPM_PER_IP`: Rate limit per IP (default: 10)
- `MAGIC_LINK_RPD_PER_EMAIL`: Rate limit per email (default: 50)

## Security Features

- **Token Hashing**: All tokens are hashed before storage
- **Rate Limiting**: Per-IP and per-email limits
- **Session Management**: Secure HTTP-only cookies
- **Input Validation**: Path sanitization, required field validation
- **API Key Validation**: Hash-based key verification

## Usage Flow

1. **User requests magic link** → `POST /auth/request-code`
2. **User clicks email link** → `GET /auth/magic?token=...`
3. **Redirected to onboarding** → `/onboarding`
4. **Create organization** → `POST /api/onboarding/organization`
5. **Create project** → `POST /api/onboarding/project`
6. **Add property** → `POST /api/onboarding/property`
7. **Create API key** → `POST /api/onboarding/api-key`
8. **Install JS tag** → Add script to website
9. **Verify installation** → Check `/api/events/last-seen`

## Testing

### Development Mode
- Magic links logged to console
- No real email sending
- `TEST_MODE=1` enables test endpoints

### Production Mode
- Real email sending (SMTP required)
- No test endpoints
- Proper rate limiting and security

## Next Steps

1. **Email Service**: Implement real SMTP email sending
2. **Traffic Classification**: Add AI traffic detection logic
3. **Dashboard**: Build frontend onboarding wizard
4. **Analytics**: Implement event aggregation and reporting
5. **Team Management**: Complete invite/accept flow
