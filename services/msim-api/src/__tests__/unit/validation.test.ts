import { describe, it, expect } from 'vitest';
import {
  CreateMineSchema,
  UpdateMineSchema,
  MineQuerySchema,
  ExportQuerySchema,
  UUIDSchema,
  PaginationSchema,
} from '@ain/validation';

describe('UUIDSchema', () => {
  it('accepts a valid UUID v4', () => {
    expect(() => UUIDSchema.parse('550e8400-e29b-41d4-a716-446655440000')).not.toThrow();
  });

  it('rejects a non-UUID string', () => {
    expect(() => UUIDSchema.parse('not-a-uuid')).toThrow();
  });
});

describe('PaginationSchema', () => {
  it('defaults page to 1 and pageSize to 20', () => {
    const result = PaginationSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it('coerces string numbers', () => {
    const result = PaginationSchema.parse({ page: '3', pageSize: '50' });
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(50);
  });

  it('rejects pageSize > 100', () => {
    expect(() => PaginationSchema.parse({ pageSize: 101 })).toThrow();
  });
});

describe('CreateMineSchema', () => {
  const valid = {
    name: 'Mponeng',
    latitude: -26.42,
    longitude: 27.37,
    country: 'South Africa',
    commodity: ['gold'],
  };

  it('accepts a minimal valid mine', () => {
    expect(() => CreateMineSchema.parse(valid)).not.toThrow();
  });

  it('requires at least one commodity', () => {
    expect(() => CreateMineSchema.parse({ ...valid, commodity: [] })).toThrow();
  });

  it('rejects invalid commodity values', () => {
    expect(() => CreateMineSchema.parse({ ...valid, commodity: ['unobtanium'] })).toThrow();
  });

  it('rejects name shorter than 2 chars', () => {
    expect(() => CreateMineSchema.parse({ ...valid, name: 'A' })).toThrow();
  });

  it('validates miningPeriod format', () => {
    expect(() => CreateMineSchema.parse({ ...valid, miningPeriod: '1920' })).not.toThrow();
    expect(() => CreateMineSchema.parse({ ...valid, miningPeriod: '1920-1947' })).not.toThrow();
    expect(() => CreateMineSchema.parse({ ...valid, miningPeriod: '20th century' })).toThrow();
  });
});

describe('UpdateMineSchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    expect(() => UpdateMineSchema.parse({})).not.toThrow();
  });

  it('validates partial updates', () => {
    expect(() => UpdateMineSchema.parse({ name: 'New Name', commodity: ['copper'] })).not.toThrow();
  });
});

describe('MineQuerySchema', () => {
  it('uses defaults when no query params given', () => {
    const result = MineQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it('accepts valid bbox params', () => {
    const result = MineQuerySchema.parse({ minLng: '20', minLat: '-30', maxLng: '35', maxLat: '-10' });
    expect(result.minLng).toBe(20);
    expect(result.maxLat).toBe(-10);
  });
});

describe('ExportQuerySchema', () => {
  it('accepts geojson format', () => {
    expect(() => ExportQuerySchema.parse({ format: 'geojson' })).not.toThrow();
  });

  it('accepts csv format', () => {
    expect(() => ExportQuerySchema.parse({ format: 'csv' })).not.toThrow();
  });

  it('rejects unknown format', () => {
    expect(() => ExportQuerySchema.parse({ format: 'xml' })).toThrow();
  });
});
