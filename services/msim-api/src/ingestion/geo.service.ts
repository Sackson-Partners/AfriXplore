import type { GeocodedLocation } from './types.js';

interface AzureMapsAddressResult {
  position: { lat: number; lon: number };
  address: {
    freeformAddress: string;
    country: string;
    countryCode: string;
    municipality?: string;
    municipalitySubdivision?: string;
    countrySubdivision?: string;
  };
  score: number;
}

interface AzureMapsSearchResponse {
  results: AzureMapsAddressResult[];
}

/**
 * Geocode a place name string using the Azure Maps Search Address API.
 * Returns null if no confident result is found (score < 0.5).
 */
export async function geocodeLocation(query: string): Promise<GeocodedLocation | null> {
  const subscriptionKey = process.env.AZURE_MAPS_SUBSCRIPTION_KEY;
  if (!subscriptionKey) {
    console.warn('AZURE_MAPS_SUBSCRIPTION_KEY not set — skipping geocoding');
    return null;
  }

  const url = new URL('https://atlas.microsoft.com/search/address/json');
  url.searchParams.set('api-version', '1.0');
  url.searchParams.set('query', query);
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrySet', 'AF,ZA,CD,ZM,GH,SL,ZW,MZ,AO,NA,BW,TZ,KE,NG');
  url.searchParams.set('subscription-key', subscriptionKey);

  const response = await fetch(url.toString());
  if (!response.ok) {
    console.error(`Azure Maps geocoding failed: ${response.status} ${response.statusText}`);
    return null;
  }

  const data = (await response.json()) as AzureMapsSearchResponse;
  const top = data.results[0];

  if (!top || top.score < 0.5) return null;

  const confidence = Math.min(top.score / 10, 1); // Azure Maps scores are 0–10

  return {
    placeName: top.address.freeformAddress,
    country: top.address.country,
    district: top.address.countrySubdivision ?? top.address.municipality,
    latitude: top.position.lat,
    longitude: top.position.lon,
    confidence,
  };
}

/**
 * Try each hint in order; return the first confident geocode result.
 */
export async function geocodeFirstMatch(hints: string[]): Promise<GeocodedLocation | null> {
  for (const hint of hints) {
    const result = await geocodeLocation(hint);
    if (result) return result;
  }
  return null;
}
