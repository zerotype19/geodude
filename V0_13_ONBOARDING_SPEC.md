# v0.13 - Multi-Project Onboarding Specification

**Goal**: Let users add domains and run audits without touching SQL  
**Timeline**: 2 days  
**Priority**: High (blocker for beta)

---

## 🎯 OBJECTIVES

1. Users can create projects from the dashboard
2. Users can add properties (domains) to projects
3. Verification via DNS TXT or HTML file
4. Auto-generate API keys
5. No SQL commands required

---

## 📊 DATABASE CHANGES

### **New Table: `verifications`**
```sql
CREATE TABLE IF NOT EXISTS verifications (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  method TEXT NOT NULL,  -- 'dns' | 'html'
  token TEXT NOT NULL,
  verified INTEGER DEFAULT 0,
  verified_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (property_id) REFERENCES properties(id)
);

CREATE INDEX IF NOT EXISTS idx_verifications_property ON verifications(property_id);
CREATE INDEX IF NOT EXISTS idx_verifications_token ON verifications(token);
```

### **Update: `projects` table**
```sql
-- Add owner_email column (for v0.15 emails)
ALTER TABLE projects ADD COLUMN owner_email TEXT;
```

### **Update: `properties` table**
```sql
-- Add verified column
ALTER TABLE properties ADD COLUMN verified INTEGER DEFAULT 0;
ALTER TABLE properties ADD COLUMN verified_at INTEGER;
```

---

## 🔌 API ENDPOINTS

### **1. POST /v1/projects**
**Purpose**: Create a new project

**Request**:
```json
{
  "name": "My Company",
  "owner_email": "user@example.com"
}
```

**Response**:
```json
{
  "id": "prj_...",
  "name": "My Company",
  "api_key": "prj_live_...",
  "created_at": 1234567890
}
```

**Logic**:
- Generate `id` as `prj_${timestamp}_${random}`
- Generate `api_key` as `prj_live_${hex(16)}`
- Insert into `projects` table
- Return project + API key

### **2. POST /v1/properties**
**Purpose**: Add a domain to a project

**Auth**: Requires `x-api-key` header

**Request**:
```json
{
  "project_id": "prj_...",
  "domain": "example.com"
}
```

**Response**:
```json
{
  "id": "prop_...",
  "domain": "example.com",
  "verified": false,
  "verification": {
    "token": "ov-verify-...",
    "dns": {
      "record": "TXT",
      "name": "_optiview",
      "value": "ov-verify-abc123def456"
    },
    "html": {
      "path": "/.well-known/optiview-verify.txt",
      "content": "ov-verify-abc123def456"
    }
  }
}
```

**Logic**:
- Validate domain format
- Check if domain already exists
- Generate `id` as `prop_${timestamp}_${random}`
- Generate verification token: `ov-verify-${hex(12)}`
- Insert into `properties` (verified=0)
- Insert into `verifications` (method='pending')
- Return property + verification instructions

### **3. POST /v1/properties/:id/verify**
**Purpose**: Verify domain ownership

**Auth**: Requires `x-api-key` header

**Request**:
```json
{
  "method": "dns"  // or "html"
}
```

**Response** (Success):
```json
{
  "verified": true,
  "verified_at": 1234567890,
  "method": "dns"
}
```

**Response** (Failure):
```json
{
  "verified": false,
  "error": "DNS TXT record not found",
  "instructions": {
    "record": "TXT",
    "name": "_optiview.example.com",
    "value": "ov-verify-abc123def456"
  }
}
```

**Logic - DNS Verification**:
1. Fetch verification token from `verifications` table
2. Query DNS TXT records for `_optiview.{domain}`
3. Check if any record matches `ov-verify-{token}`
4. If match:
   - Update `properties.verified = 1, verified_at = now()`
   - Update `verifications.verified = 1, verified_at = now()`
   - Return success
5. If no match: Return failure with instructions

**Logic - HTML Verification**:
1. Fetch verification token from `verifications` table
2. HTTP GET `https://{domain}/.well-known/optiview-verify.txt`
3. Check if response body contains `ov-verify-{token}`
4. If match: Same as DNS (update tables, return success)
5. If no match: Return failure with instructions

### **4. GET /v1/properties/:id**
**Purpose**: Get property details

**Auth**: Requires `x-api-key` header

**Response**:
```json
{
  "id": "prop_...",
  "domain": "example.com",
  "verified": true,
  "verified_at": 1234567890,
  "created_at": 1234567890,
  "audits_count": 3
}
```

---

## 🎨 DASHBOARD UI CHANGES

### **New Route: `/onboarding`**

**Step 1: Create Project**
```tsx
<OnboardingWizard step={1}>
  <h2>Create Your Project</h2>
  <input placeholder="Company Name" value={name} />
  <input placeholder="Email" value={email} type="email" />
  <button onClick={createProject}>Create Project</button>
</OnboardingWizard>
```

**Step 2: Add Domain**
```tsx
<OnboardingWizard step={2}>
  <h2>Add Your Domain</h2>
  <input placeholder="example.com" value={domain} />
  <button onClick={addProperty}>Add Domain</button>
</OnboardingWizard>
```

**Step 3: Verify Ownership**
```tsx
<OnboardingWizard step={3}>
  <h2>Verify Domain Ownership</h2>
  <Tabs>
    <Tab label="DNS (Recommended)">
      <code>
        Record: TXT
        Name: _optiview.{domain}
        Value: {token}
      </code>
      <button onClick={() => verify('dns')}>Verify DNS</button>
    </Tab>
    <Tab label="HTML File">
      <code>
        Upload to: https://{domain}/.well-known/optiview-verify.txt
        Content: {token}
      </code>
      <button onClick={() => verify('html')}>Verify HTML</button>
    </Tab>
  </Tabs>
  {verified && (
    <div className="success">
      ✅ Domain verified! You can now run audits.
      <button onClick={() => navigate('/dashboard')}>Run First Audit</button>
    </div>
  )}
</OnboardingWizard>
```

### **Update: Dashboard Route**
```tsx
// apps/app/src/routes/Dashboard.tsx
// Change property_id input to dropdown of user's properties
<select value={propertyId} onChange={e => setPropertyId(e.target.value)}>
  {properties.map(p => (
    <option key={p.id} value={p.id}>{p.domain}</option>
  ))}
</select>
<button onClick={() => navigate('/onboarding')}>+ Add Domain</button>
```

---

## 🔧 IMPLEMENTATION STEPS

### **Phase 1: Database (30 min)**
1. Create migration `db/migrations/0004_onboarding.sql`
2. Add `verifications` table
3. Add `owner_email` to `projects`
4. Add `verified`, `verified_at` to `properties`
5. Apply migration to local and remote

### **Phase 2: API (2-3 hours)**
1. Create `packages/api-worker/src/onboarding.ts`
2. Implement `createProject()`
3. Implement `createProperty()`
4. Implement `verifyDNS()` using Cloudflare DNS over HTTPS
5. Implement `verifyHTML()` using fetch
6. Add routes to `index.ts`:
   - `POST /v1/projects`
   - `POST /v1/properties`
   - `POST /v1/properties/:id/verify`
   - `GET /v1/properties/:id`
7. Test with `curl`

### **Phase 3: UI (3-4 hours)**
1. Create `apps/app/src/routes/Onboarding.tsx`
2. Create `apps/app/src/components/OnboardingWizard.tsx`
3. Add state management for wizard steps
4. Implement "Create Project" step
5. Implement "Add Domain" step
6. Implement "Verify Ownership" step (DNS + HTML tabs)
7. Update `Dashboard.tsx` to load user properties
8. Add "+ Add Domain" button

### **Phase 4: Testing (1 hour)**
1. Create test project via UI
2. Add test domain via UI
3. Verify via DNS TXT (create record in Cloudflare)
4. Verify via HTML file (upload to test server)
5. Run audit on verified domain
6. Test with unverified domain (should fail)

---

## 🧪 ACCEPTANCE CRITERIA

- [ ] User can create project from dashboard (no SQL)
- [ ] User can add domain to project
- [ ] User receives verification instructions (DNS + HTML)
- [ ] DNS TXT verification works
- [ ] HTML file verification works
- [ ] Unverified domains cannot run audits
- [ ] API key auto-generated and saved to localStorage
- [ ] Dashboard shows list of user's domains
- [ ] "+ Add Domain" button launches wizard
- [ ] All endpoints have proper auth checks
- [ ] Rate limiting still applies

---

## 🚀 DEPLOYMENT PLAN

1. **Database**: Apply migration to production D1
2. **API**: Deploy updated worker
3. **Dashboard**: Build and deploy to Pages
4. **Test**: Run through full onboarding flow
5. **Announce**: Internal Slack + docs update

---

## 📝 CURSOR PROMPTS

### **Prompt A: Database Migration**
```
Create db/migrations/0004_onboarding.sql with:
- CREATE TABLE verifications (id, property_id, method, token, verified, verified_at, created_at)
- ALTER TABLE projects ADD COLUMN owner_email TEXT
- ALTER TABLE properties ADD COLUMN verified INTEGER DEFAULT 0
- ALTER TABLE properties ADD COLUMN verified_at INTEGER

Apply to local and remote D1.
```

### **Prompt B: API Endpoints**
```
In packages/api-worker/src/onboarding.ts, implement:
- createProject(name, owner_email) -> {id, name, api_key, created_at}
- createProperty(project_id, domain) -> {id, domain, verification}
- verifyDNS(property_id) using Cloudflare DNS over HTTPS (query _optiview.{domain} TXT)
- verifyHTML(property_id) using fetch (GET /.well-known/optiview-verify.txt)

Add routes to index.ts:
- POST /v1/projects (no auth)
- POST /v1/properties (requires x-api-key)
- POST /v1/properties/:id/verify (requires x-api-key)
- GET /v1/properties/:id (requires x-api-key)

Include rate limiting on project creation (max 3/day per IP).
```

### **Prompt C: Dashboard Wizard**
```
Create apps/app/src/routes/Onboarding.tsx with a 3-step wizard:
1. Create Project (name, email)
2. Add Domain (domain input)
3. Verify Ownership (DNS TXT or HTML file tabs, show instructions, verify button)

Use state management for wizard flow. On completion, navigate to /dashboard.
Update Dashboard.tsx to load user properties from GET /v1/properties and show dropdown.
Add "+ Add Domain" button that navigates to /onboarding.
```

---

## 🎯 SUCCESS METRICS

- 🎯 3+ users complete onboarding without help
- 🎯 2+ users verify via DNS
- 🎯 1+ user verifies via HTML
- 🎯 5+ self-service audits run
- 🎯 Zero support tickets about "how to add domain"

---

**Status**: Ready to implement  
**Estimated Time**: 6-8 hours  
**Complexity**: Medium  
**Dependencies**: None (all infrastructure ready)

