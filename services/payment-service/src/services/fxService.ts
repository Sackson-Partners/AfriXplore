import axios from 'axios';

interface CacheEntry {
  rate: number;
  expiresAt: number;
}

// In-memory cache — shared across requests within a single process lifetime
const cache = new Map<string, CacheEntry>();
const TTL_MS = 60 * 60 * 1000; // 1 hour

// Emergency fallbacks — used only when the live API is unreachable and cache is empty.
// These are approximate and will drift; the live fetch is always preferred.
const FALLBACK_RATES: Record<string, number> = {
  XOF: 655.957, // WAEMU peg to EUR (relatively stable but not guaranteed)
  EGP: 48.0,
  NGN: 1580.0,
};

/**
 * Returns the exchange rate from USD to the given currency.
 * Fetches from Flutterwave's rates API, caches for 1 hour, falls back to
 * stale cache then hardcoded values if the API is unavailable.
 */
export async function getUsdToRate(targetCurrency: string): Promise<number> {
  const now = Date.now();
  const cached = cache.get(targetCurrency);
  if (cached && cached.expiresAt > now) {
    return cached.rate;
  }

  try {
    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!secretKey) throw new Error('FLUTTERWAVE_SECRET_KEY not set');

    const response = await axios.get(
      'https://api.flutterwave.com/v3/transfers/rates',
      {
        params: { amount: 1, destination_currency: targetCurrency, source_currency: 'USD' },
        headers: { Authorization: `Bearer ${secretKey}` },
        timeout: 5000,
      }
    );

    const rate: unknown = response.data?.data?.rate;
    if (typeof rate !== 'number' || rate <= 0) {
      throw new Error(`Unexpected rate value: ${rate}`);
    }

    cache.set(targetCurrency, { rate, expiresAt: now + TTL_MS });
    return rate;
  } catch (err) {
    process.stdout.write(
      JSON.stringify({
        level: 'warn',
        service: 'payment-service',
        ts: new Date().toISOString(),
        msg: 'FX rate fetch failed — using fallback',
        targetCurrency,
        err: (err as Error).message,
      }) + '\n'
    );

    // Return stale cache if available, otherwise hardcoded fallback
    if (cached) return cached.rate;
    const fallback = FALLBACK_RATES[targetCurrency];
    if (fallback) return fallback;
    throw new Error(`No FX rate available for ${targetCurrency}`);
  }
}
