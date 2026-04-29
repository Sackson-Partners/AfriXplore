import { Pool } from 'pg';
import type { DatabaseMine } from '@ain/database';
import { getPool } from '@ain/database';
import type { MineFilters, MineCreateInput } from '../services/mines.service.js';

export class MinesRepository {
  private db: Pool;

  constructor(pool?: Pool) {
    this.db = pool ?? getPool();
  }

  async findAll(
    filters: MineFilters
  ): Promise<{ rows: DatabaseMine[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.commodity) {
      conditions.push(`commodity = $${idx++}`);
      params.push(filters.commodity);
    }
    if (filters.country) {
      conditions.push(`country ILIKE $${idx++}`);
      params.push(`%${filters.country}%`);
    }
    if (filters.digitisationStatus) {
      conditions.push(`digitisation_status = $${idx++}`);
      params.push(filters.digitisationStatus);
    }
    if (filters.systemId) {
      conditions.push(`system_id = $${idx++}`);
      params.push(filters.systemId);
    }
    if (filters.search) {
      conditions.push(`name ILIKE $${idx++}`);
      params.push(`%${filters.search}%`);
    }
    if (
      filters.minLng != null &&
      filters.minLat != null &&
      filters.maxLng != null &&
      filters.maxLat != null
    ) {
      conditions.push(
        `ST_Within(location::geometry, ST_MakeEnvelope($${idx++}, $${idx++}, $${idx++}, $${idx++}, 4326))`
      );
      params.push(filters.minLng, filters.minLat, filters.maxLng, filters.maxLat);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (filters.page - 1) * filters.pageSize;

    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) FROM historical_mines ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await this.db.query<DatabaseMine>(
      `SELECT id, name, commodity, status, digitisation_status,
              ST_X(location::geometry) AS longitude,
              ST_Y(location::geometry) AS latitude,
              country, region, province, area_ha,
              production_start_year, production_end_year,
              estimated_resource_mt, notes, source_reference,
              system_id, created_by, created_at, updated_at
       FROM historical_mines ${where}
       ORDER BY name ASC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, filters.pageSize, offset]
    );

    return { rows: dataResult.rows, total };
  }

  async findById(id: string): Promise<DatabaseMine | null> {
    const result = await this.db.query<DatabaseMine>(
      `SELECT id, name, commodity, status, digitisation_status,
              ST_X(location::geometry) AS longitude,
              ST_Y(location::geometry) AS latitude,
              country, region, province, area_ha,
              production_start_year, production_end_year,
              estimated_resource_mt, notes, source_reference,
              system_id, created_by, created_at, updated_at
       FROM historical_mines WHERE id = $1`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  async create(input: MineCreateInput): Promise<DatabaseMine> {
    const commodity = input.commodity[0] ?? 'other';
    const locationExpr = `ST_GeographyFromText('SRID=4326;POINT(${input.longitude} ${input.latitude})')`;

    const result = await this.db.query<DatabaseMine>(
      `INSERT INTO historical_mines
         (name, commodity, status, digitisation_status, location, country,
          source_reference, system_id, created_by)
       VALUES ($1, $2, 'unknown', 'draft', ${locationExpr}, $3, $4, $5, $6)
       RETURNING id, name, commodity, status, digitisation_status,
                 ST_X(location::geometry) AS longitude,
                 ST_Y(location::geometry) AS latitude,
                 country, region, province, area_ha,
                 production_start_year, production_end_year,
                 estimated_resource_mt, notes, source_reference,
                 system_id, created_by, created_at, updated_at`,
      [
        input.name,
        commodity,
        input.country,
        input.archiveSource ?? null,
        input.systemId ?? null,
        input.createdBy ?? null,
      ]
    );
    return result.rows[0];
  }

  async update(id: string, input: Partial<MineCreateInput>): Promise<DatabaseMine | null> {
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (input.name != null) { fields.push(`name = $${idx++}`); params.push(input.name); }
    if (input.commodity != null) { fields.push(`commodity = $${idx++}`); params.push(input.commodity[0] ?? 'other'); }
    if (input.country != null) { fields.push(`country = $${idx++}`); params.push(input.country); }
    if (input.archiveSource != null) { fields.push(`source_reference = $${idx++}`); params.push(input.archiveSource); }
    if (input.systemId != null) { fields.push(`system_id = $${idx++}`); params.push(input.systemId); }

    if (input.latitude != null && input.longitude != null) {
      fields.push(
        `location = ST_GeographyFromText('SRID=4326;POINT(${input.longitude} ${input.latitude})')`
      );
    }

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = NOW()`);
    params.push(id);

    const result = await this.db.query<DatabaseMine>(
      `UPDATE historical_mines SET ${fields.join(', ')}
       WHERE id = $${idx}
       RETURNING id, name, commodity, status, digitisation_status,
                 ST_X(location::geometry) AS longitude,
                 ST_Y(location::geometry) AS latitude,
                 country, region, province, area_ha,
                 production_start_year, production_end_year,
                 estimated_resource_mt, notes, source_reference,
                 system_id, created_by, created_at, updated_at`,
      params
    );
    return result.rows[0] ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.query('DELETE FROM historical_mines WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async findForExport(filters: Omit<MineFilters, 'page' | 'pageSize'>): Promise<DatabaseMine[]> {
    const result = await this.findAll({ ...filters, page: 1, pageSize: 5000 });
    return result.rows;
  }
}
