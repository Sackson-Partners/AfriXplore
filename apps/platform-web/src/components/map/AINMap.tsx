'use client';

import { useRef, useState, useCallback } from 'react';
import Map, {
  NavigationControl,
  ScaleControl,
  Source,
  Layer,
  type MapRef,
  Popup,
} from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

// ── Deck.gl integration ───────────────────────────────────────────────────────
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer } from '@deck.gl/layers';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import type { PickingInfo } from '@deck.gl/core';

// ── Local data ────────────────────────────────────────────────────────────────
import { MINES, type Mine } from '@/lib/mock-data';

// ── Layer visibility state ────────────────────────────────────────────────────
export interface LayerState {
  heatmap: boolean;
  clusters: boolean;
  mines: boolean;
  alteration: boolean;
  fronts: boolean;
  aeromagnetics: boolean;
  licences: boolean;
}

interface HoveredMine {
  mine: Mine;
  x: number;
  y: number;
}

interface AINMapProps {
  layerState: LayerState;
  onMineSelect?: (mine: Mine) => void;
  onMineHover?: (mine: Mine | null) => void;
  className?: string;
}

const INITIAL_VIEW_STATE = {
  longitude: 27,
  latitude: -10,
  zoom: 3.8,
  pitch: 20,
  bearing: 0,
};

// Commodity → color mapping (RGBA)
const COMMODITY_COLORS: Record<string, [number, number, number, number]> = {
  Cu: [245, 158, 11, 220],
  Au: [252, 211, 77, 220],
  'Cu-Co': [249, 115, 22, 220],
  'Ni-Cu': [52, 211, 153, 220],
  Sn: [96, 165, 250, 220],
};

function getMineColor(mine: Mine): [number, number, number, number] {
  return COMMODITY_COLORS[mine.commodityCode] ?? [107, 114, 128, 200];
}

function getDPIHeatColor(dpi: number): [number, number, number, number] {
  if (dpi > 80) return [239, 68, 68, 200];
  if (dpi > 60) return [249, 115, 22, 180];
  if (dpi > 40) return [234, 179, 8, 160];
  return [34, 197, 94, 140];
}

export default function AINMap({ layerState, onMineSelect, onMineHover, className = '' }: AINMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [hoveredMine, setHoveredMine] = useState<HoveredMine | null>(null);
  const [popupInfo, setPopupInfo] = useState<{ mine: Mine; lng: number; lat: number } | null>(null);

  // ── Deck.gl layers ─────────────────────────────────────────────────────────

  // Heatmap layer — DPI-weighted heat
  const heatmapLayer = new HeatmapLayer<Mine>({
    id: 'dpi-heatmap',
    data: MINES,
    visible: layerState.heatmap,
    getPosition: (d: Mine) => d.coordinates,
    getWeight: (d: Mine) => d.dpi / 100,
    colorRange: [
      [13, 14, 15, 0],
      [196, 98, 45, 80],
      [196, 98, 45, 160],
      [212, 168, 83, 200],
      [255, 220, 120, 240],
      [255, 255, 255, 255],
    ],
    radiusPixels: 80,
    intensity: 1.4,
    threshold: 0.05,
  });

  // Pulse ring for drill-ready targets
  const pulseLayer = new ScatterplotLayer<Mine>({
    id: 'target-pulse',
    data: MINES.filter((m) => m.status === 'drill-target'),
    visible: layerState.clusters,
    getPosition: (d: Mine) => d.coordinates,
    getRadius: 30000,
    radiusUnits: 'meters',
    getFillColor: [239, 68, 68, 30],
    stroked: true,
    getLineColor: [239, 68, 68, 80],
    getLineWidth: 2,
    lineWidthUnits: 'pixels',
  });

  // Mine markers layer
  const minesLayer = new ScatterplotLayer<Mine>({
    id: 'mine-markers',
    data: MINES,
    visible: layerState.mines,
    getPosition: (d: Mine) => d.coordinates,
    getRadius: (d: Mine) => (d.status === 'drill-target' ? 8 : 6),
    radiusMinPixels: 4,
    radiusMaxPixels: 16,
    getFillColor: getMineColor,
    stroked: true,
    getLineColor: (d: Mine) => d.status === 'drill-target' ? [239, 68, 68, 200] : [255, 255, 255, 60],
    getLineWidth: (d: Mine) => d.status === 'drill-target' ? 2 : 1,
    lineWidthUnits: 'pixels',
    pickable: true,
    autoHighlight: true,
    highlightColor: [255, 255, 255, 60],
    onClick: (info: PickingInfo<Mine>) => {
      if (info.object) {
        setPopupInfo({ mine: info.object, lng: info.coordinate![0], lat: info.coordinate![1] });
        onMineSelect?.(info.object);
      }
    },
    onHover: (info: PickingInfo<Mine>) => {
      if (info.object) {
        setHoveredMine({ mine: info.object, x: info.x, y: info.y });
        onMineHover?.(info.object);
      } else {
        setHoveredMine(null);
        onMineHover?.(null);
      }
    },
    updateTriggers: { getFillColor: MINES.length },
  });

  const deckLayers = [
    layerState.heatmap && heatmapLayer,
    layerState.clusters && pulseLayer,
    layerState.mines && minesLayer,
  ].filter(Boolean);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleViewStateChange = useCallback(({ viewState: vs }: any) => {
    setViewState(vs as typeof INITIAL_VIEW_STATE);
  }, []);

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Deck.gl overlay (interleaved with Mapbox) */}
      <DeckGL
        viewState={viewState}
        onViewStateChange={handleViewStateChange}
        controller={{ dragRotate: true, touchRotate: true }}
        layers={deckLayers}
        style={{ position: 'absolute', top: '0', left: '0', right: '0', bottom: '0', zIndex: '1' }}
        getCursor={({ isHovering }) => (isHovering ? 'pointer' : 'grab')}
      >
        <Map
          ref={mapRef}
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          attributionControl={false}
          reuseMaps
          style={{ width: '100%', height: '100%' }}
        >
          <NavigationControl position="top-right" showCompass={false} />
          <ScaleControl position="bottom-left" unit="metric" />

          {/* Territory boundary (placeholder — replace with real GeoJSON from API) */}
          <Source
            id="territory-bounds"
            type="geojson"
            data={{
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [[[22, -8], [34, -8], [34, -18], [22, -18], [22, -8]]],
              },
              properties: {},
            }}
          >
            <Layer
              id="territory-fill"
              type="fill"
              paint={{ 'fill-color': '#1D4ED8', 'fill-opacity': 0.04 }}
            />
            <Layer
              id="territory-outline"
              type="line"
              paint={{ 'line-color': '#1D4ED8', 'line-width': 1, 'line-dasharray': [4, 3], 'line-opacity': 0.4 }}
            />
          </Source>

          {/* Mine popup */}
          {popupInfo && (
            <Popup
              longitude={popupInfo.lng}
              latitude={popupInfo.lat}
              onClose={() => setPopupInfo(null)}
              closeButton={false}
              anchor="bottom"
              offset={12}
            >
              <div className="text-xs font-sans">
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <p className="font-semibold text-geo-white leading-tight">{popupInfo.mine.name}</p>
                  <button onClick={() => setPopupInfo(null)} className="text-geo-mist hover:text-geo-white text-sm">×</button>
                </div>
                <p className="text-geo-mist text-[11px] mb-2">{popupInfo.mine.region}, {popupInfo.mine.country}</p>
                <div className="flex items-center gap-2">
                  <span className="bg-copper-primary text-white px-1.5 py-0.5 rounded text-[10px] font-bold">
                    {popupInfo.mine.commodityCode}
                  </span>
                  <span className="text-geo-mist text-[11px]">DPI: <strong className="text-geo-white">{popupInfo.mine.dpi}</strong></span>
                </div>
                {onMineSelect && (
                  <button
                    onClick={() => onMineSelect(popupInfo.mine)}
                    className="mt-2 w-full text-center text-[11px] text-brand-primary hover:underline"
                  >
                    Open detail panel →
                  </button>
                )}
              </div>
            </Popup>
          )}
        </Map>
      </DeckGL>

      {/* Hover tooltip (shown alongside pointer) */}
      {hoveredMine && !popupInfo && (
        <div
          className="absolute pointer-events-none z-30 bg-geo-graphite border border-geo-steel rounded-xl px-3 py-2 shadow-lg"
          style={{ left: hoveredMine.x + 12, top: hoveredMine.y - 40 }}
        >
          <p className="text-[11px] font-semibold text-geo-white">{hoveredMine.mine.name}</p>
          <p className="text-[10px] text-geo-mist">DPI {hoveredMine.mine.dpi} · {hoveredMine.mine.commodityCode}</p>
        </div>
      )}
    </div>
  );
}

// ── Map layer store (lightweight — no Zustand needed at this scale) ────────────
export type { Mine };
