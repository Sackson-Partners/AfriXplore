/**
 * External Service Integrations with Circuit Breaker Protection
 * Prevents cascade failures from external service outages
 */

import { createCircuitBreaker, createCircuitBreakerWithFallback } from '@ain/security';
import type CircuitBreaker from 'opossum';

// Circuit breakers are initialized lazily and stored in this registry
const circuitBreakerRegistry = new Map<string, CircuitBreaker<any[], any>>();

/**
 * Get or create a circuit breaker from the registry
 */
export function getCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
  name: string,
  action: T,
  options: {
    timeout?: number;
    errorThresholdPercentage?: number;
    resetTimeout?: number;
    volumeThreshold?: number;
  } = {}
): CircuitBreaker<Parameters<T>, ReturnType<T>> {
  if (!circuitBreakerRegistry.has(name)) {
    const breaker = createCircuitBreaker(action, {
      name,
      timeout: options.timeout ?? 10000,
      errorThresholdPercentage: options.errorThresholdPercentage ?? 0.5,
      resetTimeout: options.resetTimeout ?? 30000,
      volumeThreshold: options.volumeThreshold ?? 10,
    });
    circuitBreakerRegistry.set(name, breaker);
  }
  return circuitBreakerRegistry.get(name) as CircuitBreaker<Parameters<T>, ReturnType<T>>;
}

/**
 * OpenAI Circuit Breaker
 * Protects against OpenAI API failures
 */
export function createOpenAICircuitBreaker<T extends (...args: any[]) => Promise<any>>(
  action: T
): CircuitBreaker<Parameters<T>, ReturnType<T>> {
  return getCircuitBreaker('openai', action, {
    timeout: 30000, // 30s for OpenAI completions
    errorThresholdPercentage: 0.5,
    resetTimeout: 60000, // Try again after 1 minute
    volumeThreshold: 5,
  });
}

/**
 * Azure Search Circuit Breaker
 * Protects against Azure Cognitive Search failures
 */
export function createAzureSearchCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
  action: T
): CircuitBreaker<Parameters<T>, ReturnType<T>> {
  return getCircuitBreaker('azure-search', action, {
    timeout: 10000,
    errorThresholdPercentage: 0.5,
    resetTimeout: 30000,
    volumeThreshold: 10,
  });
}

/**
 * Azure OpenAI Circuit Breaker
 * Protects against Azure OpenAI service failures
 */
export function createAzureOpenAICircuitBreaker<T extends (...args: any[]) => Promise<any>>(
  action: T
): CircuitBreaker<Parameters<T>, ReturnType<T>> {
  return getCircuitBreaker('azure-openai', action, {
    timeout: 30000,
    errorThresholdPercentage: 0.5,
    resetTimeout: 60000,
    volumeThreshold: 5,
  });
}

/**
 * Azure Blob Storage Circuit Breaker
 * Protects against Azure Blob Storage failures
 */
export function createBlobStorageCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
  action: T
): CircuitBreaker<Parameters<T>, ReturnType<T>> {
  return getCircuitBreaker('blob-storage', action, {
    timeout: 15000,
    errorThresholdPercentage: 0.6, // Higher threshold for storage
    resetTimeout: 20000,
    volumeThreshold: 10,
  });
}

/**
 * Convergence Engine Circuit Breaker
 * Protects against convergence scoring service failures
 */
export function createConvergenceEngineCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
  action: T,
  fallback?: any
): CircuitBreaker<Parameters<T>, ReturnType<T>> {
  if (fallback !== undefined) {
    return getCircuitBreaker('convergence-engine-fallback', action, {
      timeout: 120000, // 2 minutes for heavy computation
      errorThresholdPercentage: 0.4,
      resetTimeout: 60000,
      volumeThreshold: 5,
    });
  }

  return getCircuitBreaker('convergence-engine', action, {
    timeout: 120000,
    errorThresholdPercentage: 0.4,
    resetTimeout: 60000,
    volumeThreshold: 5,
  });
}

/**
 * GeoSwarm API Circuit Breaker
 * Protects against GeoSwarm drone data service failures
 */
export function createGeoSwarmCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
  action: T
): CircuitBreaker<Parameters<T>, ReturnType<T>> {
  return getCircuitBreaker('geoswarm', action, {
    timeout: 15000,
    errorThresholdPercentage: 0.5,
    resetTimeout: 30000,
    volumeThreshold: 10,
  });
}

/**
 * Get health status of all circuit breakers
 */
export function getAllCircuitBreakerHealth() {
  const health: Record<string, any> = {};

  for (const [name, breaker] of circuitBreakerRegistry.entries()) {
    const stats = breaker.stats;
    health[name] = {
      state: breaker.opened ? 'open' : breaker.halfOpen ? 'half-open' : 'closed',
      requests: stats.fires,
      successes: stats.successes,
      failures: stats.failures,
      timeouts: stats.timeouts,
      rejects: stats.rejects,
      errorRate: stats.fires > 0 ? ((stats.failures / stats.fires) * 100).toFixed(2) + '%' : '0%',
      latency: {
        mean: Math.round(stats.latencyMean),
        p50: Math.round(stats.percentiles[50]),
        p95: Math.round(stats.percentiles[95]),
        p99: Math.round(stats.percentiles[99]),
      },
    };
  }

  return health;
}

/**
 * Reset all circuit breakers (useful for testing)
 */
export function resetAllCircuitBreakers() {
  for (const breaker of circuitBreakerRegistry.values()) {
    breaker.close();
  }
}

/**
 * Clear circuit breaker registry (useful for testing)
 */
export function clearCircuitBreakerRegistry() {
  circuitBreakerRegistry.clear();
}
