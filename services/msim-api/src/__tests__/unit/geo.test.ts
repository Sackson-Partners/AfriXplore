import { describe, it, expect } from 'vitest';
import { pointToWKT, wktToGeoJsonPoint, buildBboxFilter, buildTerritoryFilter } from '@ain/database';

describe('pointToWKT', () => {
  it('converts a GeoJSON point to WKT', () => {
    const result = pointToWKT({ type: 'Point', coordinates: [28.04, -26.2] });
    expect(result).toBe('POINT(28.04 -26.2)');
  });

  it('handles zero coordinates', () => {
    const result = pointToWKT({ type: 'Point', coordinates: [0, 0] });
    expect(result).toBe('POINT(0 0)');
  });
});

describe('wktToGeoJsonPoint', () => {
  it('parses a WKT point to GeoJSON', () => {
    const result = wktToGeoJsonPoint('POINT(28.04 -26.2)');
    expect(result).toEqual({ type: 'Point', coordinates: [28.04, -26.2] });
  });

  it('handles POINT with extra whitespace', () => {
    const result = wktToGeoJsonPoint('POINT( 10.5   -5.0 )');
    expect(result).toEqual({ type: 'Point', coordinates: [10.5, -5.0] });
  });

  it('is case-insensitive', () => {
    const result = wktToGeoJsonPoint('point(1.0 2.0)');
    expect(result).toEqual({ type: 'Point', coordinates: [1.0, 2.0] });
  });

  it('throws on invalid WKT', () => {
    expect(() => wktToGeoJsonPoint('LINESTRING(0 0, 1 1)')).toThrow('Invalid WKT point');
  });

  it('round-trips with pointToWKT', () => {
    const original = { type: 'Point' as const, coordinates: [33.5, -10.2] };
    const wkt = pointToWKT(original);
    const result = wktToGeoJsonPoint(wkt);
    expect(result.coordinates[0]).toBeCloseTo(original.coordinates[0]);
    expect(result.coordinates[1]).toBeCloseTo(original.coordinates[1]);
  });
});

describe('buildBboxFilter', () => {
  it('generates a correct ST_MakeEnvelope expression', () => {
    const { sql, params } = buildBboxFilter([20, -30, 35, -10], 'location', 1);
    expect(sql).toContain('ST_MakeEnvelope($1, $2, $3, $4, 4326)');
    expect(params).toEqual([20, -30, 35, -10]);
  });

  it('uses startIdx for parameter numbering', () => {
    const { sql, params } = buildBboxFilter([0, 0, 1, 1], 'loc', 5);
    expect(sql).toContain('$5, $6, $7, $8');
    expect(params).toHaveLength(4);
  });
});

describe('buildTerritoryFilter', () => {
  it('returns a ST_Within expression', () => {
    const result = buildTerritoryFilter('location', 'licensed_territories');
    expect(result).toBe('ST_Within(location::geometry, licensed_territories::geometry)');
  });
});
