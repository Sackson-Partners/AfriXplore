'use client';

import { useEffect, useRef, useState } from 'react';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

// Survey zones around the Zambian Copperbelt
const SURVEY_ZONES = {
  type: 'FeatureCollection' as const,
  features: [
    { type: 'Feature' as const, properties: { name: 'Luanshya Block 4', status: 'active', confidence: 94 }, geometry: { type: 'Polygon' as const, coordinates: [[[28.2, -12.9], [28.6, -12.9], [28.6, -13.2], [28.2, -13.2], [28.2, -12.9]]] } },
    { type: 'Feature' as const, properties: { name: 'Nkana Extension', status: 'complete', confidence: 87 }, geometry: { type: 'Polygon' as const, coordinates: [[[26.8, -12.6], [27.2, -12.6], [27.2, -12.9], [26.8, -12.9], [26.8, -12.6]]] } },
    { type: 'Feature' as const, properties: { name: 'Roan Antelope West', status: 'active', confidence: 79 }, geometry: { type: 'Polygon' as const, coordinates: [[[28.0, -13.5], [28.4, -13.5], [28.4, -13.8], [28.0, -13.8], [28.0, -13.5]]] } },
    { type: 'Feature' as const, properties: { name: 'Mufulira North', status: 'planned', confidence: 65 }, geometry: { type: 'Polygon' as const, coordinates: [[[28.1, -12.3], [28.5, -12.3], [28.5, -12.6], [28.1, -12.6], [28.1, -12.3]]] } },
    { type: 'Feature' as const, properties: { name: 'Kolwezi Fringe', status: 'active', confidence: 91 }, geometry: { type: 'Polygon' as const, coordinates: [[[25.4, -10.7], [25.8, -10.7], [25.8, -11.0], [25.4, -11.0], [25.4, -10.7]]] } },
  ],
};

const ANOMALY_POINTS = [
  { coords: [28.38, -13.05], severity: 'critical', mineral: 'Copper', confidence: 94, id: 'ANM-0471' },
  { coords: [27.01, -12.72], severity: 'high', mineral: 'Cobalt', confidence: 87, id: 'ANM-0468' },
  { coords: [28.22, -13.62], severity: 'medium', mineral: 'Gold', confidence: 79, id: 'ANM-0465' },
  { coords: [25.61, -10.85], severity: 'critical', mineral: 'Copper', confidence: 92, id: 'ANM-0462' },
  { coords: [28.45, -12.45], severity: 'low', mineral: 'Nickel', confidence: 65, id: 'ANM-0459' },
];

const severityColor: Record<string, string> = {
  critical: '#EF4444', high: '#F97316', medium: '#EAB308', low: '#22C55E',
};

export default function MapPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const [terrain3d, setTerrain3d] = useState(true);
  const [showZones, setShowZones] = useState(true);
  const [showSeismic, setShowSeismic] = useState(true);
  const [showAnomalies, setShowAnomalies] = useState(true);
  const [pitch, setPitch] = useState(45);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [hoveredFeature, setHoveredFeature] = useState<string | null>(null);

  useEffect(() => {
    if (mapRef.current || !mapContainer.current || !MAPBOX_TOKEN) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mapboxgl: any;

    import('mapbox-gl').then((mb) => {
      mapboxgl = mb.default ?? mb;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map: any = new mapboxgl.Map({
        container: mapContainer.current!,
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: [27.5, -12.5],
        zoom: 5.5,
        pitch: 45,
        bearing: -15,
        antialias: true,
      });

      mapRef.current = map;

      map.on('load', () => {
        const m = map;

        // DEM terrain source
        m.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14,
        });

        m.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });

        m.setFog({
          color: 'rgb(10, 14, 20)',
          'high-color': 'rgb(14, 165, 233)',
          'horizon-blend': 0.02,
          'space-color': 'rgb(5, 7, 12)',
          'star-intensity': 0.6,
        });

        // Survey zones
        m.addSource('survey-zones', { type: 'geojson', data: SURVEY_ZONES });
        m.addLayer({ id: 'zones-fill', type: 'fill', source: 'survey-zones', paint: { 'fill-color': '#0EA5E9', 'fill-opacity': 0.18 } });
        m.addLayer({ id: 'zones-outline', type: 'line', source: 'survey-zones', paint: { 'line-color': '#0EA5E9', 'line-width': 1.5 } });

        // Seismic grid lines
        const seismicLines: number[][][] = [];
        for (let lon = 24; lon <= 32; lon += 0.5) {
          seismicLines.push([[lon, -9], [lon, -16]]);
        }
        for (let lat = -9; lat >= -16; lat -= 0.5) {
          seismicLines.push([[24, lat], [32, lat]]);
        }
        m.addSource('seismic-grid', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: seismicLines.map(coords => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } })),
          },
        });
        m.addLayer({ id: 'seismic-lines', type: 'line', source: 'seismic-grid', paint: { 'line-color': '#F97316', 'line-width': 0.5, 'line-opacity': 0.35 } });

        // Anomaly points
        m.addSource('anomalies', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: ANOMALY_POINTS.map(a => ({
              type: 'Feature',
              properties: { severity: a.severity, mineral: a.mineral, confidence: a.confidence, id: a.id },
              geometry: { type: 'Point', coordinates: a.coords },
            })),
          },
        });
        m.addLayer({
          id: 'anomaly-halo', type: 'circle', source: 'anomalies',
          paint: { 'circle-radius': 14, 'circle-color': ['match', ['get', 'severity'], 'critical', '#EF4444', 'high', '#F97316', 'medium', '#EAB308', '#22C55E'], 'circle-opacity': 0.2 },
        });
        m.addLayer({
          id: 'anomaly-points', type: 'circle', source: 'anomalies',
          paint: { 'circle-radius': 6, 'circle-color': ['match', ['get', 'severity'], 'critical', '#EF4444', 'high', '#F97316', 'medium', '#EAB308', '#22C55E'], 'circle-stroke-width': 1.5, 'circle-stroke-color': '#fff' },
        });

        setMapLoaded(true);
      });
    });

    return () => {
      if (mapRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mapRef.current as any).remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Sync terrain toggle
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = mapRef.current as any;
    m.setTerrain(terrain3d ? { source: 'mapbox-dem', exaggeration: 1.5 } : null);
  }, [terrain3d, mapLoaded]);

  // Sync layer visibility
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = mapRef.current as any;
    const vis = (b: boolean) => b ? 'visible' : 'none';
    m.setLayoutProperty('zones-fill', 'visibility', vis(showZones));
    m.setLayoutProperty('zones-outline', 'visibility', vis(showZones));
    m.setLayoutProperty('seismic-lines', 'visibility', vis(showSeismic));
    m.setLayoutProperty('anomaly-halo', 'visibility', vis(showAnomalies));
    m.setLayoutProperty('anomaly-points', 'visibility', vis(showAnomalies));
  }, [showZones, showSeismic, showAnomalies, mapLoaded]);

  // Sync pitch
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mapRef.current as any).setPitch(pitch);
  }, [pitch, mapLoaded]);

  return (
    <div className="relative flex-1 h-full" style={{ height: 'calc(100vh - 56px)' }}>
      {/* Map container */}
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Control panel */}
      <div className="absolute top-4 right-4 w-64 bg-geo-slate/90 backdrop-blur-md border border-geo-steel rounded-xl shadow-xl overflow-hidden z-10">
        <div className="px-4 py-3 border-b border-geo-steel">
          <h3 className="font-display font-semibold text-geo-white text-sm">Layer Controls</h3>
          <p className="text-[10px] text-geo-mist mt-0.5">3D Seismic Intelligence View</p>
        </div>

        <div className="p-4 space-y-3">
          {[
            { label: '3D Terrain', desc: 'DEM exaggeration ×1.5', value: terrain3d, set: setTerrain3d, color: 'drone-primary' },
            { label: 'Survey Zones', desc: 'Active GeoSwarm areas', value: showZones, set: setShowZones, color: 'drone-primary' },
            { label: 'Seismic Grid', desc: '0.5° resolution overlay', value: showSeismic, set: setShowSeismic, color: 'signal-high' },
            { label: 'Anomaly Points', desc: 'Detected mineral targets', value: showAnomalies, set: setShowAnomalies, color: 'signal-critical' },
          ].map(({ label, desc, value, set, color }) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-geo-cloud font-medium truncate">{label}</p>
                <p className="text-[10px] text-geo-mist truncate">{desc}</p>
              </div>
              <button
                onClick={() => set(!value)}
                className={`relative flex-shrink-0 w-9 h-5 rounded-full transition-colors duration-200 ${value ? `bg-${color}` : 'bg-geo-graphite border border-geo-steel'}`}
                style={{ backgroundColor: value ? (color === 'drone-primary' ? '#0EA5E9' : color === 'signal-high' ? '#F97316' : '#EF4444') : undefined }}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </div>
          ))}

          {/* Pitch slider */}
          <div className="pt-1 border-t border-geo-steel/50">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-geo-cloud font-medium">Tilt Angle</p>
              <span className="font-mono text-xs text-drone-primary">{pitch}°</span>
            </div>
            <input
              type="range" min={0} max={60} step={5} value={pitch}
              onChange={e => setPitch(Number(e.target.value))}
              className="w-full accent-drone-primary"
            />
            <div className="flex justify-between text-[9px] text-geo-mist mt-0.5">
              <span>0° (Top)</span><span>60° (3D)</span>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="px-4 pb-4 pt-2 border-t border-geo-steel/50">
          <p className="text-[10px] text-geo-mist uppercase tracking-wide mb-2">Anomaly Severity</p>
          {Object.entries(severityColor).map(([s, c]) => (
            <div key={s} className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c }} />
              <span className="text-[11px] text-geo-cloud capitalize">{s}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Anomaly legend bottom-left */}
      <div className="absolute bottom-4 left-4 z-10 space-y-2">
        {ANOMALY_POINTS.map(a => (
          <div
            key={a.id}
            className={`bg-geo-slate/90 backdrop-blur border rounded-lg px-3 py-2 text-xs cursor-pointer transition-all duration-150 ${hoveredFeature === a.id ? 'border-drone-primary/60' : 'border-geo-steel/60'}`}
            onMouseEnter={() => setHoveredFeature(a.id)}
            onMouseLeave={() => setHoveredFeature(null)}
          >
            <span className="w-2 h-2 rounded-full inline-block mr-1.5" style={{ backgroundColor: severityColor[a.severity] }} />
            <span className="font-mono text-geo-mist mr-1">{a.id}</span>
            <span className="text-geo-cloud font-medium">{a.mineral}</span>
            <span className="text-geo-mist ml-1">· {a.confidence}%</span>
          </div>
        ))}
      </div>

      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-geo-obsidian z-20">
          <div className="text-center">
            <div className="w-12 h-12 rounded-xl bg-drone-primary/10 border border-drone-primary/30 flex items-center justify-center mx-auto mb-3 animate-pulse">
              <svg className="w-6 h-6 text-drone-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            </div>
            <p className="text-geo-cloud text-sm font-medium">Loading 3D terrain...</p>
            <p className="text-geo-mist text-xs mt-1 font-mono">Zambian Copperbelt — Satellite + DEM</p>
          </div>
        </div>
      )}
    </div>
  );
}
