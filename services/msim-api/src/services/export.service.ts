import type { AinFeatureCollection, HistoricalMine } from '@ain/types';
import type { DatabaseMine } from '@ain/database';
import { MinesRepository } from '../repositories/mines.repository.js';
import { createError } from '../middleware/errorHandler.js';

export type ExportFormat = 'geojson' | 'csv';

export class ExportService {
  private minesRepo: MinesRepository;

  constructor(repo?: MinesRepository) {
    this.minesRepo = repo ?? new MinesRepository();
  }

  async exportMines(
    format: ExportFormat,
    filters: {
      commodity?: string;
      country?: string;
      minLng?: number;
      minLat?: number;
      maxLng?: number;
      maxLat?: number;
    }
  ): Promise<{ data: string; contentType: string; filename: string }> {
    const rows = await this.minesRepo.findForExport(filters);

    if (rows.length === 0) {
      throw createError(404, 'No mines found', 'No mines match the specified filters');
    }

    if (format === 'csv') {
      return {
        data: this.toCsv(rows),
        contentType: 'text/csv',
        filename: 'ain-mines-export.csv',
      };
    }

    return {
      data: JSON.stringify(this.toGeoJson(rows), null, 2),
      contentType: 'application/geo+json',
      filename: 'ain-mines-export.geojson',
    };
  }

  private toGeoJson(rows: DatabaseMine[]): AinFeatureCollection<HistoricalMine> {
    const features = rows
      .filter((r) => r.latitude != null && r.longitude != null)
      .map((r) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [r.longitude!, r.latitude!],
        },
        properties: {
          id: r.id,
          name: r.name,
          commodity: [r.commodity],
          digitisationStatus: r.digitisation_status,
          country: r.country,
          location: { type: 'Point' as const, coordinates: [r.longitude!, r.latitude!] },
          hostRock: null, oreGrade: null, miningPeriod: null, closureReason: null,
          estimatedDepthM: null, productionStats: null, archiveSource: r.source_reference ?? null,
          archiveDocumentUrl: null, digitisedBy: null, reviewedBy: null,
          systemId: null, qualityScore: null, rawCoordinates: null, aiExtracted: false,
          createdAt: r.created_at, updatedAt: r.updated_at,
        } as HistoricalMine,
      }));

    const lngs = features.map((f) => f.geometry.coordinates[0]);
    const lats = features.map((f) => f.geometry.coordinates[1]);

    const bbox: [number, number, number, number] = lngs.length > 0
      ? [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)]
      : [0, 0, 0, 0];

    return {
      type: 'FeatureCollection',
      bbox,
      crs: { type: 'name', properties: { name: 'EPSG:4326' } },
      metadata: {
        generatedAt: new Date().toISOString(),
        recordCount: features.length,
        exportedBy: 'AIN MSIM API',
        disclaimer: 'Data is provided for informational purposes only. AIN makes no warranty as to accuracy.',
      },
      features,
    };
  }

  private toCsv(rows: DatabaseMine[]): string {
    const headers = [
      'id', 'name', 'commodity', 'status', 'digitisation_status',
      'latitude', 'longitude', 'country', 'region', 'province',
      'area_ha', 'production_start_year', 'production_end_year',
      'estimated_resource_mt', 'source_reference', 'created_at',
    ];
    const escape = (v: unknown) => {
      if (v == null) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const body = rows.map((r) =>
      [
        r.id, r.name, r.commodity, r.status, r.digitisation_status,
        r.latitude, r.longitude, r.country, r.region, r.province,
        r.area_ha, r.production_start_year, r.production_end_year,
        r.estimated_resource_mt, r.source_reference, r.created_at,
      ].map(escape).join(',')
    );
    return [headers.join(','), ...body].join('\n');
  }
}
