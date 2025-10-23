import { useState, useEffect } from 'react';
import { apiGet } from '../lib/api';

interface CitedUrl {
  first_match_url: string;
  citation_count: number;
  last_seen: string;
}

interface CitationSummary {
  topCitedUrls: CitedUrl[];
}

/**
 * Hook to fetch cited pages for an audit
 * Returns a Map of URL -> citation count for easy lookup
 */
export function useCitedPages(auditId: string | undefined) {
  const [citedPages, setCitedPages] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auditId) {
      setLoading(false);
      return;
    }

    const fetchCitedPages = async () => {
      try {
        const data = await apiGet<CitationSummary>(`/api/citations/summary?audit_id=${auditId}`);
        
        // Build a map of URL -> citation count for fast lookup
        const citedMap = new Map<string, number>();
        
        if (data.topCitedUrls) {
          for (const cited of data.topCitedUrls) {
            if (cited.first_match_url) {
              // Normalize URL by removing trailing punctuation and trailing slash
              const normalizedUrl = cited.first_match_url
                .replace(/[),;.!?]+$/, '')
                .replace(/\/$/, '');
              
              citedMap.set(normalizedUrl, cited.citation_count);
              // Also set with trailing slash for flexibility
              citedMap.set(normalizedUrl + '/', cited.citation_count);
            }
          }
        }
        
        setCitedPages(citedMap);
      } catch (error) {
        console.error('Failed to fetch cited pages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCitedPages();
  }, [auditId]);

  const getCitationCount = (url: string): number => {
    const normalizedUrl = url.replace(/\/$/, '');
    return citedPages.get(normalizedUrl) || citedPages.get(normalizedUrl + '/') || 0;
  };

  const isCited = (url: string): boolean => {
    return getCitationCount(url) > 0;
  };

  return {
    citedPages,
    loading,
    getCitationCount,
    isCited
  };
}

