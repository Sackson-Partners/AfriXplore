/**
 * Cache Service
 * Application-specific caching logic
 */

import { get, set, del, getOrCompute, CACHE_TTL } from '@ain/cache';

/**
 * Cache convergence score
 */
export async function cacheConvergenceScore(
  mineId: string,
  score: any,
  ttl: number = CACHE_TTL.LONG
): Promise<boolean> {
  return set(`convergence:score:${mineId}`, score, ttl);
}

/**
 * Get cached convergence score
 */
export async function getCachedConvergenceScore(mineId: string): Promise<any | null> {
  return get(`convergence:score:${mineId}`);
}

/**
 * Invalidate convergence score cache
 */
export async function invalidateConvergenceScore(mineId: string): Promise<boolean> {
  return del(`convergence:score:${mineId}`);
}

/**
 * Cache mine data
 */
export async function cacheMineData(
  mineId: string,
  mine: any,
  ttl: number = CACHE_TTL.MEDIUM
): Promise<boolean> {
  return set(`mine:${mineId}`, mine, ttl);
}

/**
 * Get cached mine data
 */
export async function getCachedMineData(mineId: string): Promise<any | null> {
  return get(`mine:${mineId}`);
}

/**
 * Cache search results
 */
export async function cacheSearchResults(
  query: string,
  filters: any,
  results: any,
  ttl: number = CACHE_TTL.SHORT
): Promise<boolean> {
  const key = `search:${query}:${JSON.stringify(filters)}`;
  return set(key, results, ttl);
}

/**
 * Get cached search results
 */
export async function getCachedSearchResults(
  query: string,
  filters: any
): Promise<any | null> {
  const key = `search:${query}:${JSON.stringify(filters)}`;
  return get(key);
}

/**
 * Cache analytics data
 */
export async function cacheAnalytics(
  type: string,
  params: any,
  data: any,
  ttl: number = CACHE_TTL.LONG
): Promise<boolean> {
  const key = `analytics:${type}:${JSON.stringify(params)}`;
  return set(key, data, ttl);
}

/**
 * Get cached analytics data
 */
export async function getCachedAnalytics(
  type: string,
  params: any
): Promise<any | null> {
  const key = `analytics:${type}:${JSON.stringify(params)}`;
  return get(key);
}

/**
 * Get or compute convergence score with caching
 */
export async function getOrComputeConvergenceScore(
  mineId: string,
  computeFn: () => Promise<any>
): Promise<any> {
  return getOrCompute(
    `convergence:score:${mineId}`,
    computeFn,
    CACHE_TTL.LONG
  );
}
