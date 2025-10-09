/**
 * Onboarding API - Self-service project and property creation
 */

interface Env {
  DB: D1Database;
}

// Generate unique IDs
function generateId(prefix: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);
  return `${prefix}_${timestamp}_${random}`;
}

// Generate API key
function generateApiKey(): string {
  const random = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `prj_live_${random}`;
}

// Generate verification token
function generateVerifyToken(propertyId: string): string {
  return `ov-verify-${propertyId.split('_').pop()}`;
}

export async function createProject(
  env: Env,
  name: string,
  owner_email?: string
): Promise<{ id: string; name: string; api_key: string; created_at: number }> {
  const id = generateId('prj');
  const api_key = generateApiKey();
  const created_at = Math.floor(Date.now() / 1000);

  await env.DB.prepare(
    `INSERT INTO projects (id, name, api_key, owner_email, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id, name, api_key, owner_email || null, created_at, created_at).run();

  return { id, name, api_key, created_at };
}

export async function createProperty(
  env: Env,
  project_id: string,
  domain: string
): Promise<{
  id: string;
  domain: string;
  verified: boolean;
  verification: {
    token: string;
    dns: { record: string; name: string; value: string };
    html: { path: string; content: string };
  };
}> {
  // Validate domain format
  const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
  if (!domainRegex.test(domain)) {
    throw new Error('Invalid domain format');
  }

  // Check if domain already exists
  const existing = await env.DB.prepare(
    'SELECT id FROM properties WHERE domain = ?'
  ).bind(domain).first();

  if (existing) {
    throw new Error('Domain already exists');
  }

  const id = generateId('prop');
  const verify_token = generateVerifyToken(id);
  const created_at = Math.floor(Date.now() / 1000);

  await env.DB.prepare(
    `INSERT INTO properties (id, project_id, domain, verified, verify_token, verify_method, created_at, updated_at)
     VALUES (?, ?, ?, 0, ?, NULL, ?, ?)`
  ).bind(id, project_id, domain, verify_token, created_at, created_at).run();

  return {
    id,
    domain,
    verified: false,
    verification: {
      token: verify_token,
      dns: {
        record: 'TXT',
        name: `_optiview.${domain}`,
        value: verify_token,
      },
      html: {
        path: `/.well-known/optiview-verify.txt`,
        content: verify_token,
      },
    },
  };
}

export async function verifyProperty(
  env: Env,
  property_id: string,
  method: 'dns' | 'html'
): Promise<{ verified: boolean; error?: string }> {
  // Get property details
  const property = await env.DB.prepare(
    'SELECT domain, verify_token, verified FROM properties WHERE id = ?'
  ).bind(property_id).first<{ domain: string; verify_token: string; verified: number }>();

  if (!property) {
    throw new Error('Property not found');
  }

  if (property.verified === 1) {
    return { verified: true };
  }

  const { domain, verify_token } = property;

  if (method === 'dns') {
    // Verify DNS TXT record using Cloudflare DNS over HTTPS
    try {
      const dnsQuery = `https://1.1.1.1/dns-query?name=_optiview.${domain}&type=TXT`;
      const response = await fetch(dnsQuery, {
        headers: { 'Accept': 'application/dns-json' },
      });

      if (!response.ok) {
        return { verified: false, error: 'DNS query failed' };
      }

      const data: any = await response.json();
      const txtRecords = data.Answer?.filter((a: any) => a.type === 16) || [];

      // Check if any TXT record matches our token
      const found = txtRecords.some((record: any) => {
        const value = record.data.replace(/"/g, '');
        return value === verify_token;
      });

      if (found) {
        // Update property as verified
        await env.DB.prepare(
          `UPDATE properties 
           SET verified = 1, verify_method = 'dns', updated_at = ?
           WHERE id = ?`
        ).bind(Math.floor(Date.now() / 1000), property_id).run();

        return { verified: true };
      }

      return {
        verified: false,
        error: `DNS TXT record not found. Please add: _optiview.${domain} TXT ${verify_token}`,
      };
    } catch (error) {
      return { verified: false, error: 'DNS verification failed' };
    }
  } else if (method === 'html') {
    // Verify HTML file
    try {
      const fileUrl = `https://${domain}/.well-known/optiview-verify.txt`;
      const response = await fetch(fileUrl);

      if (!response.ok) {
        return {
          verified: false,
          error: `File not found. Please upload to: ${fileUrl} with content: ${verify_token}`,
        };
      }

      const content = await response.text();
      const trimmed = content.trim();

      if (trimmed === verify_token) {
        // Update property as verified
        await env.DB.prepare(
          `UPDATE properties 
           SET verified = 1, verify_method = 'html', updated_at = ?
           WHERE id = ?`
        ).bind(Math.floor(Date.now() / 1000), property_id).run();

        return { verified: true };
      }

      return {
        verified: false,
        error: `File content mismatch. Expected: ${verify_token}`,
      };
    } catch (error) {
      return { verified: false, error: 'HTML file verification failed' };
    }
  }

  return { verified: false, error: 'Invalid verification method' };
}

