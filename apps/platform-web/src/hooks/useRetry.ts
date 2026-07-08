import { useState, useCallback } from 'react';

interface UseRetryOptions {
  maxRetries?: number;
  retryDelay?: number;
}

export function useRetry<T>(
  asyncFn: () => Promise<T>,
  options: UseRetryOptions = {}
) {
  const { maxRetries = 3, retryDelay = 1000 } = options;
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const retry = useCallback(async (): Promise<T> => {
    setIsRetrying(true);
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await asyncFn();
        setRetryCount(0);
        setIsRetrying(false);
        return result;
      } catch (error) {
        lastError = error as Error;
        setRetryCount(attempt + 1);

        if (attempt < maxRetries) {
          // Exponential backoff with jitter
          const delay = retryDelay * Math.pow(2, attempt) + Math.random() * 500;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    setIsRetrying(false);
    throw lastError || new Error('Retry failed');
  }, [asyncFn, maxRetries, retryDelay]);

  const reset = useCallback(() => {
    setRetryCount(0);
    setIsRetrying(false);
  }, []);

  return {
    retry,
    reset,
    retryCount,
    isRetrying,
    canRetry: retryCount < maxRetries,
  };
}
