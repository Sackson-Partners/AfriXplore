/**
 * Retry utility with exponential backoff and jitter
 */

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterPercent?: number;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, baseDelayMs: number, maxDelayMs: number, jitterPercent: number): number {
  // Exponential backoff: baseDelay * (2 ^ attempt)
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);

  // Cap at maxDelay
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

  // Add jitter: randomize by ±jitterPercent to prevent thundering herd
  const jitterRange = cappedDelay * (jitterPercent / 100);
  const jitter = (Math.random() * 2 - 1) * jitterRange; // Random between -jitterRange and +jitterRange

  return Math.max(0, Math.floor(cappedDelay + jitter));
}

/**
 * Retry an async function with exponential backoff
 *
 * @param fn - Async function to retry
 * @param options - Retry configuration
 * @returns Promise resolving to function result
 * @throws Error if all retries exhausted
 *
 * @example
 * const result = await retryWithBackoff(
 *   async () => await openai.chat.completions.create(...),
 *   { maxRetries: 3, baseDelayMs: 1000 }
 * );
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    jitterPercent = 20
  } = options;

  let lastError: Error | unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const error = err as Error;

      if (attempt === maxRetries) {
        // Final attempt failed - throw wrapped error
        throw new Error(
          `Operation failed after ${maxRetries + 1} attempts. Last error: ${error.message}`
        );
      }

      // Calculate next retry delay
      const delayMs = calculateDelay(attempt, baseDelayMs, maxDelayMs, jitterPercent);

      console.log(
        `[Retry] Attempt ${attempt + 1}/${maxRetries + 1} failed: ${error.message}. ` +
        `Retrying in ${delayMs}ms...`
      );

      await sleep(delayMs);
    }
  }

  // This should never be reached due to throw above
  throw new Error(`Unexpected: retry loop completed. Last error: ${String(lastError)}`);
}

/**
 * Check if an error is retryable (transient vs permanent)
 */
export function isRetryableError(error: unknown): boolean {
  const err = error as any;
  const message = err?.message?.toLowerCase() || '';
  const code = err?.code || '';
  const status = err?.status || err?.statusCode || 0;

  // Network errors (retryable)
  if (
    code === 'ECONNRESET' ||
    code === 'ENOTFOUND' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNREFUSED' ||
    message.includes('network') ||
    message.includes('timeout')
  ) {
    return true;
  }

  // HTTP status codes (retryable)
  if (
    status === 429 || // Rate limit
    status === 500 || // Internal server error
    status === 502 || // Bad gateway
    status === 503 || // Service unavailable
    status === 504    // Gateway timeout
  ) {
    return true;
  }

  // Azure OpenAI specific errors (retryable)
  if (
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('quota exceeded') ||
    message.includes('throttled')
  ) {
    return true;
  }

  // Default: not retryable (likely client error like 400, 401, 404)
  return false;
}

/**
 * Retry only if error is retryable (skip retry for client errors)
 */
export async function retryIfRetryable<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (!isRetryableError(error)) {
      // Non-retryable error - throw immediately
      console.log('[Retry] Error is not retryable, failing immediately');
      throw error;
    }

    // Retryable error - use backoff
    return await retryWithBackoff(fn, options);
  }
}
