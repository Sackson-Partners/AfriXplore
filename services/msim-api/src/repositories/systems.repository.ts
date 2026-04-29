import { Pool } from 'pg';
import type { DatabaseSystem } from '@ain/database';
import { getPool } from '@ain/database';
import type { SystemFilters, SystemCreateInput } from '../services/systems.service.js';

export class SystemsRepository {
  private db: Pool;

  constructor(pool?: Pool) {
    this.db = pool ?? getPool();
  }

  async findAll(filters: SystemFilters): Promise<{ rows: DatabaseSystem[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.country) {
      conditions.push(`country ILIKE $${idx++}`);
      params.push(`%${filters.country}%`);
    }
    if (filters.systemType) {
      conditions.push(`system_type = $${idx++}`);
      params.push(filters.systemType);
    }
    if (filters.isPublished !== undefined) {
      conditions.push(`is_published = $${idx++}`);
      params.push(filters.isPublished);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (filters.page - 1) * filters.pageSize;

    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) FROM mineral_systems ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await this.db.query<DatabaseSystem>(
      `SELECT id, name, system_type, description, commodities,
              country, area_km2, confidence_level, data_sources, is_published,
              created_at, updated_at
       FROM mineral_systems ${where}
       ORDER BY name ASC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, filters.pageSize, offset]
    );

    return { rows: dataResult.rows, total };
  }

  async findById(id: string): Promise<DatabaseSystem | null> {
    const result = await this.db.query<DatabaseSystem>(
      `SELECT id, name, system_type, description, commodities,
              country, area_km2, confidence_level, data_sources, is_published,
              created_at, updated_at
       FROM mineral_systems WHERE id = $1`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  async create(input: SystemCreateInput): Promise<DatabaseSystem> {
    const result = await this.db.query<DatabaseSystem>(
      `INSERT INTO mineral_systems
         (name, system_type, description, commodities, country, area_km2,
          confidence_level, data_sources, is_published)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, name, system_type, description, commodities,
                 country, area_km2, confidence_level, data_sources, is_published,
                 created_at, updated_at`,
      [
        input.name,
        input.systemType,
        input.description ?? null,
        input.commodities,
        input.country,
        input.areaKm2 ?? null,
        input.confidenceLevel ?? null,
        input.dataSources ?? null,
        input.isPublished ?? false,
      ]
    );
    return result.rows[0];
  }

  async update(id: string, input: Partial<SystemCreateInput>): Promise<DatabaseSystem | null> {
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (input.name != null) { fields.push(`name = $${idx++}`); params.push(input.name); }
    if (input.systemType != null) { fields.push(`system_type = $${idx++}`); params.push(input.systemType); }
    if (input.description != null) { fields.push(`description = $${idx++}`); params.push(input.description); }
    if (input.commodities != null) { fields.push(`commodities = $${idx++}`); params.push(input.commodities); }
    if (input.country != null) { fields.push(`country = $${idx++}`); params.push(input.country); }
    if (input.isPublished != null) { fields.push(`is_published = $${idx++}`); params.push(input.isPublished); }

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = NOW()`);
    params.push(id);

    const result = await this.db.query<DatabaseSystem>(
      `UPDATE mineral_systems SET ${fields.join(', ')}
       WHERE id = $${idx}
       RETURNING id, name, system_type, description, commodities,
                 country, area_km2, confidence_level, data_sources, is_published,
                 created_at, updated_at`,
      params
    );
    return result.rows[0] ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.query('DELETE FROM mineral_systems WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
