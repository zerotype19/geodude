/**
 * Preferences management for Optiview
 */

const PREF_PREFIX = 'ov:';

/**
 * Get the "Include AI training crawlers" preference for a project
 * @param projectId - The project ID
 * @returns true if AI training crawlers should be included in AI totals
 */
export function getIncludeTraining(projectId: string): boolean {
    if (typeof window === 'undefined') return false;

    const key = `${PREF_PREFIX}include_training_bots:${projectId}`;
    const value = localStorage.getItem(key);

    // Default to false (AI training crawlers not included)
    return value === '1';
}

/**
 * Set the "Include AI training crawlers" preference for a project
 * @param projectId - The project ID
 * @param include - Whether to include AI training crawlers in AI totals
 */
export function setIncludeTraining(projectId: string, include: boolean): void {
    if (typeof window === 'undefined') return;

    const key = `${PREF_PREFIX}include_training_bots:${projectId}`;
    localStorage.setItem(key, include ? '1' : '0');
}

/**
 * Get the "Include AI training crawlers" preference from URL params
 * @param searchParams - URL search parameters
 * @returns true if include_training=1 is in the URL
 */
export function getIncludeTrainingFromURL(searchParams: URLSearchParams): boolean {
    return searchParams.get('include_training') === '1';
}

/**
 * Update localStorage when URL param is present
 * @param projectId - The project ID
 * @param searchParams - URL search parameters
 */
export function syncIncludeTrainingFromURL(projectId: string, searchParams: URLSearchParams): void {
    const includeFromURL = getIncludeTrainingFromURL(searchParams);
    if (includeFromURL) {
        setIncludeTraining(projectId, true);
    }
}

/**
 * Get time range preference for a project
 * @param projectId - The project ID
 * @returns The preferred time range (15m, 24h, 7d)
 */
export function getTimeRange(projectId: string): string {
    if (typeof window === 'undefined') return '24h';

    const key = `${PREF_PREFIX}time_range:${projectId}`;
    return localStorage.getItem(key) || '24h';
}

/**
 * Set the time range preference for a project
 * @param projectId - The project ID
 * @param timeRange - The time range (15m, 24h, 7d)
 */
export function setTimeRange(projectId: string, timeRange: string): void {
    if (typeof window === 'undefined') return;

    const key = `${PREF_PREFIX}time_range:${projectId}`;
    localStorage.setItem(key, timeRange);
}

/**
 * Get referrals tab preference for a project
 * @param projectId - The project ID
 * @returns The preferred referrals tab (assistants, search, crawlers)
 */
export function getReferralsTab(projectId: string): 'assistants' | 'search' | 'crawlers' {
    if (typeof window === 'undefined') return 'assistants';

    const key = `${PREF_PREFIX}referrals_tab:${projectId}`;
    const savedTab = localStorage.getItem(key);
    
    // Ensure we return a valid tab type
    if (savedTab && ['assistants', 'search', 'crawlers'].includes(savedTab)) {
        return savedTab as 'assistants' | 'search' | 'crawlers';
    }
    
    return 'assistants'; // Default fallback
}

/**
 * Set the referrals tab preference for a project
 * @param projectId - The project ID
 * @param tab - The preferred tab (assistants, search, crawlers)
 */
export function setReferralsTab(projectId: string, tab: 'assistants' | 'search' | 'crawlers'): void {
    if (typeof window === 'undefined') return;

    const key = `${PREF_PREFIX}referrals_tab:${projectId}`;
    localStorage.setItem(key, tab);
}
