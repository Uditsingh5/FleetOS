import { getIO } from '../../lib/socket.js';
import logger from '../../lib/logger.js';
import { generateDetailedWaypoints } from './route.service.js';

// Predefined landmark coordinates across Kanpur
const KANPUR_COORDS = {
  SWAROOP_NAGAR: { lat: 26.4860, lng: 80.3240 },
  SHASTRI_NAGAR: { lat: 26.4710, lng: 80.3060 },
  KAKADEO: { lat: 26.4775, lng: 80.2930 },
  GOVIND_NAGAR: { lat: 26.4415, lng: 80.3045 },
  KIDWAI_NAGAR: { lat: 26.4325, lng: 80.3385 },
  CIVIL_LINES: { lat: 26.4720, lng: 80.3490 },
  BARRA: { lat: 26.4390, lng: 80.2880 },
  GANGA_BARRAGE: { lat: 26.5120, lng: 80.3220 }, // Main water pumping station
  BENAJHABAR: { lat: 26.4810, lng: 80.3120 },    // Municipal reservoir
};

// Calculate heading angle in degrees between two points
function calculateBearing(startLat, startLng, destLat, destLng) {
  const startLatRad = (startLat * Math.PI) / 180;
  const startLngRad = (startLng * Math.PI) / 180;
  const destLatRad = (destLat * Math.PI) / 180;
  const destLngRad = (destLng * Math.PI) / 180;

  const y = Math.sin(destLngRad - startLngRad) * Math.cos(destLatRad);
  const x =
    Math.cos(startLatRad) * Math.sin(destLatRad) -
    Math.sin(startLatRad) * Math.cos(destLatRad) * Math.cos(destLngRad - startLngRad);

  let brng = (Math.atan2(y, x) * 180) / Math.PI;
  return Math.round((brng + 360) % 360);
}

function distanceMeters(from, to) {
  const earthRadius = 6371000;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function interpolateCoordinate(from, to, fraction) {
  return {
    lat: from.lat + (to.lat - from.lat) * fraction,
    lng: from.lng + (to.lng - from.lng) * fraction,
  };
}

const route2 = [
  ...generateDetailedWaypoints(KANPUR_COORDS.BENAJHABAR, KANPUR_COORDS.KAKADEO, 10),
  ...generateDetailedWaypoints(KANPUR_COORDS.KAKADEO, KANPUR_COORDS.SWAROOP_NAGAR, 10),
  ...generateDetailedWaypoints(KANPUR_COORDS.SWAROOP_NAGAR, KANPUR_COORDS.BENAJHABAR, 10),
];

const route3 = generateDetailedWaypoints(KANPUR_COORDS.BENAJHABAR, KANPUR_COORDS.KIDWAI_NAGAR, 18);

const route4 = generateDetailedWaypoints(KANPUR_COORDS.GANGA_BARRAGE, KANPUR_COORDS.CIVIL_LINES, 18);
const route5 = generateDetailedWaypoints(KANPUR_COORDS.SWAROOP_NAGAR, KANPUR_COORDS.GOVIND_NAGAR, 16);
const route6 = generateDetailedWaypoints(KANPUR_COORDS.KAKADEO, KANPUR_COORDS.BARRA, 16);

async function fetchDemoRoadRoute(points) {
  const baseUrl = (process.env.OSRM_URL || 'https://router.project-osrm.org').replace(/\/$/, '');
  const coordinates = points.map(({ lng, lat }) => `${lng},${lat}`).join(';');
  const response = await fetch(
    `${baseUrl}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!response.ok) throw new Error(`OSRM returned HTTP ${response.status}`);
  const route = (await response.json()).routes?.[0];
  if (!route?.geometry?.coordinates?.length) throw new Error('OSRM returned no demo route');
  return route.geometry.coordinates.map(([lng, lat]) => ({
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
  }));
}

// Mock driver definitions
const INITIAL_MOCK_DRIVERS = [
  {
    _id: 'mock-veh-02',
    vehicleNumber: 'UP78-DEMO-02',
    type: 'WATER_TANKER',
    capacityLiters: 10000,
    currentWaterLevel: 9800,
    status: 'AVAILABLE',
    isDemo: true,
    driver: {
      _id: 'mock-drv-02',
      name: 'Amit Verma (Demo)',
      phone: '+91 98765 43211',
      status: 'AVAILABLE',
    },
    activeTask: null,
    waypoints: route2,
    currentStep: 4,
    heading: 85,
    speed: 28,
    batteryLevel: 97,
    currentLocation: route2[4],
    lastLocationUpdate: new Date(),
  },
  {
    _id: 'mock-veh-03',
    vehicleNumber: 'UP78-DEMO-03',
    type: 'WATER_TANKER',
    capacityLiters: 15000,
    currentWaterLevel: 5200,
    status: 'EN_ROUTE',
    isDemo: true,
    driver: {
      _id: 'mock-drv-03',
      name: 'Sunil Patel (Demo)',
      phone: '+91 98765 43212',
      status: 'BUSY',
    },
    activeTask: {
      _id: 'mock-task-03',
      status: 'EN_ROUTE',
      distanceKm: 0.1,
      estimatedArrival: new Date(Date.now() + 16 * 60000),
      request: {
        _id: 'mock-req-03',
        address: 'Kidwai Nagar Ward 12 Housing Society',
        severity: 'HIGH',
        requestedLiters: 9000,
        location: KANPUR_COORDS.KIDWAI_NAGAR,
      },
    },
    waypoints: route3,
    currentStep: 1,
    heading: 210,
    speed: 0,
    batteryLevel: 88,
    currentLocation: route3[route3.length - 1],
    lastLocationUpdate: new Date(),
  },
  {
    _id: 'mock-veh-04',
    vehicleNumber: 'UP78-DEMO-04',
    type: 'WATER_TANKER',
    capacityLiters: 8000,
    currentWaterLevel: 7500,
    status: 'EN_ROUTE',
    isDemo: true,
    driver: {
      _id: 'mock-drv-04',
      name: 'Rajesh Yadav (Demo)',
      phone: '+91 98765 43213',
      status: 'BUSY',
    },
    activeTask: {
      _id: 'mock-task-04',
      status: 'EN_ROUTE',
      distanceKm: 3.5,
      estimatedArrival: new Date(Date.now() + 18 * 60000),
      request: {
        _id: 'mock-req-04',
        address: 'Civil Lines Govt Colony Supply',
        severity: 'MEDIUM',
        requestedLiters: 6000,
        location: KANPUR_COORDS.CIVIL_LINES,
      },
    },
    waypoints: route4,
    currentStep: 6,
    heading: 110,
    speed: 36,
    batteryLevel: 91,
    currentLocation: route4[6],
    lastLocationUpdate: new Date(),
  },
  {
    _id: 'mock-veh-05',
    vehicleNumber: 'UP78-DEMO-05',
    type: 'WATER_TANKER',
    capacityLiters: 10000,
    currentWaterLevel: 10000,
    status: 'AVAILABLE',
    isDemo: true,
    driver: {
      _id: 'mock-drv-05',
      name: 'Kavita Singh (Demo)',
      phone: '+91 98765 43214',
      status: 'AVAILABLE',
    },
    activeTask: null,
    waypoints: route5,
    currentStep: 0,
    heading: 180,
    speed: 24,
    batteryLevel: 96,
    currentLocation: route5[0],
    lastLocationUpdate: new Date(),
  },
  {
    _id: 'mock-veh-06',
    vehicleNumber: 'UP78-DEMO-06',
    type: 'WATER_TANKER',
    capacityLiters: 12000,
    currentWaterLevel: 11200,
    status: 'AVAILABLE',
    isDemo: true,
    driver: {
      _id: 'mock-drv-06',
      name: 'Imran Khan (Demo)',
      phone: '+91 98765 43215',
      status: 'AVAILABLE',
    },
    activeTask: null,
    waypoints: route6,
    currentStep: 0,
    heading: 90,
    speed: 26,
    batteryLevel: 93,
    currentLocation: route6[0],
    lastLocationUpdate: new Date(),
  },
];

class SimulationEngine {
  constructor() {
    this.isActive = false;
    this.isPaused = false;
    this.routesReady = false;
    this.routeVersion = 0;
    this.intervalId = null;
    this.mockDrivers = JSON.parse(JSON.stringify(INITIAL_MOCK_DRIVERS));
    this.mockDrivers.forEach((driver) => {
      if (driver.activeTask && driver.status === 'EN_ROUTE' && driver.waypoints.length > 2) {
        const lastStart = driver.waypoints.length - 2;
        driver.currentStep = 1 + Math.floor(Math.random() * lastStart);
        driver.currentLocation = driver.waypoints[driver.currentStep];
      }
      driver.segmentProgress = 0;
    });
    this.stepIntervalMs = 250; // Emit frequent updates for smooth road-constrained motion
  }

  start() {
    if (this.isActive) return;
    if (!this.routesReady) {
      logger.warn('Demo simulation is waiting for road routes to load.');
      return;
    }
    this.isActive = true;
    this.isPaused = false;
    logger.info('🚀 Starting FleetOS Mock Driver GPS Simulator Engine...');

    this.intervalId = setInterval(() => {
      this.step();
    }, this.stepIntervalMs);
  }

  stop() {
    if (!this.isActive) return;
    this.isActive = false;
    this.isPaused = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    logger.info('🛑 Stopped FleetOS Mock Driver GPS Simulator Engine.');
  }

  toggle() {
    if (this.isActive) {
      this.stop();
    } else {
      this.start();
    }
    return this.isActive;
  }

  pause() {
    if (this.isActive) this.isPaused = true;
  }

  resume() {
    if (this.isActive) this.isPaused = false;
  }

  step() {
    if (this.isPaused) return;
    const io = getIO();
    const now = new Date();

    this.mockDrivers.forEach((driver) => {
      const waypoints = driver.waypoints;
      if (!waypoints || waypoints.length === 0) return;

      const hasActiveMission = Boolean(driver.activeTask);
      const isMovingToDestination = hasActiveMission && driver.status === 'EN_ROUTE';
      const isStoppedAtDestination = hasActiveMission && ['ARRIVED', 'DELIVERING', 'COMPLETED'].includes(driver.status);

      if (isStoppedAtDestination) {
        driver.speed = 0;
      } else {
        driver.speed = driver.status === 'DELIVERING' ? 0 : 25 + Math.floor(Math.random() * 15);
      }

      const previousCoord = driver.currentLocation;
      let nextCoord = previousCoord;

      if (!isStoppedAtDestination && waypoints.length > 1) {
        let remainingMeters = (driver.speed * 1000 * this.stepIntervalMs) / 3600000;

        while (remainingMeters > 0) {
          const segmentStart = waypoints[driver.currentStep];
          const segmentEnd = waypoints[driver.currentStep + 1];
          if (!segmentEnd) {
            if (isMovingToDestination) break;
            driver.currentStep = 0;
            driver.currentLocation = waypoints[0];
            continue;
          }

          const segmentMeters = distanceMeters(segmentStart, segmentEnd);
          if (segmentMeters === 0) {
            driver.currentStep += 1;
            driver.segmentProgress = 0;
            continue;
          }
          const segmentRemaining = segmentMeters * (1 - (driver.segmentProgress || 0));
          if (remainingMeters < segmentRemaining) {
            driver.segmentProgress =
              (driver.segmentProgress || 0) + remainingMeters / segmentMeters;
            nextCoord = interpolateCoordinate(
              segmentStart,
              segmentEnd,
              driver.segmentProgress
            );
            remainingMeters = 0;
          } else {
            remainingMeters -= segmentRemaining;
            driver.currentStep += 1;
            driver.segmentProgress = 0;
            nextCoord = waypoints[driver.currentStep];
            if (driver.currentStep >= waypoints.length - 1 && isMovingToDestination) {
              break;
            }
            if (driver.currentStep >= waypoints.length - 1) {
              driver.currentStep = 0;
              nextCoord = waypoints[0];
            }
          }
        }
      }

      // Calculate realistic bearing & speed
      const heading = calculateBearing(
        previousCoord.lat,
        previousCoord.lng,
        nextCoord.lat,
        nextCoord.lng
      );
      driver.heading = heading;
      driver.currentLocation = nextCoord;
      driver.lastLocationUpdate = now;

      if (
        isMovingToDestination &&
        driver.currentStep === waypoints.length - 1 &&
        (driver.segmentProgress || 0) === 0
      ) {
        driver.status = 'ARRIVED';
        driver.activeTask.status = 'ARRIVED';
        driver.activeTask.estimatedArrival = now;
        driver.speed = 0;
      }

      // Broadcast payload identical to real driver GPS stream
      const payload = {
        vehicleId: driver._id,
        vehicleNumber: driver.vehicleNumber,
        driverId: driver.driver._id,
        driverName: driver.driver.name,
        taskId: driver.activeTask?._id || null,
        taskStatus: driver.status,
        requestId: driver.activeTask?.request?._id || null,
        lat: nextCoord.lat,
        lng: nextCoord.lng,
        accuracy: 4.2,
        speed: driver.speed,
        heading: driver.heading,
        batteryLevel: driver.batteryLevel,
        isCharging: false,
        isStale: false,
        isDemo: true,
        timestamp: now.toISOString(),
      };

      if (io) {
        io.to('admin-room').emit('location:update', payload);
        if (driver.activeTask?._id) {
          io.to(`task:${driver.activeTask._id}`).emit('location:update', payload);
        }
      }
    });
  }

  getDrivers() {
    if (!this.routesReady) return [];

    return this.mockDrivers.map((d) => ({
      _id: d._id,
      vehicleNumber: d.vehicleNumber,
      type: d.type,
      capacityLiters: d.capacityLiters,
      currentWaterLevel: d.currentWaterLevel,
      status: d.status,
      currentLocation: d.currentLocation,
      lastLocationUpdate: d.lastLocationUpdate,
      isStale: false,
      isDemo: true,
      heading: d.heading,
      speed: d.speed,
      driver: d.driver,
      activeTask: d.activeTask
        ? {
            ...d.activeTask,
            route: {
              waypoints: d.waypoints,
              provider: 'OSRM',
              routeId: `demo-route-${this.routeVersion}-${d._id}`,
            },
            routeProgress: {
              currentPoint: d.currentStep + 1,
              totalPoints: d.waypoints.length,
              remainingPoints: Math.max(d.waypoints.length - d.currentStep - 1, 0),
              percentComplete: Math.round(((d.currentStep + 1) / d.waypoints.length) * 100),
            },
          }
        : null,
    }));
  }

  getStatus() {
    return {
      isActive: this.isActive,
      isPaused: this.isPaused,
      routesReady: this.routesReady,
      driverCount: this.mockDrivers.length,
      stepIntervalMs: this.stepIntervalMs,
      pointsPerTick: this.pointsPerTick,
    };
  }
}

export const simulationEngine = new SimulationEngine();

// Load road geometry before starting automatic demo playback so the first
// emitted position already follows the displayed route.
const autoStartDemo =
  process.env.NODE_ENV !== 'production' || process.env.AUTO_START_DEMO === 'true';

Promise.all([
  fetchDemoRoadRoute([KANPUR_COORDS.BENAJHABAR, KANPUR_COORDS.KAKADEO, KANPUR_COORDS.SWAROOP_NAGAR]),
  fetchDemoRoadRoute([KANPUR_COORDS.BENAJHABAR, KANPUR_COORDS.KIDWAI_NAGAR]),
  fetchDemoRoadRoute([KANPUR_COORDS.GANGA_BARRAGE, KANPUR_COORDS.CIVIL_LINES]),
])
  .then(([roadRoute2, roadRoute3, roadRoute4]) => {
    const routes = [roadRoute2, roadRoute3, roadRoute4];
    simulationEngine.routeVersion += 1;
    simulationEngine.mockDrivers.forEach((driver, index) => {
      const route = routes[index];
      if (!route?.length) return;
      // Keep the complete OSRM geometry. Dropping road vertices creates
      // straight chords that can cut across buildings and gardens.
      driver.waypoints = route;
      driver.currentStep = Math.min(driver.currentStep, driver.waypoints.length - 1);
      driver.segmentProgress = 0;
      driver.currentLocation = driver.waypoints[driver.currentStep];
      driver.routeProvider = 'OSRM';
      driver.routeVersion = simulationEngine.routeVersion;
    });
    simulationEngine.routesReady = true;
    logger.info('Loaded road-based routes for mock driver telemetry.');
    if (autoStartDemo) simulationEngine.start();
  })
  .catch((error) => {
    logger.error({ err: error }, 'Demo simulation disabled because OSRM road routes could not be loaded.');
  });
