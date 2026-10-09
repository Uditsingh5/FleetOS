/**
 * Utility for calculating realistic driving routes between two coordinates.
 * Queries free public OSRM driving engine with graceful offline fallback.
 */

const routeCache = new Map();

/**
 * Generate interpolated road waypoints between two points
 */
export function generateCurvedWaypoints(from, to, segments = 10) {
  if (!from || !to) return [];
  const coords = [[from.lat, from.lng]];

  const dLat = to.lat - from.lat;
  const dLng = to.lng - from.lng;

  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const curve = Math.sin(t * Math.PI) * (dLng * 0.12 - dLat * 0.08);
    const lat = from.lat + dLat * t + (i % 2 === 0 ? curve * 0.35 : -curve * 0.2);
    const lng = from.lng + dLng * t + (i % 2 === 1 ? curve * 0.45 : -curve * 0.25);
    coords.push([Number(lat.toFixed(6)), Number(lng.toFixed(6))]);
  }

  coords.push([to.lat, to.lng]);
  return coords;
}

/**
 * Fetch real road coordinates using OSRM.
 * @param {{ lat: number, lng: number }} from
 * @param {{ lat: number, lng: number }} to
 * @returns {Promise<{ positions: [number, number][], distanceKm: number, durationMin: number }>}
 */
export async function getRoadRoute(from, to) {
  if (!from || !to || from.lat == null || to.lat == null) {
    return { positions: [], distanceKm: 0, durationMin: 0 };
  }

  const cacheKey = `${from.lat.toFixed(4)},${from.lng.toFixed(4)}->${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;
  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const osrmBase = (import.meta.env.VITE_OSRM_URL || 'https://router.project-osrm.org').replace(/\/$/, '');
    const url = `${osrmBase}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.routes && data.routes[0]) {
        const route = data.routes[0];
        // OSRM returns [lng, lat], Leaflet needs [lat, lng]
        const positions = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        const result = {
          positions,
          distanceKm: Math.round((route.distance / 1000) * 10) / 10,
          durationMin: Math.round(route.duration / 60),
        };
        routeCache.set(cacheKey, result);
        return result;
      }
    }
  } catch {
    // Network offline or OSRM timeout: use curved road interpolation fallback
  }

  return { positions: [], distanceKm: 0, durationMin: 0 };
}
