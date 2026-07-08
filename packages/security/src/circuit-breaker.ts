/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascade failures when external services are unavailable
 */

import CircuitBreaker from 'opossum';
import type { CircuitBreakerOptions as OpossumOptions } from 'opossum';

export interface CircuitBreakerOptions extends Partial<OpossumOptions> {
  /**
   * Name of the circuit breaker (for logging/monitoring)
   */
  name: string;
  /**
   * Error threshold percentage (0-1) before opening circuit
   * Default: 0.5 (50% error rate)
   */
  errorThresholdPercentage?: number;
  /**
   * Time in ms before attempting to close circuit
   * Default: 30000 (30 seconds)
   */
  resetTimeout?: number;
  /**
   * Minimum number of requests before calculating error rate
   * Default: 10
   */
  volumeThreshold?: number;
  /**
   * Timeout in ms for the action
   * Default: 10000 (10 seconds)
   */
  timeout?: number;
}

/**
 * Create a circuit breaker for an async function
 *
 * @example
 * ```typescript
 * import { createCircuitBreaker } from '@ain/security/circuit-breaker';
 *
 * const openAIBreaker = createCircuitBreaker(
 *   async (prompt: string) => {
 *     const response = await openai.chat.completions.create({
 *       model: 'gpt-4',
 *       messages: [{ role: 'user', content: prompt }],
 *     });
 *     return response.choices[0].message.content;
 *   },
 *   {
 *     name: 'openai-completion',
 *     timeout: 30000,
 *     errorThresholdPercentage: 0.5,
 *     resetTimeout: 60000,
 *   }
 * );
 *
 * try {
 *   const result = await openAIBreaker.fire(prompt);
 * } catch (error) {
 *   if (error.message.includes('CircuitBreaker')) {
 *     // Circuit is open, use fallback
 *   }
 * }
 * ```
 */
export function createCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
  action: T,
  options: CircuitBreakerOptions
): CircuitBreaker<Parameters<T>, ReturnType<T>> {
  const {
    name,
    errorThresholdPercentage = 0.5,
    resetTimeout = 30000,
    volumeThreshold = 10,
    timeout = 10000,
    ...restOptions
  } = options;

  const breaker = new CircuitBreaker(action, {
    errorThresholdPercentage,
    resetTimeout,
    volumeThreshold,
    timeout,
    name,
    ...restOptions,
  });

  // Log circuit breaker state changes
  breaker.on('open', () => {
    console.warn(`[CircuitBreaker:${name}] Circuit opened - failures exceeded threshold`);
  });

  breaker.on('halfOpen', () => {
    console.info(`[CircuitBreaker:${name}] Circuit half-open - attempting reset`);
  });

  breaker.on('close', () => {
    console.info(`[CircuitBreaker:${name}] Circuit closed - service recovered`);
  });

  breaker.on('timeout', () => {
    console.warn(`[CircuitBreaker:${name}] Request timeout after ${timeout}ms`);
  });

  breaker.on('failure', (error) => {
    console.error(`[CircuitBreaker:${name}] Request failed:`, error.message);
  });

  return breaker;
}

/**
 * Create circuit breaker with fallback
 * Returns fallback value when circuit is open
 */
export function createCircuitBreakerWithFallback<
  T extends (...args: any[]) => Promise<any>,
  F
>(
  action: T,
  fallback: F | ((...args: Parameters<T>) => F | Promise<F>),
  options: CircuitBreakerOptions
): CircuitBreaker<Parameters<T>, ReturnType<T> | F> {
  const breaker = createCircuitBreaker(action, options);

  breaker.fallback(async (...args: Parameters<T>) => {
    console.warn(`[CircuitBreaker:${options.name}] Using fallback`);
    return typeof fallback === 'function'
      ? await (fallback as Function)(...args)
      : fallback;
  });

  return breaker as any;
}

/**
 * Get health status of a circuit breaker
 */
export function getCircuitBreakerHealth(breaker: CircuitBreaker<any[], any>) {
  const stats = breaker.stats;

  return {
    name: breaker.name,
    state: breaker.opened ? 'open' : breaker.halfOpen ? 'half-open' : 'closed',
    requests: stats.fires,
    successes: stats.successes,
    failures: stats.failures,
    timeouts: stats.timeouts,
    rejects: stats.rejects,
    errorRate: stats.fires > 0 ? (stats.failures / stats.fires) * 100 : 0,
    latency: {
      mean: stats.latencyMean,
      percentiles: {
        p50: stats.percentiles[50],
        p95: stats.percentiles[95],
        p99: stats.percentiles[99],
      },
    },
  };
}
