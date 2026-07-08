export interface Mine {
  id: string;
  name: string;
  country: string;
  region: string;
  coordinates: [number, number]; // [lng, lat]
  commodity: string[];
  commodityCode: string;
  systemType: string;
  operatingYears: string;
  peakGrade: string;
  dpi: number;
  depthReached: string;
  records: number;
  msimStatus: string;
  comparableMatch: { name: string; similarity: number };
  status: "active-msim" | "historical" | "asm" | "drill-target";
  continent: string;
}

export interface Alert {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  body: string;
  coordinates?: string;
  timestamp: string;
  unread: boolean;
}

export interface DrillTarget {
  id: string;
  priority: number;
  mineName: string;
  country: string;
  coordinates: string;
  commodity: string[];
  dpi: number;
  status: "Drill Ready" | "Soil Sampling" | "Under Review" | "Licensed";
  confidence: number;
  holesRecommended: string;
  depth: string;
  rationale: {
    structuralControl: number;
    alterationVector: number;
    geochemicalSignal: number;
    geophysicalMatch: number;
    analogueSimilarity: number;
    depthPotential: number;
  };
  budget: { phase1: string; phase2: string };
  risks: Array<{ level: "HIGH" | "MEDIUM" | "LOW"; description: string }>;
  evidence: Array<{
    type: "Historical" | "Geophysical" | "Geochemical" | "Structural" | "Remote Sensing";
    year: number;
    description: string;
    source: string;
  }>;
}

export const MINES: Mine[] = [
  {
    id: "ZM-CU-0247",
    name: "Luanshya Mine",
    country: "Zambia",
    region: "Copperbelt Province",
    coordinates: [28.6891, -13.2234],
    commodity: ["Copper"],
    commodityCode: "Cu",
    systemType: "Sediment-hosted",
    operatingYears: "1927–1958",
    peakGrade: "3.8% Cu",
    dpi: 91,
    depthReached: "487m",
    records: 14,
    msimStatus: "Full card",
    comparableMatch: { name: "Olympic Dam", similarity: 82 },
    status: "drill-target",
    continent: "Africa",
  },
  {
    id: "TZ-AU-0108",
    name: "Lone Tree Mine",
    country: "Tanzania",
    region: "Lake Victoria Zone",
    coordinates: [32.1847, -2.6372],
    commodity: ["Gold"],
    commodityCode: "Au",
    systemType: "Orogenic",
    operatingYears: "1932–1965",
    peakGrade: "12.4 g/t Au",
    dpi: 78,
    depthReached: "312m",
    records: 9,
    msimStatus: "Full card",
    comparableMatch: { name: "Geita Gold", similarity: 74 },
    status: "historical",
    continent: "Africa",
  },
  {
    id: "CD-CUCO-0039",
    name: "Nkana Smelter Complex",
    country: "DRC",
    region: "Haut-Katanga",
    coordinates: [27.4156, -12.8183],
    commodity: ["Copper", "Cobalt"],
    commodityCode: "Cu-Co",
    systemType: "Sediment-hosted",
    operatingYears: "1939–1972",
    peakGrade: "4.2% Cu, 0.8% Co",
    dpi: 84,
    depthReached: "623m",
    records: 22,
    msimStatus: "Full card",
    comparableMatch: { name: "Kolwezi", similarity: 91 },
    status: "historical",
    continent: "Africa",
  },
  {
    id: "BW-NICU-0017",
    name: "Selebi-Phikwe",
    country: "Botswana",
    region: "Central District",
    coordinates: [27.8375, -21.9894],
    commodity: ["Nickel", "Copper"],
    commodityCode: "Ni-Cu",
    systemType: "Magmatic",
    operatingYears: "1974–2016",
    peakGrade: "1.1% Ni, 0.8% Cu",
    dpi: 67,
    depthReached: "1,050m",
    records: 31,
    msimStatus: "Full card",
    comparableMatch: { name: "Sudbury Basin", similarity: 61 },
    status: "historical",
    continent: "Africa",
  },
  {
    id: "CD-SN-0023",
    name: "Bisichi Mine",
    country: "DRC",
    region: "South Kivu",
    coordinates: [28.7823, -2.4917],
    commodity: ["Tin"],
    commodityCode: "Sn",
    systemType: "Skarn",
    operatingYears: "1928–1955",
    peakGrade: "2.8% Sn",
    dpi: 54,
    depthReached: "180m",
    records: 6,
    msimStatus: "Partial",
    comparableMatch: { name: "Uis Mine", similarity: 58 },
    status: "historical",
    continent: "Africa",
  },
  {
    id: "TZ-AU-0202",
    name: "Geita Gold District",
    country: "Tanzania",
    region: "Geita Region",
    coordinates: [32.1563, -2.8751],
    commodity: ["Gold"],
    commodityCode: "Au",
    systemType: "Orogenic",
    operatingYears: "1938–1966",
    peakGrade: "8.6 g/t Au",
    dpi: 73,
    depthReached: "398m",
    records: 17,
    msimStatus: "Full card",
    comparableMatch: { name: "Ashanti Belt", similarity: 79 },
    status: "asm",
    continent: "Africa",
  },
  {
    id: "ZM-CU-0331",
    name: "Roan Antelope Extension",
    country: "Zambia",
    region: "Copperbelt Province",
    coordinates: [28.4127, -13.1456],
    commodity: ["Copper"],
    commodityCode: "Cu",
    systemType: "Sediment-hosted",
    operatingYears: "1924–1961",
    peakGrade: "3.2% Cu",
    dpi: 87,
    depthReached: "542m",
    records: 18,
    msimStatus: "Full card",
    comparableMatch: { name: "Zambian Copperbelt", similarity: 88 },
    status: "drill-target",
    continent: "Africa",
  },
  {
    id: "GH-AU-0044",
    name: "Obuasi Mine",
    country: "Ghana",
    region: "Ashanti Region",
    coordinates: [-1.6836, 6.2046],
    commodity: ["Gold"],
    commodityCode: "Au",
    systemType: "Epithermal",
    operatingYears: "1897–1994",
    peakGrade: "30.2 g/t Au",
    dpi: 68,
    depthReached: "1,640m",
    records: 48,
    msimStatus: "Full card",
    comparableMatch: { name: "Bulyanhulu", similarity: 72 },
    status: "active-msim",
    continent: "Africa",
  },
  {
    id: "ZM-CU-0412",
    name: "Konkola Deep",
    country: "Zambia",
    region: "Copperbelt Province",
    coordinates: [27.7831, -12.1947],
    commodity: ["Copper"],
    commodityCode: "Cu",
    systemType: "Sediment-hosted",
    operatingYears: "1957–1984",
    peakGrade: "4.1% Cu",
    dpi: 79,
    depthReached: "890m",
    records: 11,
    msimStatus: "Partial",
    comparableMatch: { name: "Olympic Dam", similarity: 76 },
    status: "historical",
    continent: "Africa",
  },
  {
    id: "ML-AU-0078",
    name: "Loulo-Gounkoto",
    country: "Mali",
    region: "Kayes Region",
    coordinates: [-11.4417, 14.0833],
    commodity: ["Gold"],
    commodityCode: "Au",
    systemType: "Orogenic",
    operatingYears: "1941–1969",
    peakGrade: "5.2 g/t Au",
    dpi: 71,
    depthReached: "267m",
    records: 8,
    msimStatus: "Partial",
    comparableMatch: { name: "Sadiola Hill", similarity: 65 },
    status: "historical",
    continent: "Africa",
  },
  {
    id: "ZM-CU-0198",
    name: "Mufulira Copper Mine",
    country: "Zambia",
    region: "Copperbelt Province",
    coordinates: [28.2391, -12.5483],
    commodity: ["Copper"],
    commodityCode: "Cu",
    systemType: "Sediment-hosted",
    operatingYears: "1933–1976",
    peakGrade: "3.6% Cu",
    dpi: 82,
    depthReached: "728m",
    records: 26,
    msimStatus: "Full card",
    comparableMatch: { name: "Zambian Copperbelt", similarity: 90 },
    status: "active-msim",
    continent: "Africa",
  },
  {
    id: "CD-CU-0056",
    name: "Shinkolobwe Mine",
    country: "DRC",
    region: "Haut-Katanga",
    coordinates: [27.0234, -11.0183],
    commodity: ["Copper", "Cobalt"],
    commodityCode: "Cu-Co",
    systemType: "Sediment-hosted",
    operatingYears: "1921–1960",
    peakGrade: "2.9% Cu",
    dpi: 76,
    depthReached: "411m",
    records: 19,
    msimStatus: "Full card",
    comparableMatch: { name: "Kolwezi", similarity: 85 },
    status: "historical",
    continent: "Africa",
  },
];

export const ALERTS: Alert[] = [
  {
    id: "a1",
    severity: "critical",
    title: "DPI Threshold Breach: +18 points in 7 days",
    body: "Luanshya NE Extension anomaly score crossed 90 — immediate review required",
    coordinates: "-13.22°, 28.69°",
    timestamp: "14 min ago",
    unread: true,
  },
  {
    id: "a2",
    severity: "high",
    title: "New ASM cluster detected near historical Cu zone",
    body: "Sentinel-2 change detection confirms artisanal activity 2.1km NE of Roan pit",
    coordinates: "-13.45°, 28.51°",
    timestamp: "2 hrs ago",
    unread: true,
  },
  {
    id: "a3",
    severity: "medium",
    title: "Geochemical anomaly updated — soil sampling complete",
    body: "450 ppm Cu anomaly confirmed over 1.8km strike; structural model updated",
    coordinates: "-13.67°, 28.73°",
    timestamp: "Yesterday",
    unread: false,
  },
  {
    id: "a4",
    severity: "low",
    title: "Comparable deposit match: Olympic Dam geology similarity 78%",
    body: "MSIM system flagged structural and lithostratigraphic affinity with Olympic Dam IOCG",
    coordinates: undefined,
    timestamp: "3 days ago",
    unread: false,
  },
];

export const DRILL_TARGETS: DrillTarget[] = [
  {
    id: "TGT-001",
    priority: 1,
    mineName: "Luanshya NE Extension",
    country: "Zambia",
    coordinates: "-13.2234°S, 28.6891°E",
    commodity: ["Cu"],
    dpi: 91,
    status: "Drill Ready",
    confidence: 88,
    holesRecommended: "3× RC holes",
    depth: "100–200m",
    rationale: {
      structuralControl: 82,
      alterationVector: 88,
      geochemicalSignal: 79,
      geophysicalMatch: 71,
      analogueSimilarity: 91,
      depthPotential: 83,
    },
    budget: { phase1: "$12,000–$18,000", phase2: "$85,000–$120,000" },
    risks: [
      { level: "MEDIUM", description: "Cover thickness uncertain — 40–90m estimated" },
      { level: "LOW", description: "Structural continuity well-constrained by 2022 MSIM corridor model" },
      { level: "LOW", description: "Host rock correlation established via Roan Group stratigraphy" },
      { level: "HIGH", description: "No prior drilling in exact NE footprint — conceptual stage" },
    ],
    evidence: [
      { type: "Historical", year: 1934, description: "Roan Survey notes NE extension possibility, Grade 2.8% Cu oxide outcrops noted", source: "GSK Archive, File 4/1934" },
      { type: "Geophysical", year: 2019, description: "ZAMS aeromagnetic survey — 340 nT anomaly 1.8km NE of pit", source: "Zambia Geological Survey, 2019" },
      { type: "Structural", year: 2022, description: "MSIM corridor projection — NE plunge at 25° confirmed by kinematic model", source: "MSIM Analysis Engine v2" },
      { type: "Geochemical", year: 2023, description: "Stream sediment: 450 ppm Cu anomaly, 2.1km NE of historical workings", source: "AfriXplore Scout Survey Q2/2023" },
      { type: "Remote Sensing", year: 2024, description: "Landsat 8 SWIR alteration mapping — clay-carbonate anomaly overlaps geochemical high", source: "MSIM Remote Sensing Module" },
      { type: "Historical", year: 1929, description: "Missionary record notes 'green rock outcrops' 3km NE — consistent with malachite staining", source: "Livingstone Mission Archives" },
    ],
  },
  {
    id: "TGT-002",
    priority: 2,
    mineName: "Roan Antelope SW Flank",
    country: "Zambia",
    coordinates: "-13.1456°S, 28.4127°E",
    commodity: ["Cu"],
    dpi: 87,
    status: "Soil Sampling",
    confidence: 74,
    holesRecommended: "2× RC holes",
    depth: "80–150m",
    rationale: {
      structuralControl: 78,
      alterationVector: 82,
      geochemicalSignal: 71,
      geophysicalMatch: 68,
      analogueSimilarity: 85,
      depthPotential: 77,
    },
    budget: { phase1: "$9,000–$14,000", phase2: "$65,000–$90,000" },
    risks: [
      { level: "LOW", description: "Historical mine plans provide strong structural constraint" },
      { level: "MEDIUM", description: "SW plunge angle uncertain beyond 400m depth" },
      { level: "LOW", description: "Host unit traceable on 1:50k geological map" },
    ],
    evidence: [
      { type: "Historical", year: 1938, description: "BSA Company annual report references SW ore shoots below haulage level", source: "BSA Archives, Annual Report 1938" },
      { type: "Geophysical", year: 2021, description: "Airborne TEM anomaly 1.2km SW — good conductor response", source: "Falcon Geophysics Survey 2021" },
      { type: "Geochemical", year: 2024, description: "Soil geochemistry: 320 ppm Cu anomaly over 1.1km strike", source: "Active soil sampling — in progress" },
    ],
  },
  {
    id: "TGT-003",
    priority: 3,
    mineName: "Nkana North Block",
    country: "DRC",
    coordinates: "-12.8183°S, 27.4156°E",
    commodity: ["Cu", "Co"],
    dpi: 84,
    status: "Under Review",
    confidence: 68,
    holesRecommended: "4× DDH holes",
    depth: "200–400m",
    rationale: {
      structuralControl: 75,
      alterationVector: 79,
      geochemicalSignal: 68,
      geophysicalMatch: 74,
      analogueSimilarity: 88,
      depthPotential: 71,
    },
    budget: { phase1: "$18,000–$25,000", phase2: "$180,000–$250,000" },
    risks: [
      { level: "HIGH", description: "Access constraints — DRC permitting process requires DGM approval" },
      { level: "MEDIUM", description: "Cobalt credit uncertainty at depth — grade model sensitivity ±30%" },
      { level: "LOW", description: "Geological model robust — 5 corroborating data sources" },
    ],
    evidence: [
      { type: "Historical", year: 1942, description: "UMHK drilling records indicate Cu-Co mineralisation persists north of Nkana shaft", source: "UMHK Technical Records, 1942" },
      { type: "Geophysical", year: 2020, description: "CGSP regional gravity survey — +8 mGal anomaly over target area", source: "CGSP Survey, 2020" },
    ],
  },
  {
    id: "TGT-004",
    priority: 4,
    mineName: "Geita Deep Extension",
    country: "Tanzania",
    coordinates: "-2.8751°S, 32.1563°E",
    commodity: ["Au"],
    dpi: 73,
    status: "Drill Ready",
    confidence: 71,
    holesRecommended: "3× DDH holes",
    depth: "150–300m",
    rationale: {
      structuralControl: 71,
      alterationVector: 74,
      geochemicalSignal: 69,
      geophysicalMatch: 66,
      analogueSimilarity: 79,
      depthPotential: 68,
    },
    budget: { phase1: "$15,000–$20,000", phase2: "$140,000–$190,000" },
    risks: [
      { level: "MEDIUM", description: "Grade continuity at depth uncertain beyond 250m — limited historical data" },
      { level: "LOW", description: "ASM activity mapped and boundary agreed — no overlap with target" },
    ],
    evidence: [
      { type: "Historical", year: 1952, description: "Geita mine survey indicates deep plunge potential — shaft stopped at water table", source: "Tanganyika Gold Mines, Survey 1952" },
      { type: "Structural", year: 2023, description: "MSIM structural model — Nyamulilima corridor passes through target", source: "MSIM Analysis v2.4" },
    ],
  },
  {
    id: "TGT-005",
    priority: 5,
    mineName: "Obuasi Eastern Corridor",
    country: "Ghana",
    coordinates: "6.2046°N, -1.6836°W",
    commodity: ["Au"],
    dpi: 68,
    status: "Licensed",
    confidence: 64,
    holesRecommended: "2× DDH holes",
    depth: "100–200m",
    rationale: {
      structuralControl: 68,
      alterationVector: 71,
      geochemicalSignal: 63,
      geophysicalMatch: 59,
      analogueSimilarity: 72,
      depthPotential: 65,
    },
    budget: { phase1: "$10,000–$15,000", phase2: "$80,000–$110,000" },
    risks: [
      { level: "LOW", description: "Licensed area — regulatory framework in place" },
      { level: "MEDIUM", description: "Eastern extension poorly documented — requires new structural mapping" },
    ],
    evidence: [
      { type: "Historical", year: 1910, description: "Ashanti Goldfields Corp records reference eastern lodes — never tested", source: "AGC Archive, 1910" },
    ],
  },
];

export const STATS = {
  minesDigitised: { value: 14247, trend: "+847 this month", accent: "copper" },
  activeAnomalies: { value: 2891, trend: "+12% vs 30d", accent: "high" },
  drillTargets: { value: 347, trend: "23 new", accent: "brand" },
  avgDPI: { value: 78.4, trend: "copper belt avg", accent: "medium" },
  countries: { value: 34, trend: "3 new", accent: "low" },
};

export const COMMODITIES = [
  { code: "Cu", name: "Copper", color: "#F59E0B" },
  { code: "Au", name: "Gold", color: "#FCD34D" },
  { code: "Sn", name: "Tin", color: "#60A5FA" },
  { code: "Ni", name: "Nickel", color: "#34D399" },
  { code: "Co", name: "Cobalt", color: "#A78BFA" },
  { code: "Pb-Zn", name: "Lead-Zinc", color: "#F472B6" },
];

export const MAP_LAYERS = [
  { id: "geology", label: "Geology 1:250,000", color: "#F59E0B", enabled: true },
  { id: "aeromagnetics", label: "Aeromagnetics", color: "#60A5FA", enabled: true },
  { id: "alteration", label: "Satellite Alteration", color: "#F97316", enabled: true },
  { id: "mines", label: "Historical Mines", color: "#FCD34D", enabled: true },
  { id: "licensed", label: "Licensed Areas", color: "#1D4ED8", enabled: false },
  { id: "asm", label: "ASM Activity", color: "#EAB308", enabled: true },
];

export const MINERAL_SYSTEM_PARAMS = [
  { icon: "🌡️", label: "Heat Source", value: "Rifting-related thermal gradient", confidence: "HIGH" },
  { icon: "💧", label: "Fluid Source", value: "Basinal brine (evaporite-derived)", confidence: "HIGH" },
  { icon: "⛰️", label: "Fluid Pathway", value: "Regional fault + stratabound flow", confidence: "MEDIUM" },
  { icon: "🎯", label: "Trap / Depositional", value: "Reductive sulphidic shales", confidence: "HIGH" },
  { icon: "🛡️", label: "Preservation", value: "Post-mineralisation folding", confidence: "MEDIUM" },
  { icon: "🔗", label: "Critical Interface", value: "Redox boundary at 150–200m depth", confidence: "HIGH" },
];
