const API_BASE = (import.meta.env.VITE_API_BASE as string) || "https://api.optiview.ai";

export type AuditIssue = { 
  category: string; 
  severity: string; 
  code: string; 
  message: string; 
  url?: string 
};

export type AuditPage = { 
  url: string; 
  http_status?: number; 
  title?: string; 
  jsonld_types?: string; 
  has_faq?: number 
};

export type Scores = { 
  total: number; 
  crawlability: number; 
  structured: number; 
  answerability: number; 
  trust: number 
};

export type EntityRecommendations = {
  sameAs_missing: boolean;
  suggestions: string[];
  jsonld_snippet: string;
};

export type Citation = {
  engine: string;
  query: string;
  url: string;
  title: string | null;
  cited_at: number;
};

export type Audit = { 
  id: string; 
  property_id: string; 
  domain: string; 
  scores: Scores; 
  issues: AuditIssue[]; 
  pages: AuditPage[]; 
  started_at: number; 
  finished_at?: number;
  entity_recommendations?: EntityRecommendations;
  citations?: Citation[];
};

export async function startAudit(property_id: string, apiKey: string): Promise<{ id: string }> {
  const res = await fetch(`${API_BASE}/v1/audits/start`, {
    method: "POST",
    headers: { 
      "content-type": "application/json", 
      "x-api-key": apiKey 
    },
    body: JSON.stringify({ property_id })
  });
  
  if (!res.ok) throw new Error(`startAudit failed ${res.status}`);
  return res.json();
}

export async function getAudit(id: string): Promise<Audit> {
  const res = await fetch(`${API_BASE}/v1/audits/${id}`);
  if (!res.ok) throw new Error(`getAudit failed ${res.status}`);
  return res.json();
}

// v0.13 Onboarding API
export type ProjectCreate = { name: string; owner_email: string };
export type Project = { 
  id: string; 
  api_key: string; 
  name: string; 
  owner_email?: string;
  created_at: number;
};

export type PropertyCreate = { project_id: string; domain: string };
export type Property = {
  id: string;
  domain: string;
  verified: boolean;
  verification: {
    token: string;
    dns: { record: "TXT"; name: string; value: string };
    html: { path: string; content: string };
  };
};

export async function createProject(input: ProjectCreate): Promise<Project> {
  const res = await fetch(`${API_BASE}/v1/projects`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!res.ok) throw new Error(`createProject ${res.status}`);
  return res.json();
}

export async function createProperty(input: PropertyCreate, apiKey: string): Promise<Property> {
  const res = await fetch(`${API_BASE}/v1/properties`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify(input)
  });
  if (!res.ok) throw new Error(`createProperty ${res.status}`);
  return res.json();
}

export async function verifyProperty(propertyId: string, method: "dns" | "html", apiKey: string) {
  const res = await fetch(`${API_BASE}/v1/properties/${propertyId}/verify`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({ method })
  });
  if (!res.ok) throw new Error(`verifyProperty ${res.status}`);
  return res.json(); // { verified: boolean, error?: string }
}

