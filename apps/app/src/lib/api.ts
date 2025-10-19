/**
 * API helper functions for making authenticated requests
 */

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.optiview.ai';

export async function apiGet<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const res = await fetch(url, { 
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function apiPost<T>(path: string, body?: any): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function apiDelete<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) throw new Error(`${res.status}`);
  if (res.status === 204) return {} as T;
  return res.json();
}

