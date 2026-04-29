'use client';

import { useIsAuthenticated } from '@azure/msal-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

export default function MapPage() {
  const isAuthenticated = useIsAuthenticated();
  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
      return;
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [25, -5], // Central Africa
      zoom: 4,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.addControl(new mapboxgl.ScaleControl(), 'bottom-left');

    map.on('load', () => {
      // Placeholder mine points layer — data will come from the API
      map.addSource('mines', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'mines-circles',
        type: 'circle',
        source: 'mines',
        paint: {
          'circle-radius': 5,
          'circle-color': [
            'match',
            ['get', 'commodity'],
            ['gold'], '#F59E0B',
            ['copper', 'cobalt'], '#EF4444',
            ['platinum', 'palladium', 'pgm'], '#8B5CF6',
            '#6B7280',
          ],
          'circle-opacity': 0.85,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff',
        },
      });
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;

  return (
    <main className="h-screen flex flex-col">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <h1 className="font-semibold text-gray-900">Mine Map</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block" /> Gold</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-400 inline-block" /> Copper/Cobalt</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-violet-500 inline-block" /> PGM</span>
        </div>
      </nav>
      <div ref={mapContainerRef} className="flex-1" />
    </main>
  );
}
