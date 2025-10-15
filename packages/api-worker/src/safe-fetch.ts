/**
 * Safe Fetch Wrapper
 * Provides timeouts, retries, and structured error handling for all external HTTP calls
 */

export interface SafeFetchOptions {
  timeoutMs?: number;
  retries?: number;
  backoffBaseMs?: number;
  headers?: Record<string, string>;
  method?: string;
  body?: string;
  signal?: AbortSignal;
}

export interface SafeFetchResult<T = any> {
  ok: boolean;
  status?: number;
  data?: T;
  error?: {
    code: string;
    message: string;
    retryCount: number;
    url: string;
  };
}

/**
 * Safe fetch with timeout, retries, and structured error handling
 */
export async function safeFetch<T = any>(
  url: string,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResult<T>> {
  const {
    timeoutMs = 12000, // 12s default timeout
    retries = 2,
    backoffBaseMs = 1000,
    headers = {},
    method = 'GET',
    body,
    signal
  } = options;

  let lastError: Error | null = null;
  let retryCount = 0;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Combine user signal with our timeout signal
    const combinedSignal = signal ? 
      AbortSignal.any ? AbortSignal.any([signal, controller.signal]) : controller.signal :
      controller.signal;

    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: combinedSignal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        let data: T;
        const contentType = response.headers.get('content-type');
        
        if (contentType?.includes('application/json')) {
          data = await response.json();
        } else {
          data = await response.text() as T;
        }

        return {
          ok: true,
          status: response.status,
          data,
        };
      }

      // Handle HTTP errors
      const errorCode = response.status >= 500 ? 'FETCH_5XX' : 
                       response.status === 429 ? 'FETCH_RATE_LIMITED' : 
                       'FETCH_4XX';
      
      const errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      
      // Don't retry on 4xx errors (except 429)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return {
          ok: false,
          status: response.status,
          error: {
            code: errorCode,
            message: errorMessage,
            retryCount: attempt,
            url,
          },
        };
      }

      // Retry on 5xx and 429
      lastError = new Error(errorMessage);
      lastError.name = errorCode;

    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        lastError = new Error(`Timeout after ${timeoutMs}ms`);
        lastError.name = 'FETCH_TIMEOUT';
      } else if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
        lastError = new Error(`Connection timeout: ${error.message}`);
        lastError.name = 'FETCH_TIMEOUT';
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        lastError = new Error(`Connection failed: ${error.message}`);
        lastError.name = 'FETCH_CONNECTION_ERROR';
      } else {
        lastError = error;
        lastError.name = 'FETCH_ERROR';
      }

      // Don't retry on connection errors
      if (error.name === 'FETCH_CONNECTION_ERROR' || error.code === 'ENOTFOUND') {
        break;
      }
    }

    retryCount = attempt;
    
    // Exponential backoff with jitter (only if we have more retries)
    if (attempt < retries) {
      const delay = backoffBaseMs * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return {
    ok: false,
    error: {
      code: lastError?.name || 'FETCH_UNKNOWN_ERROR',
      message: lastError?.message || 'Unknown fetch error',
      retryCount,
      url,
    },
  };
}

/**
 * Convenience wrapper for JSON requests
 */
export async function safeFetchJson<T = any>(
  url: string,
  options: Omit<SafeFetchOptions, 'body'> & { body?: any } = {}
): Promise<SafeFetchResult<T>> {
  const { body, ...restOptions } = options;
  
  return safeFetch<T>(url, {
    ...restOptions,
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...restOptions.headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Test if an error should trigger a circuit breaker
 */
export function shouldOpenCircuitBreaker(error: SafeFetchResult['error']): boolean {
  if (!error) return false;
  
  return [
    'FETCH_TIMEOUT',
    'FETCH_5XX',
    'FETCH_CONNECTION_ERROR',
  ].includes(error.code);
}
