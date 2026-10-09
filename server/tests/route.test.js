import { calculateDistance, estimateETA } from '../src/modules/tracking/route.service.js';

describe('Route & Fleet Tracking Distance Service', () => {
  test('Calculates Haversine distance correctly between Kanpur coordinates', () => {
    // Kakadeo to Shastri Nagar (approx 1.5 - 2 km)
    const kakadeo = { lat: 26.4770, lng: 80.2925 };
    const shastriNagar = { lat: 26.4712, lng: 80.3065 };

    const distance = calculateDistance(kakadeo, shastriNagar);
    expect(distance).toBeGreaterThan(1.0);
    expect(distance).toBeLessThan(3.0);
  });

  test('Calculates zero distance for same location', () => {
    const point = { lat: 26.4770, lng: 80.2925 };
    const distance = calculateDistance(point, point);
    expect(distance).toBe(0);
  });

  test('Estimates realistic urban ETA for water tankers', () => {
    // 5 km at default 25 km/h urban speed -> 12 minutes
    const eta = estimateETA(5);
    expect(eta).toBeDefined();
    expect(eta.minutes).toBe(12);
    expect(eta.eta.getTime()).toBeGreaterThan(Date.now());
  });
});
