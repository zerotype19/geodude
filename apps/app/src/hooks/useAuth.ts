/**
 * Auth hook for managing user session state
 */

import { useEffect, useState, useCallback } from 'react';
import { apiGet, apiPost } from '../lib/api';

export type AuthSession = {
  ok: true;
  email: string;
  userId: string;
  isAdmin: boolean;
  session: {
    createdAt: string;
    lastSeenAt: string;
    authAgeAt: string;
  };
};

export interface UseAuthOptions {
  skip?: boolean; // Skip auth check (for public pages)
}

export function useAuth(options?: UseAuthOptions) {
  const { skip = false } = options || {};
  const [me, setMe] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(skip ? false : true);
  const [error, setError] = useState<string | null>(null);

  const fetchMe = useCallback(async () => {
    try {
      const data = await apiGet<AuthSession>('/v1/auth/me');
      setMe(data);
      setError(null);
    } catch (err) {
      setMe(null);
      setError(err instanceof Error ? err.message : 'Auth check failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiPost('/v1/auth/logout');
      setMe(null);
      // Hard reload to clear any cached state
      window.location.href = '/';
    } catch (err) {
      console.error('Logout failed:', err);
    }
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    // Skip auth check for public pages
    if (skip) {
      return;
    }

    let cancelled = false;
    
    (async () => {
      try {
        const data = await apiGet<AuthSession>('/v1/auth/me');
        if (!cancelled) {
          setMe(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setMe(null);
          setError(err instanceof Error ? err.message : 'Auth check failed');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [skip]);

  return {
    me,
    loading,
    error,
    isAuthed: !!me,
    logout,
    refresh
  };
}

