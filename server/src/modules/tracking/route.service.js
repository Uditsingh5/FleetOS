/**
 * Route / ETA calculation service.
 *
 * Uses OSRM road geometry for route calculation and Haversine only for
 * recommendations or when no road route is available.
 */

const EARTH_RADIUS_KM = 6371;
const DEFAULT_SPEED_KMH = 25; // Average urban speed for water tankers

/**
 * Convert degrees to radians.
 */
const toRadians = (degrees) => (degrees * Math.PI) / 180;

/**
 * Calculate distance between two points using Haversine formula.
 * @param {{ lat: number, lng: number }} from
 * @param {{ lat: number, lng: number }} to
 * @returns {number} Distance in kilometers
 */
export const calculateDistance = (from, to) => {
  if (!from || !to || from.lat == null || from.lng == null || to.lat == null || to.lng == null) {
    return null;
  }

  const dLat = toRadians(to.lat - from.lat);
  const dLon = toRadians(to.lng - from.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
};

/**
 * Estimate time of arrival.
 * @param {number} distanceKm  Distance in km
 * @param {number} [speedKmh]  Average speed in km/h
 * @returns {{ minutes: number, eta: Date }} ETA information
 */
export const estimateETA = (distanceKm, speedKmh = DEFAULT_SPEED_KMH) => {
  if (distanceKm == null || distanceKm < 0) return null;
  const minutes = Math.round((distanceKm / speedKmh) * 60);
  const eta = new Date(Date.now() + minutes * 60000);
  return { minutes, eta };
};

// Demo-only telemetry paths. Persisted delivery tasks always use OSRM below.
export const generateDetailedWaypoints = (from, to, segments = 8) => {
  if (!from || !to) return [];
  return Array.from({ length: Math.max(2, segments + 1) }, (_, index) => {
    const progress = index / Math.max(1, segments);
    return {
      lat: Number((from.lat + (to.lat - from.lat) * progress).toFixed(6)),
      lng: Number((from.lng + (to.lng - from.lng) * progress).toFixed(6)),
    };
  });
};

/**
 * Fetch a driving route from OSRM. Coordinates returned by OSRM are
 * road geometry, not interpolated points between the endpoints.
 */
export const generateRoute = async (from, to) => {
  const distance = calculateDistance(from, to);
  if (distance == null) return null;

  const baseUrl = (process.env.OSRM_URL || 'https://router.project-osrm.org').replace(/\/$/, '');
  const url =
    `${baseUrl}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}` +
    '?overview=full&geometries=geojson&steps=false';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`OSRM returned HTTP ${response.status}`);
    }
    const data = await response.json();
    const route = data.routes?.[0];
    const coordinates = route?.geometry?.coordinates;
    if (!route || !coordinates?.length) {
      throw new Error('OSRM returned no drivable route');
    }

    const waypoints = coordinates.map(([lng, lat]) => ({
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
    }));
    const routeDistance = route.distance / 1000;
    const etaInfo = {
      minutes: Math.round(route.duration / 60000),
      eta: new Date(Date.now() + route.duration),
    };

    return {
      from,
      to,
      distanceKm: Math.round(routeDistance * 100) / 100,
      estimatedMinutes: etaInfo.minutes,
      eta: etaInfo.eta,
      waypoints,
      provider: 'OSRM',
    };
  } finally {
    clearTimeout(timeoutId);
  }
};
