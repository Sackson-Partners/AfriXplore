import type { HistoricalMine, PaginatedResponse, DigitisationStatus } from '@ain/types';
import type { DatabaseMine } from '@ain/database';
import { MinesRepository } from '../repositories/mines.repository.js';
import { createError } from '../middleware/errorHandler.js';

export interface MineFilters {
  commodity?: string;
  country?: string;
  digitisationStatus?: string;
  systemId?: string;
  minLng?: number;
  minLat?: number;
  maxLng?: number;
  maxLat?: number;
  search?: string;
  page: number;
  pageSize: number;
}

export interface MineCreateInput {
  name: string;
  commodity: string[];
  latitude: number;
  longitude: number;
  country: string;
  hostRock?: string;
  oreGrade?: string;
  miningPeriod?: string;
  closureReason?: string;
  estimatedDepthM?: number;
  archiveSource?: string;
  systemId?: string;
  productionStats?: Record<string, unknown>;
  qualityScore?: number;
  createdBy?: string;
}

function toHistoricalMine(row: DatabaseMine): HistoricalMine {
  return {
    id: row.id,
    name: row.name,
    location: {
      type: 'Point',
      coordinates: [row.longitude ?? 0, row.latitude ?? 0],
    },
    country: row.country,
    commodity: [row.commodity],
    hostRock: null,
    oreGrade: null,
    miningPeriod:
      row.production_start_year != null
        ? row.production_end_year != null
          ? `${row.production_start_year}-${row.production_end_year}`
          : String(row.production_start_year)
        : null,
    closureReason: null,
    estimatedDepthM: null,
    productionStats: null,
    archiveSource: row.source_reference ?? null,
    archiveDocumentUrl: null,
    digitisedBy: null,
    reviewedBy: null,
    digitisationStatus: (row.digitisation_status as DigitisationStatus) ?? 'draft',
    systemId: row.created_by ?? null,
    qualityScore: null,
    rawCoordinates: null,
    aiExtracted: false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class MinesService {
  private repo: MinesRepository;

  constructor(repo?: MinesRepository) {
    this.repo = repo ?? new MinesRepository();
  }

  async list(filters: MineFilters): Promise<PaginatedResponse<HistoricalMine>> {
    const { rows, total } = await this.repo.findAll(filters);
    return {
      data: rows.map(toHistoricalMine),
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      hasNext: filters.page * filters.pageSize < total,
      hasPrevious: filters.page > 1,
      cursor: null,
    };
  }

  async getById(id: string): Promise<HistoricalMine> {
    const row = await this.repo.findById(id);
    if (!row) throw createError(404, 'Mine not found', `No mine with id ${id}`);
    return toHistoricalMine(row);
  }

  async create(input: MineCreateInput): Promise<HistoricalMine> {
    const row = await this.repo.create(input);
    return toHistoricalMine(row);
  }

  async update(id: string, input: Partial<MineCreateInput>): Promise<HistoricalMine> {
    const row = await this.repo.update(id, input);
    if (!row) throw createError(404, 'Mine not found', `No mine with id ${id}`);
    return toHistoricalMine(row);
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.repo.delete(id);
    if (!deleted) throw createError(404, 'Mine not found', `No mine with id ${id}`);
  }

  async listForExport(filters: Omit<MineFilters, 'page' | 'pageSize'>): Promise<DatabaseMine[]> {
    return this.repo.findForExport(filters);
  }
}
