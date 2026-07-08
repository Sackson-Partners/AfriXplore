'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import { MAPBOX_STYLE_SATELLITE } from '@/lib/mapbox';

interface SurveyMapProps {
  onPolygonChange?: (geojson: GeoJSON.Feature | null, areaKm2: number) => void;
  className?: string;
}

function computeAreaKm2(feature: GeoJSON.Feature): number {
  // Rough spherical excess calculation — avoids @turf/turf dep for now
  if (feature.geometry.type !== 'Polygon') return 0;
  const coords = (feature.geometry as GeoJSON.Polygon).coordinates[0];
  let area = 0;
  const R = 6371;
  for (let i = 0; i < coords.length - 1; i++) {
    const [lng1, lat1] = coords[i];
    const [lng2, lat2] = coords[i + 1];
    area += ((lng2 - lng1) * Math.PI / 180) *
      (2 + Math.sin(lat1 * Math.PI / 180) + Math.sin(lat2 * Math.PI / 180));
  }
  return Math.abs(area * R * R / 2);
}

export default function SurveyMap({ onPolygonChange, className = 'w-full h-full' }: SurveyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drawRef = useRef<any>(null);
  const [areaKm2, setAreaKm2] = useState(0);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAPBOX_STYLE_SATELLITE,
      center: [25.0, 0.0],
      zoom: 4,
    });

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { polygon: true, trash: true },
      defaultMode: 'simple_select',
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.addControl(draw as unknown as mapboxgl.IControl, 'top-left');

    map.on('load', () => {
      mapRef.current = map;
      drawRef.current = draw;
    });

    const handleUpdate = () => {
      const data = draw.getAll();
      if (!data.features.length) {
        setAreaKm2(0);
        onPolygonChange?.(null, 0);
        return;
      }
      const feature = data.features[0] as GeoJSON.Feature;
      const area = computeAreaKm2(feature);
      setAreaKm2(area);
      onPolygonChange?.(feature, area);
    };

    map.on('draw.create', handleUpdate);
    map.on('draw.update', handleUpdate);
    map.on('draw.delete', handleUpdate);

    return () => {
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className={className} />
      {areaKm2 > 0 && (
        <div className="absolute bottom-8 left-4 bg-black/70 text-white text-sm px-3 py-1.5 rounded-md">
          Survey Area: {areaKm2.toFixed(1)} km²
        </div>
      )}
    </div>
  );
}
