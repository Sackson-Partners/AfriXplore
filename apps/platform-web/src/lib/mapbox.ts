import mapboxgl from 'mapbox-gl';

const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

if (!token) {
  throw new Error(
    'NEXT_PUBLIC_MAPBOX_TOKEN is not set. Add it to your .env.local file.'
  );
}

mapboxgl.accessToken = token;

export const MAPBOX_STYLE_DARK = 'mapbox://styles/mapbox/dark-v11';
export const MAPBOX_STYLE_SATELLITE = 'mapbox://styles/mapbox/satellite-streets-v12';
export const MAPBOX_STYLE_TERRAIN = 'mapbox://styles/mapbox/outdoors-v12';

export default mapboxgl;
