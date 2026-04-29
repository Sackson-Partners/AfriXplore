import { Pool } from 'pg';
import type { DatabaseTarget } from '@ain/database';
import { getPool } from '@ain/database';
import type { TargetFilters, TargetCreateInput } from '../services/targets.service.js';

export class TargetsRepository {
  private db: Pool;

  constructor(pool?: Pool) {
    this.db = pool ?? getPool();
  }

  async findAll(filters: TargetFilters): Promise<{ rows: DatabaseTarget[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.systemId) {
      conditions.push(`system_id = $${idx++}`);
      params.push(filters.systemId);
    }
    if (filters.mineId) {
      conditions.push(`mine_id = $${idx++}`);
      params.push(filters.mineId);
    }
    if (filters.status) {
      conditions.push(`target_status = $${idx++}`);
      params.push(filters.status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (filters.page - 1) * filters.pageSize;

    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) FROM msim_targets ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await this.db.query<DatabaseTarget>(
      `SELECT id, mine_id, system_id, name, target_status, priority_score,
              ST_X(location::geometry) AS longitude,
              ST_Y(location::geometry) AS latitude,
              geology_rationale, recommended_work, estimated_value_usd,
              assigned_geologist_id, due_date, created_at, updated_at
       FROM msim_targets ${where}
       ORDER BY priority_score DESC NULLS LAST
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, filters.pageSize, offset]
    );

    return { rows: dataResult.rows, total };
  }

  async findById(id: string): Promise<DatabaseTarget | null> {
    const result = await this.db.query<DatabaseTarget>(
      `SELECT id, mine_id, system_id, name, target_status, priority_score,
              ST_X(location::geometry) AS longitude,
              ST_Y(location::geometry) AS latitude,
              geology_rationale, recommended_work, estimated_value_usd,
              assigned_geologist_id, due_date, created_at, updated_at
       FROM msim_targets WHERE id = $1`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  async create(input: TargetCreateInput): Promise<DatabaseTarget> {
    const locationExpr =
      input.latitude != null && input.longitude != null
        ? `ST_GeographyFromText('SRID=4326;POINT(${input.longitude} ${input.latitude})')`
        : 'NULL';

    const result = await this.db.query<DatabaseTarget>(
      `INSERT INTO msim_targets
         (mine_id, system_id, name, target_status, priority_score, location,
          geology_rationale, recommended_work, estimated_value_usd, assigned_geologist_id, due_date)
       VALUES ($1, $2, $3, $4, $5, ${locationExpr}, $6, $7, $8, $9, $10)
       RETURNING id, mine_id, system_id, name, target_status, priority_score,
                 ST_X(location::geometry) AS longitude,
                 ST_Y(location::geometry) AS latitude,
                 geology_rationale, recommended_work, estimated_value_usd,
                 assigned_geologist_id, due_date, created_at, updated_at`,
      [
        input.mineId ?? null,
        input.systemId ?? null,
        input.name,
        input.status ?? 'identified',
        input.priorityScore ?? null,
        input.geologyRationale ?? null,
        input.recommendedWork ?? null,
        input.estimatedValueUsd ?? null,
        input.assignedGeologistId ?? null,
        input.dueDate ?? null,
      ]
    );
    return result.rows[0];
  }

  async update(id: string, input: Partial<TargetCreateInput>): Promise<DatabaseTarget | null> {
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (input.name != null) { fields.push(`name = $${idx++}`); params.push(input.name); }
    if (input.status != null) { fields.push(`target_status = $${idx++}`); params.push(input.status); }
    if (input.priorityScore != null) { fields.push(`priority_score = $${idx++}`); params.push(input.priorityScore); }
    if (input.geologyRationale != null) { fields.push(`geology_rationale = $${idx++}`); params.push(input.geologyRationale); }
    if (input.recommendedWork != null) { fields.push(`recommended_work = $${idx++}`); params.push(input.recommendedWork); }
    if (input.systemId != null) { fields.push(`system_id = $${idx++}`); params.push(input.systemId); }

    if (input.latitude != null && input.longitude != null) {
      fields.push(
        `location = ST_GeographyFromText('SRID=4326;POINT(${input.longitude} ${input.latitude})')`
      );
    }

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = NOW()`);
    params.push(id);

    const result = await this.db.query<DatabaseTarget>(
      `UPDATE msim_targets SET ${fields.join(', ')}
       WHERE id = $${idx}
       RETURNING id, mine_id, system_id, name, target_status, priority_score,
                 ST_X(location::geometry) AS longitude,
                 ST_Y(location::geometry) AS latitude,
                 geology_rationale, recommended_work, estimated_value_usd,
                 assigned_geologist_id, due_date, created_at, updated_at`,
      params
    );
    return result.rows[0] ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.query('DELETE FROM msim_targets WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
