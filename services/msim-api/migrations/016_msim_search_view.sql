-- 016_msim_search_view.sql
-- Unified search materialized view across regions, companies, concessions, and records.
-- refresh_msim_search_mv() uses CONCURRENTLY to avoid locking reads during refresh.

CREATE MATERIALIZED VIEW msim_search_mv AS
SELECT
  r.id,
  'region'   AS entity_type,
  r.name     AS title,
  r.country,
  NULL::UUID AS mine_id,
  NULL::UUID AS concession_id,
  NULL::UUID AS company_id,
  r.search_vector,
  r.created_at
FROM msim_regions r
UNION ALL
SELECT
  c.id,
  'company',
  c.name,
  c.country_of_origin,
  NULL, NULL, c.id,
  c.search_vector,
  c.created_at
FROM msim_mining_companies c
UNION ALL
SELECT
  con.id,
  'concession',
  con.name,
  con.country,
  NULL, con.id, con.company_id,
  con.search_vector,
  con.created_at
FROM msim_concessions con
UNION ALL
SELECT
  rec.id,
  'record',
  rec.title,
  hm.country,
  rec.mine_id, rec.concession_id, rec.company_id,
  rec.search_vector,
  rec.created_at
FROM msim_mining_records rec
JOIN historical_mines hm ON hm.id = rec.mine_id;

CREATE UNIQUE INDEX idx_msim_search_mv_pk      ON msim_search_mv(id, entity_type);
CREATE INDEX        idx_msim_search_mv_vector  ON msim_search_mv USING GIN(search_vector);
CREATE INDEX        idx_msim_search_mv_type    ON msim_search_mv(entity_type);
CREATE INDEX        idx_msim_search_mv_country ON msim_search_mv(country);

CREATE OR REPLACE FUNCTION refresh_msim_search_mv()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY msim_search_mv;
END;
$$ LANGUAGE plpgsql;
