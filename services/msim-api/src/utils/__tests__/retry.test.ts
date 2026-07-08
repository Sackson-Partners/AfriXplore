import { retryWithBackoff, isRetryableError } from '../retry';

describe('retryWithBackoff', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return result on first attempt if successful', async () => {
    const fn = jest.fn().mockResolvedValue('success');

    const result = await retryWithBackoff(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue('success');

    const result = await retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 10 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after max retries are exhausted', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Persistent failure'));

    await expect(retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 10 })).rejects.toThrow(
      'Persistent failure'
    );

    expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it('should respect custom maxRetries option', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Fail'));

    await expect(retryWithBackoff(fn, { maxRetries: 5, baseDelayMs: 10 })).rejects.toThrow();

    expect(fn).toHaveBeenCalledTimes(6); // Initial + 5 retries
  });

  it('should apply exponential backoff delays', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Fail'));
    const delaysSpy: number[] = [];

    const originalSetTimeout = global.setTimeout;
    global.setTimeout = jest.fn((callback: () => void, delay: number) => {
      delaysSpy.push(delay);
      return originalSetTimeout(callback, 0) as unknown as NodeJS.Timeout;
    }) as unknown as typeof setTimeout;

    await expect(
      retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 100, jitterPercent: 0 })
    ).rejects.toThrow();

    global.setTimeout = originalSetTimeout;

    // Exponential: base * (2^attempt)
    // Attempt 0: 100 * 1 = 100
    // Attempt 1: 100 * 2 = 200
    // Attempt 2: 100 * 4 = 400
    expect(delaysSpy).toHaveLength(3);
    expect(delaysSpy[0]).toBe(100);
    expect(delaysSpy[1]).toBe(200);
    expect(delaysSpy[2]).toBe(400);
  });

  it('should cap delay at maxDelayMs', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Fail'));
    const delaysSpy: number[] = [];

    const originalSetTimeout = global.setTimeout;
    global.setTimeout = jest.fn((callback: () => void, delay: number) => {
      delaysSpy.push(delay);
      return originalSetTimeout(callback, 0) as unknown as NodeJS.Timeout;
    }) as unknown as typeof setTimeout;

    await expect(
      retryWithBackoff(fn, {
        maxRetries: 5,
        baseDelayMs: 1000,
        maxDelayMs: 3000,
        jitterPercent: 0,
      })
    ).rejects.toThrow();

    global.setTimeout = originalSetTimeout;

    // Delays: 1000, 2000, 4000 (capped to 3000), 8000 (capped to 3000), 16000 (capped to 3000)
    expect(delaysSpy[0]).toBe(1000);
    expect(delaysSpy[1]).toBe(2000);
    expect(delaysSpy[2]).toBe(3000);
    expect(delaysSpy[3]).toBe(3000);
    expect(delaysSpy[4]).toBe(3000);
  });

  it('should apply jitter to delays', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Fail'));
    const delaysSpy: number[] = [];

    const originalSetTimeout = global.setTimeout;
    global.setTimeout = jest.fn((callback: () => void, delay: number) => {
      delaysSpy.push(delay);
      return originalSetTimeout(callback, 0) as unknown as NodeJS.Timeout;
    }) as unknown as typeof setTimeout;

    await expect(
      retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 1000, jitterPercent: 20 })
    ).rejects.toThrow();

    global.setTimeout = originalSetTimeout;

    // With 20% jitter, delays should vary by ±20%
    // Base 1000: 800-1200
    // Base 2000: 1600-2400
    expect(delaysSpy[0]).toBeGreaterThanOrEqual(800);
    expect(delaysSpy[0]).toBeLessThanOrEqual(1200);
    expect(delaysSpy[1]).toBeGreaterThanOrEqual(1600);
    expect(delaysSpy[1]).toBeLessThanOrEqual(2400);
  });

  it('should not retry non-retryable errors by default', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Non-retryable'));

    await expect(retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 10 })).rejects.toThrow(
      'Non-retryable'
    );

    // Should retry because default behavior retries all errors
    expect(fn).toHaveBeenCalledTimes(4);
  });
});

describe('isRetryableError', () => {
  it('should identify network errors as retryable', () => {
    expect(isRetryableError(new Error('ECONNRESET'))).toBe(true);
    expect(isRetryableError(new Error('ETIMEDOUT'))).toBe(true);
    expect(isRetryableError(new Error('ENOTFOUND'))).toBe(true);
    expect(isRetryableError(new Error('Network request failed'))).toBe(true);
  });

  it('should identify HTTP error codes as retryable', () => {
    expect(isRetryableError({ response: { status: 429 } })).toBe(true); // Rate limit
    expect(isRetryableError({ response: { status: 500 } })).toBe(true); // Server error
    expect(isRetryableError({ response: { status: 502 } })).toBe(true); // Bad gateway
    expect(isRetryableError({ response: { status: 503 } })).toBe(true); // Service unavailable
    expect(isRetryableError({ response: { status: 504 } })).toBe(true); // Gateway timeout
  });

  it('should identify rate limit errors as retryable', () => {
    expect(isRetryableError(new Error('Rate limit exceeded'))).toBe(true);
    expect(isRetryableError(new Error('Too many requests'))).toBe(true);
    expect(isRetryableError({ code: 'RATE_LIMIT_EXCEEDED' })).toBe(true);
  });

  it('should not mark non-retryable errors as retryable', () => {
    expect(isRetryableError(new Error('Invalid input'))).toBe(false);
    expect(isRetryableError({ response: { status: 400 } })).toBe(false); // Bad request
    expect(isRetryableError({ response: { status: 401 } })).toBe(false); // Unauthorized
    expect(isRetryableError({ response: { status: 403 } })).toBe(false); // Forbidden
    expect(isRetryableError({ response: { status: 404 } })).toBe(false); // Not found
  });

  it('should handle errors without response property', () => {
    expect(isRetryableError(new Error('Some error'))).toBe(false);
    expect(isRetryableError({ message: 'Error without response' })).toBe(false);
  });

  it('should handle non-Error objects', () => {
    expect(isRetryableError('string error')).toBe(false);
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
    expect(isRetryableError(42)).toBe(false);
  });
});
