-- seeds/001_msim_colonial_data.sql
-- MSIM Phase 1 seed data: colonial African mining history
-- 5 regions, 5 companies, 8 concessions, 15 records, 20 extractions

-- ─── REGIONS (5) ────────────────────────────────────────────────────────────

INSERT INTO msim_regions (id, name, country, colonial_name, modern_name, description, area_km2, metadata) VALUES
  ('a1000000-0000-0000-0000-000000000001',
   'Katanga Mining Zone', 'DRC',
   'Katanga Province', 'Haut-Katanga',
   'Major copper and cobalt belt in southern Congo under Belgian colonial administration. Site of world-class copper deposits exploited from the early 20th century.',
   496965,
   '{"colonial_period":"1908-1960","colonial_power":"Belgium","peak_output_year":1958}'
  ),
  ('a1000000-0000-0000-0000-000000000002',
   'Witwatersrand Gold Fields', 'ZAF',
   'South African Republic', 'Gauteng',
   'World richest gold reef discovered in 1886. Its exploitation drove massive capital inflows, the Anglo-Boer Wars, and formation of the Union of South Africa.',
   19485,
   '{"colonial_period":"1886-1910","colonial_power":"Britain/Transvaal","discovery_year":1886}'
  ),
  ('a1000000-0000-0000-0000-000000000003',
   'Gold Coast Ashanti Belt', 'GHA',
   'Gold Coast', 'Ashanti Region',
   'Historic Ashanti gold territory brought under British protectorate in 1900. The Obuasi mine alone produced over 25 million ounces through the colonial period.',
   24389,
   '{"colonial_period":"1900-1957","colonial_power":"Britain","independence_year":1957}'
  ),
  ('a1000000-0000-0000-0000-000000000004',
   'Northern Rhodesia Copperbelt', 'ZMB',
   'Northern Rhodesia', 'Copperbelt Province',
   'Copper-rich territory administered by the British South Africa Company. Commercial copper mining began in the 1930s, transforming the territory into one of Africa greatest producers.',
   31328,
   '{"colonial_period":"1890-1964","colonial_power":"Britain/BSAC","independence_year":1964}'
  ),
  ('a1000000-0000-0000-0000-000000000005',
   'Sierra Leone Diamond Fields', 'SLE',
   'Sierra Leone Colony', 'Kono District',
   'Alluvial diamond deposits discovered in 1930. Exclusive prospecting rights held by a De Beers subsidiary until independence. Later a flashpoint for conflict diamond trade.',
   5641,
   '{"colonial_period":"1930-1961","colonial_power":"Britain","independence_year":1961}'
  );

-- ─── COMPANIES (5) ───────────────────────────────────────────────────────────

INSERT INTO msim_mining_companies
  (id, name, colonial_name, country_of_origin, founding_year, dissolution_year, description, known_minerals, active_regions, metadata)
VALUES
  ('b2000000-0000-0000-0000-000000000001',
   'Union Minière du Haut Katanga', 'Union Minière du Haut Katanga',
   'BEL', 1906, 1966,
   'Belgian state-backed conglomerate that dominated Katanga copper and cobalt output for five decades. Also the primary supplier of uranium ore used in the Manhattan Project via Shinkolobwe.',
   ARRAY['copper','cobalt','uranium','radium'],
   ARRAY['Katanga Mining Zone'],
   '{"successor":"Gécamines","hq":"Brussels","stock_exchange":"Brussels"}'
  ),
  ('b2000000-0000-0000-0000-000000000002',
   'Rand Mines Ltd', 'Rand Mines Ltd',
   'ZAF', 1893, 1970,
   'Pioneer Witwatersrand gold producer operating multiple reef mines in the Johannesburg area. Part of the Corner House financial group controlled by Wernher, Beit & Co.',
   ARRAY['gold','silver'],
   ARRAY['Witwatersrand Gold Fields'],
   '{"group":"Corner House","founders":"Wernher Beit"}'
  ),
  ('b2000000-0000-0000-0000-000000000003',
   'Ashanti Goldfields Corporation', 'Ashanti Goldfields Ltd',
   'GBR', 1897, 2004,
   'British colonial gold mining company established to operate the Obuasi mine in the Gold Coast. Survived independence and eventually merged to form AngloGold Ashanti in 2004.',
   ARRAY['gold'],
   ARRAY['Gold Coast Ashanti Belt'],
   '{"successor":"AngloGold Ashanti","mine":"Obuasi"}'
  ),
  ('b2000000-0000-0000-0000-000000000004',
   'Rhokana Corporation', 'Rhokana Corporation',
   'GBR', 1931, 1973,
   'Major copper producer in Northern Rhodesia, operating the Nkana mine at Kitwe. A subsidiary of the Anglo American–Rhodesian Selection Trust interests.',
   ARRAY['copper','cobalt'],
   ARRAY['Northern Rhodesia Copperbelt'],
   '{"successor":"NCCM","mine":"Nkana","parent":"Anglo American"}'
  ),
  ('b2000000-0000-0000-0000-000000000005',
   'Sierra Leone Selection Trust', 'Sierra Leone Selection Trust',
   'GBR', 1934, 1970,
   'De Beers subsidiary holding exclusive alluvial diamond prospecting rights across Sierra Leone from 1934 to 1956, when mounting illicit mining pressure forced partial liberalisation.',
   ARRAY['diamond'],
   ARRAY['Sierra Leone Diamond Fields'],
   '{"parent":"De Beers","rights_end":1956}'
  );

-- ─── CONCESSIONS (8) ─────────────────────────────────────────────────────────

INSERT INTO msim_concessions
  (id, name, colonial_name, region_id, company_id, country, district, granted_year, revoked_year, area_ha, minerals, status, source_reference, metadata)
VALUES
  ('c3000000-0000-0000-0000-000000000001',
   'Lubumbashi Copper Concession', 'Elizabethville Block A',
   'a1000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001',
   'DRC', 'Lubumbashi', 1910, 1960, 45000,
   ARRAY['copper','cobalt'], 'historical',
   'Belgian Congo Mining Gazette 1910, ref BCM-1910-004',
   '{"gazette_ref":"BCM-1910-004","smelter":"Lubumbashi"}'
  ),
  ('c3000000-0000-0000-0000-000000000002',
   'Shinkolobwe Uranium Concession', 'Shinkolobwe Mine',
   'a1000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001',
   'DRC', 'Kambove', 1915, 1960, 8200,
   ARRAY['uranium','radium'], 'historical',
   'Katanga Mining Reports Vol.3, 1915',
   '{"strategic":"Manhattan Project uranium supply","ore_grade_pct":65}'
  ),
  ('c3000000-0000-0000-0000-000000000003',
   'Crown Mines Gold Grant', 'Crown Mines Ltd',
   'a1000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000002',
   'ZAF', 'Johannesburg', 1897, 1952, 12500,
   ARRAY['gold'], 'historical',
   'Transvaal Mining Leases Register, Lease 1897-044',
   '{"depth_m":3400,"reef":"Carbon Leader"}'
  ),
  ('c3000000-0000-0000-0000-000000000004',
   'Obuasi Gold Concession', 'Obuasi Lease',
   'a1000000-0000-0000-0000-000000000003', 'b2000000-0000-0000-0000-000000000003',
   'GHA', 'Obuasi', 1897, 2004, 5130,
   ARRAY['gold'], 'historical',
   'Gold Coast Government Gazette, 1 March 1897',
   '{"mine":"Obuasi","total_production_oz":25000000}'
  ),
  ('c3000000-0000-0000-0000-000000000005',
   'Bibiani Gold Concession', 'Bibiani Mine Grant',
   'a1000000-0000-0000-0000-000000000003', NULL,
   'GHA', 'Bibiani', 1902, 1958, 2870,
   ARRAY['gold','silver'], 'historical',
   'Gold Coast Mining Journal, 1902 Issue 4',
   '{"notes":"Operated by multiple lessees over colonial period"}'
  ),
  ('c3000000-0000-0000-0000-000000000006',
   'Nkana Copper Block', 'Nkana Mine Area',
   'a1000000-0000-0000-0000-000000000004', 'b2000000-0000-0000-0000-000000000004',
   'ZMB', 'Kitwe', 1931, 1973, 22100,
   ARRAY['copper','cobalt'], 'historical',
   'BSAC Mineral Rights Register, Northern Rhodesia 1931',
   '{"mine":"Nkana","depth_m":1800}'
  ),
  ('c3000000-0000-0000-0000-000000000007',
   'Mufulira Copper Concession', 'Mufulira Block',
   'a1000000-0000-0000-0000-000000000004', 'b2000000-0000-0000-0000-000000000004',
   'ZMB', 'Mufulira', 1933, 1973, 18400,
   ARRAY['copper'], 'historical',
   'BSAC Mineral Rights Register, Northern Rhodesia 1933',
   '{}'
  ),
  ('c3000000-0000-0000-0000-000000000008',
   'Yengema Diamond Concession', 'Yengema Block',
   'a1000000-0000-0000-0000-000000000005', 'b2000000-0000-0000-0000-000000000005',
   'SLE', 'Kono', 1934, 1970, 31000,
   ARRAY['diamond'], 'historical',
   'Sierra Leone Gazette, Supplement No. 12, 1934',
   '{"alluvial":true,"carats_annual_peak":2000000}'
  );

-- ─── MINING RECORDS (15) ─────────────────────────────────────────────────────
-- Uses historical_mine IDs from migration 010 seed data

INSERT INTO msim_mining_records
  (id, mine_id, concession_id, company_id, title, record_date, record_type, description, quantity_mt, notes, source_reference, confidence_score, metadata)
VALUES
  -- Kamoto Copper Mine (DRC) – 5 records
  ('d4000000-0000-0000-0000-000000000001',
   'b1b2c3d4-0004-0004-0004-000000000004',
   'c3000000-0000-0000-0000-000000000001',
   'b2000000-0000-0000-0000-000000000001',
   'Lubumbashi Annual Production Report 1920',
   '1920-12-31', 'production',
   'Annual copper production figures submitted to Belgian colonial administration.',
   45200.0, 'Figures verified against colonial export manifests.',
   'BCM Annual Report 1920, p.47', 0.90,
   '{"currency":"Belgian Franc","export_port":"Lobito"}'
  ),
  ('d4000000-0000-0000-0000-000000000002',
   'b1b2c3d4-0004-0004-0004-000000000004',
   'c3000000-0000-0000-0000-000000000001',
   'b2000000-0000-0000-0000-000000000001',
   'Lubumbashi Annual Production Report 1930',
   '1930-12-31', 'production',
   'Decade-high copper output driven by expanded smelting capacity at Lubumbashi.',
   112400.0, 'Cross-referenced with London Metal Exchange records.',
   'BCM Annual Report 1930, p.62', 0.92,
   '{"currency":"Belgian Franc","smelter_capacity_mt":150000}'
  ),
  ('d4000000-0000-0000-0000-000000000003',
   'b1b2c3d4-0004-0004-0004-000000000004',
   'c3000000-0000-0000-0000-000000000002',
   'b2000000-0000-0000-0000-000000000001',
   'Shinkolobwe Uranium Ore Shipment — 1943',
   '1943-06-15', 'production',
   'Classified wartime shipment of Shinkolobwe uranium ore to the United States for the Manhattan Project. Declassified 1995.',
   1200.0, 'Source: declassified US Army Corps of Engineers documents.',
   'MED-1943-SHK-007 (declassified)', 0.95,
   '{"classification_lifted":1995,"destination":"Port Hope Ontario"}'
  ),
  ('d4000000-0000-0000-0000-000000000004',
   'b1b2c3d4-0004-0004-0004-000000000004',
   'c3000000-0000-0000-0000-000000000001',
   'b2000000-0000-0000-0000-000000000001',
   'Katanga Labour Inspection Report 1935',
   '1935-03-01', 'inspection',
   'Belgian colonial labour inspector report documenting workforce conditions at the Lubumbashi smelter complex.',
   NULL, '5,200 workers recorded. Mortality rate 3.1% annually.',
   'Belgian Congo Labour Gazette, 1935 Q1', 0.85,
   '{"workforce":5200,"inspector":"Van den Broeck"}'
  ),
  ('d4000000-0000-0000-0000-000000000005',
   'b1b2c3d4-0004-0004-0004-000000000004',
   'c3000000-0000-0000-0000-000000000001',
   'b2000000-0000-0000-0000-000000000001',
   'Lubumbashi Annual Production Report 1958',
   '1958-12-31', 'production',
   'Peak colonial-era copper output, two years before independence.',
   298700.0, 'Last full-year figure before nationalisation pressure.',
   'BCM Annual Report 1958, p.103', 0.93,
   '{"pre_independence":true}'
  ),

  -- Nkana Copper Mine (Zambia) – 3 records
  ('d4000000-0000-0000-0000-000000000006',
   'b1b2c3d4-0007-0007-0007-000000000007',
   'c3000000-0000-0000-0000-000000000006',
   'b2000000-0000-0000-0000-000000000004',
   'Nkana Mine First Year Production 1932',
   '1932-12-31', 'production',
   'First full-year production record for the Nkana copper mine under Rhokana Corporation.',
   18500.0, NULL,
   'Rhokana Corp Annual Report 1932', 0.88,
   '{}'
  ),
  ('d4000000-0000-0000-0000-000000000007',
   'b1b2c3d4-0007-0007-0007-000000000007',
   'c3000000-0000-0000-0000-000000000006',
   'b2000000-0000-0000-0000-000000000004',
   'Nkana Geological Survey 1936',
   '1936-08-10', 'survey',
   'Detailed geological survey establishing the full extent of the Nkana ore body at depth.',
   NULL, 'Ore body estimated at 95Mt at 3.8% Cu.',
   'Northern Rhodesia Geological Survey Report 1936', 0.91,
   '{"ore_body_mt":95,"grade_pct":3.8}'
  ),
  ('d4000000-0000-0000-0000-000000000008',
   'b1b2c3d4-0007-0007-0007-000000000007',
   'c3000000-0000-0000-0000-000000000007',
   'b2000000-0000-0000-0000-000000000004',
   'Mufulira Mine Production Report 1945',
   '1945-12-31', 'production',
   'Wartime peak production at Mufulira to supply Allied industrial demand.',
   76300.0, 'Production boosted by wartime contracts with British Ministry of Supply.',
   'Rhokana/Mufulira Annual Report 1945', 0.89,
   '{"wartime_contract":true}'
  ),

  -- Witwatersrand / Crown Mines – 3 records
  ('d4000000-0000-0000-0000-000000000009',
   'b1b2c3d4-0001-0001-0001-000000000001',
   'c3000000-0000-0000-0000-000000000003',
   'b2000000-0000-0000-0000-000000000002',
   'Crown Mines Gold Production 1900',
   '1900-12-31', 'production',
   'Post-Boer War resumption of production. First full year under British imperial administration.',
   14200.0, NULL,
   'Rand Mines Ltd Annual Report 1900', 0.86,
   '{"post_boer_war":true}'
  ),
  ('d4000000-0000-0000-0000-000000000010',
   'b1b2c3d4-0001-0001-0001-000000000001',
   'c3000000-0000-0000-0000-000000000003',
   'b2000000-0000-0000-0000-000000000002',
   'Crown Mines Record Output 1916',
   '1916-12-31', 'production',
   'Record gold output year for Crown Mines, delivering 42% of Rand-wide production.',
   41800.0, 'Wartime gold price fixed; output maximised through intensified labour.',
   'Rand Mines Ltd Annual Report 1916', 0.92,
   '{"ww1_year":true,"rand_share_pct":42}'
  ),
  ('d4000000-0000-0000-0000-000000000011',
   'b1b2c3d4-0001-0001-0001-000000000001',
   'c3000000-0000-0000-0000-000000000003',
   'b2000000-0000-0000-0000-000000000002',
   'Crown Mines Labour Incident Report 1913',
   '1913-07-04', 'incident',
   'Partial collapse of stope 14C. 8 fatalities recorded. Subsequent inquiry led to revised blasting regulations.',
   NULL, 'Inquiry report: Government Mining Engineer, August 1913.',
   'Transvaal Mines Department Incident Register, 1913', 0.94,
   '{"fatalities":8,"stope":"14C"}'
  ),

  -- Obuasi / Gold Coast – 2 records
  ('d4000000-0000-0000-0000-000000000012',
   'b1b2c3d4-0003-0003-0003-000000000003',
   'c3000000-0000-0000-0000-000000000004',
   'b2000000-0000-0000-0000-000000000003',
   'Obuasi Gold Production 1910',
   '1910-12-31', 'production',
   'Annual production record for Obuasi mine showing steady growth under British colonial administration.',
   8400.0, NULL,
   'Ashanti Goldfields Annual Report 1910', 0.87,
   '{}'
  ),
  ('d4000000-0000-0000-0000-000000000013',
   'b1b2c3d4-0003-0003-0003-000000000003',
   'c3000000-0000-0000-0000-000000000004',
   'b2000000-0000-0000-0000-000000000003',
   'Obuasi Geological Assessment 1925',
   '1925-05-20', 'survey',
   'Comprehensive geological survey extending known ore body to 1.8km depth.',
   NULL, 'Grade estimated at 11g/t Au at depth.',
   'Gold Coast Geological Survey 1925', 0.90,
   '{"depth_m":1800,"grade_g_t":11}'
  ),

  -- Sierra Leone – 2 records
  ('d4000000-0000-0000-0000-000000000014',
   'b1b2c3d4-0002-0002-0002-000000000002',
   'c3000000-0000-0000-0000-000000000008',
   'b2000000-0000-0000-0000-000000000005',
   'Yengema Diamond Recovery 1950',
   '1950-12-31', 'production',
   'Peak alluvial diamond recovery from Yengema concession under SLST exclusive licence.',
   NULL, '2.1 million carats recovered. Valued at £18.7M.',
   'SLST Annual Report 1950', 0.88,
   '{"carats":2100000,"value_gbp":18700000}'
  ),
  ('d4000000-0000-0000-0000-000000000015',
   'b1b2c3d4-0002-0002-0002-000000000002',
   'c3000000-0000-0000-0000-000000000008',
   'b2000000-0000-0000-0000-000000000005',
   'SLST Illicit Mining Inspection 1954',
   '1954-09-15', 'inspection',
   'Colonial administration inspection documenting scale of illegal alluvial mining by local diggers outside SLST concession. Led to 1955 Alluvial Diamond Mining Scheme.',
   NULL, 'Estimated 30,000 illegal diggers operating in Kono district.',
   'Sierra Leone Protectorate Mining Report 1954', 0.83,
   '{"illegal_diggers_est":30000,"led_to":"ADMS 1955"}'
  );

-- ─── MINERAL EXTRACTIONS (20) ─────────────────────────────────────────────────

INSERT INTO msim_mineral_extractions
  (id, record_id, mineral_raw, mineral_name, quantity_mt, quantity_raw, purity_pct, unit, notes)
VALUES
  -- Record 001: Lubumbashi 1920
  ('e5000000-0000-0000-0000-000000000001','d4000000-0000-0000-0000-000000000001','Copper','copper', 44800.0,'44,800 metric tons',88.5,'mt',NULL),
  ('e5000000-0000-0000-0000-000000000002','d4000000-0000-0000-0000-000000000001','Co','cobalt',    400.0, '400 metric tons',   72.0,'mt','Co symbol normalised to cobalt'),
  -- Record 002: Lubumbashi 1930
  ('e5000000-0000-0000-0000-000000000003','d4000000-0000-0000-0000-000000000002','Copper','copper',110600.0,'110,600 MT',        90.2,'mt',NULL),
  ('e5000000-0000-0000-0000-000000000004','d4000000-0000-0000-0000-000000000002','Co','cobalt',    1800.0,'1,800 MT',           68.0,'mt',NULL),
  -- Record 003: Shinkolobwe uranium 1943
  ('e5000000-0000-0000-0000-000000000005','d4000000-0000-0000-0000-000000000003','U','uranium',    1200.0,'1,200 short tons ore',65.0,'mt','Ore grade 65% U3O8 — exceptionally high'),
  -- Record 005: Lubumbashi 1958
  ('e5000000-0000-0000-0000-000000000006','d4000000-0000-0000-0000-000000000005','Cu','copper',   296000.0,'296,000 MT',         91.0,'mt',NULL),
  ('e5000000-0000-0000-0000-000000000007','d4000000-0000-0000-0000-000000000005','Co','cobalt',     2700.0,'2,700 MT',           74.0,'mt',NULL),
  -- Record 006: Nkana 1932
  ('e5000000-0000-0000-0000-000000000008','d4000000-0000-0000-0000-000000000006','Cu','copper',    18500.0,'18,500 MT',          86.0,'mt',NULL),
  -- Record 008: Mufulira 1945
  ('e5000000-0000-0000-0000-000000000009','d4000000-0000-0000-0000-000000000008','Cu','copper',    75800.0,'75,800 MT',          89.5,'mt',NULL),
  ('e5000000-0000-0000-0000-000000000010','d4000000-0000-0000-0000-000000000008','Co','cobalt',      500.0,'500 MT',             62.0,'mt','Minor cobalt co-product'),
  -- Record 009: Crown Mines 1900
  ('e5000000-0000-0000-0000-000000000011','d4000000-0000-0000-0000-000000000009','Au','gold',         14.2,'14.2 MT fine gold',  99.5,'mt','Fine gold after refining'),
  -- Record 010: Crown Mines 1916
  ('e5000000-0000-0000-0000-000000000012','d4000000-0000-0000-0000-000000000010','Au','gold',          41.8,'41.8 MT fine gold',  99.6,'mt',NULL),
  ('e5000000-0000-0000-0000-000000000013','d4000000-0000-0000-0000-000000000010','Ag','silver',         2.1,'2.1 MT fine silver', 98.0,'mt','Silver co-recovered from Witwatersrand reef'),
  -- Record 012: Obuasi 1910
  ('e5000000-0000-0000-0000-000000000014','d4000000-0000-0000-0000-000000000012','Au','gold',           8.4,'8.4 MT fine gold',   99.4,'mt',NULL),
  -- Record 014: Yengema 1950
  ('e5000000-0000-0000-0000-000000000015','d4000000-0000-0000-0000-000000000014','diamond','diamond', NULL,'2,100,000 carats',   NULL,'carats','Gem quality c.68%, industrial 32%'),
  -- Record 006 cobalt
  ('e5000000-0000-0000-0000-000000000016','d4000000-0000-0000-0000-000000000006','Cobalt','cobalt',    320.0,'320 MT',            65.0,'mt','Minor cobalt from Nkana 1932'),
  -- Record 007: Nkana survey — no extraction quantity, but log trace minerals
  ('e5000000-0000-0000-0000-000000000017','d4000000-0000-0000-0000-000000000007','Cu','copper',        NULL,'grade 3.8%',         NULL,'grade','Reserve estimate, not production'),
  -- Record 001 extra trace
  ('e5000000-0000-0000-0000-000000000018','d4000000-0000-0000-0000-000000000001','Mn','manganese',      12.0,'12 MT',             55.0,'mt','Trace manganese from Lubumbashi 1920'),
  -- Record 005 extra uranium trace
  ('e5000000-0000-0000-0000-000000000019','d4000000-0000-0000-0000-000000000003','Ra','radium',          0.002,'~2kg radium',     NULL,'kg','Radium by-product extracted separately for medical use'),
  -- Record 015: SLST inspection — no extraction
  ('e5000000-0000-0000-0000-000000000020','d4000000-0000-0000-0000-000000000015','diamond','diamond',  NULL,'est. 400,000 carats illicitly recovered', NULL,'carats','Illegal digger estimate; not official SLST output');

-- ─── REFRESH MATERIALIZED VIEW ────────────────────────────────────────────────
SELECT refresh_msim_search_mv();
