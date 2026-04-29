import type { MsimTarget, PaginatedResponse } from '@ain/types';
import type { DatabaseTarget } from '@ain/database';
import { TargetsRepository } from '../repositories/targets.repository.js';
import { createError } from '../middleware/errorHandler.js';

export interface TargetFilters {
  systemId?: string;
  mineId?: string;
  status?: string;
  page: number;
  pageSize: number;
}

export interface TargetCreateInput {
  mineId?: string;
  systemId?: string;
  name: string;
  status?: string;
  priorityScore?: number;
  latitude?: number;
  longitude?: number;
  geologyRationale?: string;
  recommendedWork?: string;
  estimatedValueUsd?: number;
  assignedGeologistId?: string;
  dueDate?: string;
}

function toMsimTarget(row: DatabaseTarget): MsimTarget {
  return {
    id: row.id,
    systemId: row.system_id ?? null,
    location: {
      type: 'Point',
      coordinates: [row.longitude ?? 0, row.latitude ?? 0],
    },
    licenceBlock: null,
    geologyRationale: row.geology_rationale ?? null,
    riskRank: 3,
    recommendedTest: row.recommended_work ?? null,
    confidenceLevel: 'B',
    dominantMineral: null,
    estimatedGrade: null,
    estimatedTonnage:
      row.estimated_value_usd != null ? `$${row.estimated_value_usd.toLocaleString()}` : null,
    licenceStatus: 'available',
    priorityScore: row.priority_score ?? null,
    technicalReportUrl: null,
    status: (row.target_status === 'completed' ? 'published' : 'draft') as MsimTarget['status'],
    assignedTo: row.assigned_geologist_id ?? null,
    aiGeneratedText: null,
    humanReviewedText: null,
    rankingModelVersion: null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class TargetsService {
  private repo: TargetsRepository;

  constructor(repo?: TargetsRepository) {
    this.repo = repo ?? new TargetsRepository();
  }

  async list(filters: TargetFilters): Promise<PaginatedResponse<MsimTarget>> {
    const { rows, total } = await this.repo.findAll(filters);
    return {
      data: rows.map(toMsimTarget),
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      hasNext: filters.page * filters.pageSize < total,
      hasPrevious: filters.page > 1,
      cursor: null,
    };
  }

  async getById(id: string): Promise<MsimTarget> {
    const row = await this.repo.findById(id);
    if (!row) throw createError(404, 'Target not found', `No target with id ${id}`);
    return toMsimTarget(row);
  }

  async create(input: TargetCreateInput): Promise<MsimTarget> {
    const row = await this.repo.create(input);
    return toMsimTarget(row);
  }

  async update(id: string, input: Partial<TargetCreateInput>): Promise<MsimTarget> {
    const row = await this.repo.update(id, input);
    if (!row) throw createError(404, 'Target not found', `No target with id ${id}`);
    return toMsimTarget(row);
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.repo.delete(id);
    if (!deleted) throw createError(404, 'Target not found', `No target with id ${id}`);
  }
}
