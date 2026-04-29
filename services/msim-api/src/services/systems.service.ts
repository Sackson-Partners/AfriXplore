import type { MineralSystem, PaginatedResponse } from '@ain/types';
import type { DatabaseSystem } from '@ain/database';
import { SystemsRepository } from '../repositories/systems.repository.js';
import { createError } from '../middleware/errorHandler.js';

export interface SystemFilters {
  country?: string;
  systemType?: string;
  isPublished?: boolean;
  page: number;
  pageSize: number;
}

export interface SystemCreateInput {
  name: string;
  systemType: string;
  description?: string;
  commodities: string[];
  country: string;
  areaKm2?: number;
  confidenceLevel?: number;
  dataSources?: string[];
  isPublished?: boolean;
}

function toMineralSystem(row: DatabaseSystem): MineralSystem {
  return {
    id: row.id,
    name: row.name,
    type: row.system_type as MineralSystem['type'],
    country: Array.isArray(row.country) ? row.country as unknown as string[] : [row.country],
    commodity: row.commodities,
    heatSource: null,
    fluidPathway: null,
    trapMechanism: null,
    footprint: null,
    alterationTypes: row.data_sources ?? [],
    ageMa: null,
    prospectivityScore: row.confidence_level != null ? row.confidence_level * 20 : null,
    geologicalCrossSectionUrl: null,
    createdBy: null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SystemsService {
  private repo: SystemsRepository;

  constructor(repo?: SystemsRepository) {
    this.repo = repo ?? new SystemsRepository();
  }

  async list(filters: SystemFilters): Promise<PaginatedResponse<MineralSystem>> {
    const { rows, total } = await this.repo.findAll(filters);
    return {
      data: rows.map(toMineralSystem),
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      hasNext: filters.page * filters.pageSize < total,
      hasPrevious: filters.page > 1,
      cursor: null,
    };
  }

  async getById(id: string): Promise<MineralSystem> {
    const row = await this.repo.findById(id);
    if (!row) throw createError(404, 'Mineral system not found', `No system with id ${id}`);
    return toMineralSystem(row);
  }

  async create(input: SystemCreateInput): Promise<MineralSystem> {
    const row = await this.repo.create(input);
    return toMineralSystem(row);
  }

  async update(id: string, input: Partial<SystemCreateInput>): Promise<MineralSystem> {
    const row = await this.repo.update(id, input);
    if (!row) throw createError(404, 'Mineral system not found', `No system with id ${id}`);
    return toMineralSystem(row);
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.repo.delete(id);
    if (!deleted) throw createError(404, 'Mineral system not found', `No system with id ${id}`);
  }
}
