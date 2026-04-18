/**
 * AfriXplore — Mineral Identification Service
 * Two-stage pipeline: Azure Custom Vision (cloud) + TFLite (mobile fallback)
 */

import axios from 'axios';
import { db } from './db/client';
import { publishToServiceBus } from './utils/serviceBus';
import { trackEvent, trackMetric } from './utils/appInsights';

export const MINERAL_CATALOGUE = {
  copper:    { displayName: 'Copper',            category: 'battery_metal',  hazard: 'low',      priceMultiplier: 1.0 },
  cobalt:    { displayName: 'Cobalt',            category: 'battery_metal',  hazard: 'medium',   priceMultiplier: 3.2 },
  lithium:   { displayName: 'Lithium',           category: 'battery_metal',  hazard: 'low',      priceMultiplier: 2.8 },
  nickel:    { displayName: 'Nickel',            category: 'battery_metal',  hazard: 'low',      priceMultiplier: 1.5 },
  manganese: { displayName: 'Manganese',         category: 'battery_metal',  hazard: 'low',      priceMultiplier: 0.8 },
  gold:      { displayName: 'Gold',              category: 'precious_metal', hazard: 'medium',   priceMultiplier: 8.5 },
  platinum:  { displayName: 'Platinum/PGM',      category: 'pgm',            hazard: 'low',      priceMultiplier: 9.0 },
  palladium: { displayName: 'Palladium',         category: 'pgm',            hazard: 'low',      priceMultiplier: 9.5 },
  chrome:    { displayName: 'Chrome/Chromite',   category: 'industrial',     hazard: 'low',      priceMultiplier: 0.6 },
  graphite:  { displayName: 'Graphite',          category: 'industrial',     hazard: 'medium',   priceMultiplier: 0.9 },
  tin:       { displayName: 'Cassiterite/Tin',   category: 'industrial',     hazard: 'low',      priceMultiplier: 1.1 },
  tungsten:  { displayName: 'Wolframite/Tungsten', category: 'industrial',   hazard: 'low',      priceMultiplier: 1.4 },
  coltan:    { displayName: 'Coltan/Tantalum',   category: 'critical',       hazard: 'low',      priceMultiplier: 5.0 },
  bauxite:   { displayName: 'Bauxite',           category: 'industrial',     hazard: 'low',      priceMultiplier: 0.4 },
  uranium:   { displayName: 'Uranium',           category: 'radioactive',    hazard: 'critical', priceMultiplier: 7.0 },
  ree:       { displayName: 'Rare Earth Elements', category: 'ree',          hazard: 'medium',   priceMultiplier: 4.0 },
  quartz:    { displayName: 'Quartz',            category: 'gangue',         hazard: 'low',      priceMultiplier: 0.1 },
  feldspar:  { displayName: 'Feldspar',          category: 'gangue',         hazard: 'low',      priceMultiplier: 0.1 },
  pyrite:    { displayName: 'Pyrite',            category: 'sulphide',       hazard: 'medium',   priceMultiplier: 0.3 },
  malachite: { displayName: 'Malachite',         category: 'copper_oxide',   hazard: 'low',      priceMultiplier: 0.7 },
  galena:    { displayName: 'Galena/Lead',       category: 'sulphide',       hazard: 'high',     priceMultiplier: 0.5 },
  unknown:   { displayName: 'Unknown Mineral',   category: 'unknown',        hazard: 'unknown',  priceMultiplier: 0.0 },
} as const;

export type MineralType = keyof typeof MINERAL_CATALOGUE;

const HAZARD_ALERTS: Record<string, string[]> = {
  uranium: [
    '☢️ RADIOACTIVE: Do NOT handle with bare hands',
    'Wear gloves and keep sample in sealed bag',
    'Do not carry in pockets or near body',
    'Report to government mining authority immediately',
    'Keep away from children',
  ],
  galena: [
    '⚠️ LEAD ORE: Contains toxic lead',
    'Wash hands thoroughly after handling',
    'Do not eat, drink or smoke near samples',
  ],
  pyrite: [
    '⚠️ Pyrite can produce sulphuric acid when wet',
    'Acid mine drainage risk in working areas',
    'Ensure good ventilation in shafts',
  ],
  graphite: [
    '💨 Fine graphite dust — use dust mask',
    'Ensure good ventilation in working area',
  ],
  coltan: [
    '📋 Coltan requires conflict minerals documentation',
    'Ensure proper chain of custody records',
  ],
};

const BASE_PRICES_USD_PER_TONNE: Record<string, number> = {
  copper: 9500,
  cobalt: 33000,
  lithium: 15000,
  gold: 60000000,
  platinum: 31000000,
  nickel: 18000,
  chrome: 280,
  graphite: 800,
  tin: 25000,
  tungsten: 35000,
  coltan: 180000,
  manganese: 400,
  uranium: 125000,
  bauxite: 30,
};

export interface MineralPrediction {
  mineral: MineralType;
  probability: number;
  displayName: string;
}

export interface PriceGuidance {
  mineralType: string;
  estimatedPriceUsdPerTonne: number;
  priceRangeLow: number;
  priceRangeHigh: number;
  nearestBuyer?: {
    name: string;
    phone: string;
    distanceKm: number;
    operatingHours: string;
  };
  lastUpdated: string;
}

export interface MineralAssessmentResult {
  reportId: string;
  modelVersion: string;
  predictions: MineralPrediction[];
  topMineral: MineralType;
  confidence: number;
  priceGuidance: PriceGuidance;
  hazardAlerts: string[];
  processingTimeMs: number;
}

export async function runMineralIdentification(
  reportId: string,
  photoUrls: string[],
  scoutLatitude: number,
  scoutLongitude: number
): Promise<MineralAssessmentResult> {
  const startTime = Date.now();

  const predictionEndpoint = process.env.CUSTOM_VISION_PREDICTION_ENDPOINT!;
  const predictionKey = process.env.CUSTOM_VISION_PREDICTION_KEY!;
  const projectId = process.env.CUSTOM_VISION_PROJECT_ID!;
  const publishedName = process.env.CUSTOM_VISION_PUBLISHED_NAME || 'mineral-id-v1';

  const primaryPhotoUrl = photoUrls[0];
  const photoResponse = await axios.get(primaryPhotoUrl, {
    responseType: 'arraybuffer',
    timeout: 15000,
  });
  const photoBuffer = Buffer.from(photoResponse.data);

  const cvResponse = await axios.post(
    `${predictionEndpoint}/customvision/v3.0/Prediction/${projectId}/classify/iterations/${publishedName}/image`,
    photoBuffer,
    {
      headers: {
        'Prediction-Key': predictionKey,
        'Content-Type': 'application/octet-stream',
      },
      timeout: 10000,
    }
  );

  const rawPredictions = cvResponse.data.predictions as Array<{
    tagName: string;
    probability: number;
  }>;

  const predictions: MineralPrediction[] = rawPredictions
    .filter((p) => p.tagName in MINERAL_CATALOGUE)
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 3)
    .map((p) => ({
      mineral: p.tagName as MineralType,
      probability: Math.round(p.probability * 10000) / 10000,
      displayName: MINERAL_CATALOGUE[p.tagName as MineralType]?.displayName || p.tagName,
    }));

  if (predictions.length === 0) {
    predictions.push({ mineral: 'unknown', probability: 1.0, displayName: 'Unknown Mineral' });
  }

  const topMineral = predictions[0].mineral;
  const confidence = predictions[0].probability;
  const priceGuidance = await getPriceGuidance(topMineral, scoutLatitude, scoutLongitude);
  const hazardAlerts = [...(HAZARD_ALERTS[topMineral] || [])];

  if (isNearUraniumBelt(scoutLatitude, scoutLongitude)) {
    hazardAlerts.push('⚠️ You are in an area known for uranium mineralisation. Handle all samples carefully.');
  }

  const processingTimeMs = Date.now() - startTime;
  const modelVersion = `custom-vision-${publishedName}-${new Date().toISOString().slice(0, 7)}`;

  await db.query(
    `INSERT INTO mineral_assessments (report_id, model_version, predictions, confidence, created_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (report_id) DO UPDATE SET
       model_version = EXCLUDED.model_version,
       predictions = EXCLUDED.predictions,
       confidence = EXCLUDED.confidence,
       updated_at = NOW()`,
    [reportId, modelVersion, JSON.stringify(predictions), confidence]
  );

  await db.query(
    `UPDATE reports SET ai_primary_mineral = $1, ai_confidence = $2, updated_at = NOW() WHERE id = $3`,
    [topMineral, confidence, reportId]
  );

  trackMetric('mineral_id_latency_ms', processingTimeMs, {
    model: 'custom-vision',
    top_mineral: topMineral,
    confidence_bucket: confidence > 0.8 ? 'high' : confidence > 0.5 ? 'medium' : 'low',
  });

  trackEvent('mineral_identified', {
    reportId,
    topMineral,
    confidence: confidence.toString(),
    processingTimeMs: processingTimeMs.toString(),
  });

  const scoutId = await getScoutIdForReport(reportId);

  await publishToServiceBus('mineral-assessed', {
    reportId,
    scoutId,
    topMineral,
    confidence,
    priceGuidance,
    hazardAlerts,
  });

  console.log(`Mineral ID: ${topMineral} (${(confidence * 100).toFixed(1)}%) — ${processingTimeMs}ms`);

  return {
    reportId,
    modelVersion,
    predictions,
    topMineral,
    confidence,
    priceGuidance,
    hazardAlerts,
    processingTimeMs,
  };
}

async function getPriceGuidance(
  mineral: MineralType,
  latitude: number,
  longitude: number
): Promise<PriceGuidance> {
  const basePrice = BASE_PRICES_USD_PER_TONNE[mineral] || 0;
  const variance = 0.15;

  const nearestBuyer = await findNearestBuyer(mineral, latitude, longitude);

  return {
    mineralType: mineral,
    estimatedPriceUsdPerTonne: basePrice,
    priceRangeLow: Math.round(basePrice * (1 - variance)),
    priceRangeHigh: Math.round(basePrice * (1 + variance)),
    nearestBuyer,
    lastUpdated: new Date().toISOString(),
  };
}

async function findNearestBuyer(
  mineral: MineralType,
  latitude: number,
  longitude: number
): Promise<PriceGuidance['nearestBuyer'] | undefined> {
  try {
    const result = await db.query(
      `SELECT name, phone, operating_hours,
        ST_Distance(location::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) / 1000 as distance_km
       FROM certified_buyers
       WHERE $3 = ANY(minerals_accepted) AND is_active = true
       ORDER BY location::geography <-> ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
       LIMIT 1`,
      [latitude, longitude, mineral]
    );

    if (result.rows.length === 0) return undefined;
    const buyer = result.rows[0];
    return {
      name: buyer.name,
      phone: buyer.phone,
      distanceKm: Math.round(buyer.distance_km * 10) / 10,
      operatingHours: buyer.operating_hours || 'Mon-Fri 8am-5pm',
    };
  } catch {
    return undefined;
  }
}

function isNearUraniumBelt(lat: number, lon: number): boolean {
  const uraniumZones = [
    { lat: -22.5, lon: 14.8, radiusDeg: 2.0 },
    { lat: 18.7,  lon: 7.4,  radiusDeg: 1.5 },
    { lat: -8.5,  lon: 31.5, radiusDeg: 2.5 },
    { lat: -5.5,  lon: 35.0, radiusDeg: 2.0 },
  ];

  return uraniumZones.some((zone) => {
    const dLat = lat - zone.lat;
    const dLon = lon - zone.lon;
    return Math.sqrt(dLat * dLat + dLon * dLon) < zone.radiusDeg;
  });
}

async function getScoutIdForReport(reportId: string): Promise<string> {
  const result = await db.query('SELECT scout_id FROM reports WHERE id = $1', [reportId]);
  return result.rows[0]?.scout_id || '';
}
