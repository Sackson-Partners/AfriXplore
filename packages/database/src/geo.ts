import { BBox, Point } from 'geojson';

/**
 * Converts a GeoJSON Point to WKT (Well-Known Text) format.
 * Example: { coordinates: [28.04, -26.20] } → 'POINT(28.04 -26.20)'
 */
export function pointToWKT(point: Point): string {
  const [lng, lat] = point.coordinates;
  return `POINT(${lng} ${lat})`;
}

/**
 * Converts WKT point string to a GeoJSON Point.
 * Example: 'POINT(28.04 -26.20)' → { type: 'Point', coordinates: [28.04, -26.20] }
 */
export function wktToGeoJsonPoint(wkt: string): Point {
  const match = /POINT\s*\(([^)]+)\)/i.exec(wkt);
  if (!match) throw new Error(`Invalid WKT point: ${wkt}`);
  const [lngStr, latStr] = match[1].trim().split(/\s+/);
  return {
    type: 'Point',
    coordinates: [parseFloat(lngStr), parseFloat(latStr)],
  };
}

/**
 * Parses PostGIS ST_AsText(geom::geometry) output for POINT.
 * Alias of wktToGeoJsonPoint with more explicit semantics.
 */
export function parsePostgisPoint(wkt: string): Point {
  return wktToGeoJsonPoint(wkt);
}

/**
 * Builds a PostGIS bounding-box filter fragment.
 * Returns { sql, params } where params are appended starting at $startIdx.
 * Example: buildBboxFilter([minLng, minLat, maxLng, maxLat], 'location', 1)
 *   → { sql: 'ST_Within(location, ST_MakeEnvelope($1,$2,$3,$4,4326))', params: [...] }
 */
export function buildBboxFilter(
  bbox: BBox,
  column: string,
  startIdx: number
): { sql: string; params: number[] } {
  const [minLng, minLat, maxLng, maxLat] = bbox as [number, number, number, number];
  return {
    sql: `ST_Within(${column}, ST_MakeEnvelope($${startIdx}, $${startIdx + 1}, $${startIdx + 2}, $${startIdx + 3}, 4326))`,
    params: [minLng, minLat, maxLng, maxLat],
  };
}

/**
 * Builds a PostGIS territory filter fragment for subscriber RLS.
 * Checks that the given point column is within the subscriber's licensed territory geometry.
 */
export function buildTerritoryFilter(
  pointColumn: string,
  territoryColumn: string
): string {
  return `ST_Within(${pointColumn}::geometry, ${territoryColumn}::geometry)`;
}
