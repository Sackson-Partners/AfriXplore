-- Seed: 3 mineral systems, 10 historical mines, 5 MSIM targets
-- All coordinates are real locations in Southern/Central Africa

INSERT INTO mineral_systems (id, name, system_type, description, commodities, country, area_km2, confidence_level, is_published)
VALUES
  ('a1b2c3d4-0001-0001-0001-000000000001',
   'Witwatersrand Gold Belt',
   'orogenic_gold',
   'World''s largest gold deposit, Mesoarchean sedimentary basin in South Africa',
   ARRAY['gold', 'uranium'],
   'South Africa',
   35000.00,
   5,
   TRUE),

  ('a1b2c3d4-0002-0002-0002-000000000002',
   'Copperbelt Sediment-Hosted System',
   'sediment_hosted_copper',
   'Central African Copperbelt spanning DRC and Zambia, Neoproterozoic ore deposits',
   ARRAY['copper', 'cobalt'],
   'DRC',
   80000.00,
   5,
   TRUE),

  ('a1b2c3d4-0003-0003-0003-000000000003',
   'Zimbabwe Great Dyke',
   'other',
   'Proterozoic layered igneous intrusion, world''s largest PGM deposit',
   ARRAY['platinum', 'palladium', 'chrome', 'nickel'],
   'Zimbabwe',
   3300.00,
   5,
   TRUE);


INSERT INTO historical_mines (id, name, commodity, status, digitisation_status, location, country, region, production_start_year, production_end_year, system_id)
VALUES
  ('b1b2c3d4-0001-0001-0001-000000000001',
   'Mponeng Gold Mine',
   'gold', 'active', 'published',
   ST_GeographyFromText('SRID=4326;POINT(27.3667 -26.4167)'),
   'South Africa', 'Gauteng', 1986, NULL,
   'a1b2c3d4-0001-0001-0001-000000000001'),

  ('b1b2c3d4-0002-0002-0002-000000000002',
   'TauTona Mine',
   'gold', 'inactive', 'published',
   ST_GeographyFromText('SRID=4326;POINT(27.3833 -26.4500)'),
   'South Africa', 'Gauteng', 1962, 2018,
   'a1b2c3d4-0001-0001-0001-000000000001'),

  ('b1b2c3d4-0003-0003-0003-000000000003',
   'Kloof Gold Mine',
   'gold', 'active', 'published',
   ST_GeographyFromText('SRID=4326;POINT(27.3167 -26.3833)'),
   'South Africa', 'Gauteng', 1968, NULL,
   'a1b2c3d4-0001-0001-0001-000000000001'),

  ('b1b2c3d4-0004-0004-0004-000000000004',
   'Kamoto Copper Mine',
   'copper', 'active', 'published',
   ST_GeographyFromText('SRID=4326;POINT(25.3333 -10.8667)'),
   'DRC', 'Lualaba', 1979, NULL,
   'a1b2c3d4-0002-0002-0002-000000000002'),

  ('b1b2c3d4-0005-0005-0005-000000000005',
   'Tenke Fungurume',
   'copper', 'active', 'published',
   ST_GeographyFromText('SRID=4326;POINT(26.1167 -10.6167)'),
   'DRC', 'Lualaba', 2009, NULL,
   'a1b2c3d4-0002-0002-0002-000000000002'),

  ('b1b2c3d4-0006-0006-0006-000000000006',
   'Mutanda Copper Mine',
   'copper', 'active', 'published',
   ST_GeographyFromText('SRID=4326;POINT(26.7000 -10.5500)'),
   'DRC', 'Lualaba', 2010, NULL,
   'a1b2c3d4-0002-0002-0002-000000000002'),

  ('b1b2c3d4-0007-0007-0007-000000000007',
   'Nkana Copper Mine',
   'copper', 'active', 'published',
   ST_GeographyFromText('SRID=4326;POINT(28.2167 -12.8167)'),
   'Zambia', 'Copperbelt', 1932, NULL,
   'a1b2c3d4-0002-0002-0002-000000000002'),

  ('b1b2c3d4-0008-0008-0008-000000000008',
   'Mimosa Platinum Mine',
   'platinum', 'active', 'published',
   ST_GeographyFromText('SRID=4326;POINT(29.8333 -20.2000)'),
   'Zimbabwe', 'Midlands', 1993, NULL,
   'a1b2c3d4-0003-0003-0003-000000000003'),

  ('b1b2c3d4-0009-0009-0009-000000000009',
   'Ngezi Platinum Mine',
   'platinum', 'active', 'published',
   ST_GeographyFromText('SRID=4326;POINT(29.5833 -18.8167)'),
   'Zimbabwe', 'Mashonaland West', 2001, NULL,
   'a1b2c3d4-0003-0003-0003-000000000003'),

  ('b1b2c3d4-0010-0010-0010-000000000010',
   'Hartley Platinum Project',
   'platinum', 'inactive', 'published',
   ST_GeographyFromText('SRID=4326;POINT(30.0167 -18.2000)'),
   'Zimbabwe', 'Mashonaland West', 1997, 2000,
   'a1b2c3d4-0003-0003-0003-000000000003');


INSERT INTO msim_targets (id, name, target_status, priority_score, location, geology_rationale, recommended_work, mine_id, system_id)
VALUES
  ('c1b2c3d4-0001-0001-0001-000000000001',
   'West Rand Extension Target',
   'approved', 8.5,
   ST_GeographyFromText('SRID=4326;POINT(27.2500 -26.5000)'),
   'Modelling of basement topology suggests Witwatersrand sediments extend 4km westward at economically viable depths (2800-3200m)',
   'Drill 3x RC holes to 3500m depth to confirm reef intersection; conduct 3D seismic survey of 15km² area',
   'b1b2c3d4-0001-0001-0001-000000000001',
   'a1b2c3d4-0001-0001-0001-000000000001'),

  ('c1b2c3d4-0002-0002-0002-000000000002',
   'Kolwezi Cobalt-Rich Corridor',
   'under_review', 9.0,
   ST_GeographyFromText('SRID=4326;POINT(25.4667 -10.7167)'),
   'Soil geochemistry anomalies and IP survey results indicate cobalt-rich stratabound horizon between known Kamoto and Tenke deposits',
   'Phase 1: detailed EM survey; Phase 2: 12 diamond drill holes at 250m spacing',
   NULL,
   'a1b2c3d4-0002-0002-0002-000000000002'),

  ('c1b2c3d4-0003-0003-0003-000000000003',
   'Northern Great Dyke Palladium Anomaly',
   'identified', 7.2,
   ST_GeographyFromText('SRID=4326;POINT(30.2000 -16.5000)'),
   'Airborne magnetic survey reveals untested dunite pipe with palladium:platinum ratio of 3:1, similar to the economically significant Munni Munni deposit',
   'Surface mapping and sampling program; geophysical survey; 4 scout drill holes',
   NULL,
   'a1b2c3d4-0003-0003-0003-000000000003'),

  ('c1b2c3d4-0004-0004-0004-000000000004',
   'Kitwe North Copper Porphyry',
   'in_progress', 6.8,
   ST_GeographyFromText('SRID=4326;POINT(28.2000 -12.7500)'),
   'Gravity and magnetic anomalies 8km north of Nkana mine indicate a buried porphyry system at ~500m depth',
   'Infill IP survey; 6 diamond drill holes to 600m depth; QEMSCAN on any mineralised intersections',
   'b1b2c3d4-0007-0007-0007-000000000007',
   'a1b2c3d4-0002-0002-0002-000000000002'),

  ('c1b2c3d4-0005-0005-0005-000000000005',
   'Ventersdorp Contact Reef Extension',
   'identified', 7.9,
   ST_GeographyFromText('SRID=4326;POINT(27.4500 -26.5833)'),
   'Structural interpretation of 3D seismic data indicates the VCR projects into an undrilled anticlinal closure 6km SE of TauTona',
   'Detailed 3D seismic reprocessing; 2 deep exploration holes to 3200m',
   'b1b2c3d4-0002-0002-0002-000000000002',
   'a1b2c3d4-0001-0001-0001-000000000001');
