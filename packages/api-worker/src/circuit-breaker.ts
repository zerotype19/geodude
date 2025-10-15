/**
 * Circuit Breaker for Connector Health
 * Prevents cascading failures by temporarily disabling flapping connectors
 */

interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeoutMs: number;
  monitoringWindowMs: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3, // Open circuit after 3 failures
  recoveryTimeoutMs: 15 * 60 * 1000, // 15 minutes
  monitoringWindowMs: 10 * 60 * 1000, // 10 minutes
};

/**
 * Check if a connector circuit is open
 */
export async function isCircuitOpen(
  connectorName: string, 
  env: any
): Promise<boolean> {
  try {
    const key = `connector:${connectorName}:open`;
    const result = await env.RATE_LIMIT_KV.get(key);
    return result === 'true';
  } catch (error) {
    console.error(`[CircuitBreaker] Failed to check circuit for ${connectorName}:`, error);
    return false; // Fail open - allow requests if we can't check
  }
}

/**
 * Record a connector failure and potentially open the circuit
 */
export async function recordConnectorFailure(
  connectorName: string,
  error: Error,
  env: any,
  config: CircuitBreakerConfig = DEFAULT_CONFIG
): Promise<void> {
  try {
    const now = Date.now();
    const key = `connector:${connectorName}:failures`;
    
    // Get existing failures
    const failuresData = await env.RATE_LIMIT_KV.get(key);
    let failures: Array<{ timestamp: number; error: string }> = [];
    
    if (failuresData) {
      try {
        failures = JSON.parse(failuresData);
      } catch (e) {
        failures = [];
      }
    }
    
    // Add new failure
    failures.push({
      timestamp: now,
      error: error.message || error.name || 'Unknown error'
    });
    
    // Filter to monitoring window
    const cutoff = now - config.monitoringWindowMs;
    failures = failures.filter(f => f.timestamp > cutoff);
    
    // Save updated failures
    await env.RATE_LIMIT_KV.put(key, JSON.stringify(failures), {
      expirationTtl: Math.ceil(config.monitoringWindowMs / 1000)
    });
    
    // Check if we should open the circuit
    if (failures.length >= config.failureThreshold) {
      await openCircuit(connectorName, env, config);
      console.error(`[CircuitBreaker] Opened circuit for ${connectorName} after ${failures.length} failures in ${config.monitoringWindowMs / 1000}s`);
    }
    
  } catch (error) {
    console.error(`[CircuitBreaker] Failed to record failure for ${connectorName}:`, error);
  }
}

/**
 * Open the circuit for a connector
 */
async function openCircuit(
  connectorName: string,
  env: any,
  config: CircuitBreakerConfig
): Promise<void> {
  try {
    const key = `connector:${connectorName}:open`;
    await env.RATE_LIMIT_KV.put(key, 'true', {
      expirationTtl: Math.ceil(config.recoveryTimeoutMs / 1000)
    });
    
    console.log(`[CircuitBreaker] Circuit opened for ${connectorName} for ${config.recoveryTimeoutMs / 1000}s`);
  } catch (error) {
    console.error(`[CircuitBreaker] Failed to open circuit for ${connectorName}:`, error);
  }
}

/**
 * Record a connector success (for future half-open logic)
 */
export async function recordConnectorSuccess(
  connectorName: string,
  env: any
): Promise<void> {
  try {
    // For now, we just log success. In a full implementation,
    // we could implement half-open state logic here.
    console.log(`[CircuitBreaker] Connector ${connectorName} succeeded`);
  } catch (error) {
    console.error(`[CircuitBreaker] Failed to record success for ${connectorName}:`, error);
  }
}

/**
 * Get circuit breaker status for all connectors
 */
export async function getCircuitStatus(env: any): Promise<Record<string, {
  open: boolean;
  failures: number;
  lastFailure?: string;
}>> {
  const connectors = ['brave', 'perplexity', 'claude', 'chatgpt', 'browser'];
  const status: Record<string, any> = {};
  
  for (const connector of connectors) {
    try {
      const isOpen = await isCircuitOpen(connector, env);
      
      // Get recent failures
      const failuresKey = `connector:${connector}:failures`;
      const failuresData = await env.RATE_LIMIT_KV.get(failuresKey);
      let failures = 0;
      let lastFailure: string | undefined;
      
      if (failuresData) {
        try {
          const failuresList = JSON.parse(failuresData);
          failures = failuresList.length;
          if (failures > 0) {
            const latest = failuresList[failuresList.length - 1];
            lastFailure = latest.error;
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      status[connector] = {
        open: isOpen,
        failures,
        lastFailure
      };
      
    } catch (error) {
      console.error(`[CircuitBreaker] Failed to get status for ${connector}:`, error);
      status[connector] = {
        open: false,
        failures: 0
      };
    }
  }
  
  return status;
}

/**
 * Wrapper for connector calls with circuit breaker
 */
export async function withCircuitBreaker<T>(
  connectorName: string,
  env: any,
  fn: () => Promise<T>,
  config: CircuitBreakerConfig = DEFAULT_CONFIG
): Promise<T | null> {
  // Check if circuit is open
  if (await isCircuitOpen(connectorName, env)) {
    console.log(`[CircuitBreaker] Circuit open for ${connectorName}, skipping call`);
    return null;
  }
  
  try {
    const result = await fn();
    await recordConnectorSuccess(connectorName, env);
    return result;
  } catch (error) {
    await recordConnectorFailure(connectorName, error as Error, env, config);
    throw error;
  }
}
