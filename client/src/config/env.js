const trimSlash = (value = '') => String(value).replace(/\/$/, '');

export const API_ORIGIN = trimSlash(import.meta.env.VITE_API_URL || '');

export const API_BASE_URL = API_ORIGIN ? `${API_ORIGIN}/api` : '/api';

export const SOCKET_URL = API_ORIGIN || undefined;

export const MAP_TILE_URL =
  import.meta.env.VITE_MAP_TILE_URL ||
  `${API_ORIGIN || ''}/api/map/tiles/{z}/{x}/{y}.png`;

export const MAP_TILE_ATTRIBUTION =
  import.meta.env.VITE_MAP_TILE_ATTRIBUTION ||
  '&copy; OpenStreetMap contributors';

export const OSRM_URL =
  import.meta.env.VITE_OSRM_URL || 'https://router.project-osrm.org';
