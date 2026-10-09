import { getSocket } from './socket.js';
import api from './api.js';

export const TRACKING_CONFIG = {
  IDLE: {
    enabled: false,
    interval: 0,
    distanceThreshold: 0,
  },
  ASSIGNED: {
    enabled: true,
    interval: 120000, // 2 minutes
    distanceThreshold: 100, // 100 meters
  },
  EN_ROUTE: {
    enabled: true,
    interval: 15000, // 15 seconds
    distanceThreshold: 75, // 75 meters
  },
  NEAR_DESTINATION: {
    enabled: true,
    interval: 5000, // 5 seconds
    distanceThreshold: 30, // 30 meters
  },
  ARRIVED: {
    enabled: true,
    interval: 60000, // 60 seconds
    distanceThreshold: 100,
  },
  DELIVERING: {
    enabled: true,
    interval: 60000, // 60 seconds
    distanceThreshold: 100,
  },
};

/**
 * Calculate distance in meters between two coordinates
 */
function getDistanceMeters(p1, p2) {
  if (!p1 || !p2) return 0;
  const R = 6371e3; // metres
  const φ1 = (p1.lat * Math.PI) / 180;
  const φ2 = (p2.lat * Math.PI) / 180;
  const Δφ = ((p2.lat - p1.lat) * Math.PI) / 180;
  const Δλ = ((p2.lng - p1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

class LocationTrackingService {
  constructor() {
    this.timerId = null;
    this.watchId = null;
    this.currentTask = null;
    this.lastSentLocation = null;
    this.lastSentTime = 0;
    this.latestPosition = null;
    this.isTracking = false;
    this.batteryLevel = 1.0;
    this.isCharging = false;
    this.listeners = new Set();
    this.simulationTimer = null;
    this.isSimulating = false;

    this.initBatteryMonitoring();
  }

  async initBatteryMonitoring() {
    try {
      if ('getBattery' in navigator) {
        const battery = await navigator.getBattery();
        this.batteryLevel = battery.level;
        this.isCharging = battery.charging;

        battery.addEventListener('levelchange', () => {
          this.batteryLevel = battery.level;
          this.notifySubscribers();
        });
        battery.addEventListener('chargingchange', () => {
          this.isCharging = battery.charging;
          this.notifySubscribers();
        });
      }
    } catch {
      // Battery API not supported or permissions denied
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifySubscribers() {
    const state = this.getStatus();
    this.listeners.forEach((l) => l(state));
  }

  getStatus() {
    const mode = this.getEffectiveMode();
    const config = TRACKING_CONFIG[mode] || TRACKING_CONFIG.IDLE;
    const interval = this.calculateInterval(config.interval);

    return {
      isTracking: this.isTracking,
      isSimulating: this.isSimulating,
      mode,
      intervalMs: interval,
      batteryLevel: Math.round(this.batteryLevel * 100),
      isCharging: this.isCharging,
      latestPosition: this.latestPosition,
      lastSentTime: this.lastSentTime,
    };
  }

  getEffectiveMode() {
    if (!this.currentTask) return 'IDLE';
    const status = this.currentTask.status;

    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(status)) return 'IDLE';

    if (status === 'EN_ROUTE' && this.currentTask.destination && this.latestPosition) {
      const dist = getDistanceMeters(this.latestPosition, this.currentTask.destination);
      if (dist < 500) return 'NEAR_DESTINATION';
    }

    return status in TRACKING_CONFIG ? status : 'IDLE';
  }

  calculateInterval(baseInterval) {
    if (!baseInterval) return 0;
    let factor = 1.0;
    // Duty-cycle battery preservation
    if (!this.isCharging) {
      if (this.batteryLevel < 0.15) factor = 4.0;
      else if (this.batteryLevel < 0.3) factor = 2.0;
    }
    return Math.round(baseInterval * factor);
  }

  /**
   * Start tracking for a specific driver task
   */
  startTracking(task) {
    this.currentTask = task;
    this.isTracking = true;

    if (!('geolocation' in navigator)) {
      console.warn('Geolocation not available in browser');
      return;
    }

    this.scheduleNextTick();
    this.notifySubscribers();
  }

  /**
   * Update task state during ongoing delivery
   */
  updateTask(task) {
    this.currentTask = task;
    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(task?.status)) {
      this.stopTracking();
    } else {
      this.scheduleNextTick();
    }
    this.notifySubscribers();
  }

  stopTracking() {
    this.isTracking = false;
    this.currentTask = null;
    if (this.timerId) clearTimeout(this.timerId);
    if (this.watchId) navigator.geolocation.clearWatch(this.watchId);
    if (this.simulationTimer) clearInterval(this.simulationTimer);
    this.isSimulating = false;
    this.notifySubscribers();
  }

  scheduleNextTick() {
    if (!this.isTracking) return;
    if (this.timerId) clearTimeout(this.timerId);

    const mode = this.getEffectiveMode();
    const config = TRACKING_CONFIG[mode];

    if (!config || !config.enabled) {
      this.isTracking = false;
      this.notifySubscribers();
      return;
    }

    const interval = this.calculateInterval(config.interval);

    this.timerId = setTimeout(async () => {
      await this.captureAndSendLocation();
      this.scheduleNextTick();
    }, interval);
  }

  async captureAndSendLocation() {
    if (!this.isTracking) return;

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const loc = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            speed: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0, // km/h
            heading: pos.coords.heading,
            batteryLevel: Math.round(this.batteryLevel * 100),
            isCharging: this.isCharging,
            isSimulation: this.isSimulating,
            timestamp: new Date().toISOString(),
          };

          this.latestPosition = loc;
          await this.evaluateAndSend(loc);
          this.notifySubscribers();
          resolve(loc);
        },
        (err) => {
          console.warn('GPS location capture warning:', err.message);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
    });
  }

  async evaluateAndSend(loc) {
    const mode = this.getEffectiveMode();
    const config = TRACKING_CONFIG[mode] || TRACKING_CONFIG.EN_ROUTE;

    const now = Date.now();
    const timeElapsed = now - this.lastSentTime;

    let distanceMoved = 0;
    if (this.lastSentLocation) {
      distanceMoved = getDistanceMeters(loc, this.lastSentLocation);
    }

    // Duty-cycle filtering: only transmit if moved enough or elapsed max interval
    const shouldSend =
      !this.lastSentLocation ||
      distanceMoved >= config.distanceThreshold ||
      timeElapsed >= config.interval * 1.5;

    if (shouldSend) {
      await this.transmitLocation(loc);
      this.lastSentLocation = loc;
      this.lastSentTime = now;
    }
  }

  async transmitLocation(loc) {
    const payload = {
      ...loc,
      taskId: this.currentTask?._id,
      vehicleId: this.currentTask?.vehicleId?._id || this.currentTask?.vehicleId,
    };

    // Try Socket.IO first
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit('driver:location', payload);
      return;
    }

    // Fallback to REST API
    try {
      await api.post('/tracking/ping', payload);
    } catch (err) {
      console.warn('Location REST fallback error:', err.message);
    }
  }

  /**
   * Driver route simulator: smoothly moves vehicle towards destination coordinates
   * (Essential for testing and visual demonstration on desktop!)
   */
  startSimulation(startCoords, destCoords, steps = 30, routeWaypoints = []) {
    if (this.simulationTimer) clearInterval(this.simulationTimer);
    this.isSimulating = true;
    this.isTracking = true;

    let step = 0;
    const route = routeWaypoints.length > 1
      ? routeWaypoints.map((point) => Array.isArray(point)
        ? { lat: point[0], lng: point[1] }
        : point)
      : [startCoords, destCoords];
    const routeIndexForStep = (currentStep) =>
      Math.min(route.length - 1, Math.floor((currentStep / steps) * (route.length - 1)));

    this.simulationTimer = setInterval(async () => {
      step++;
      const routePoint = route[routeIndexForStep(step)];

      const loc = {
        lat: Number(routePoint.lat.toFixed(6)),
        lng: Number(routePoint.lng.toFixed(6)),
        accuracy: 10,
        speed: 25,
        heading: 45,
        batteryLevel: Math.round(this.batteryLevel * 100),
        isCharging: this.isCharging,
        timestamp: new Date().toISOString(),
      };

      this.latestPosition = loc;
      await this.transmitLocation(loc);
      this.notifySubscribers();

      if (step >= steps) {
        clearInterval(this.simulationTimer);
        this.isSimulating = false;
        this.notifySubscribers();
      }
    }, 3000); // Ticks every 3 seconds
  }
}

export const locationTrackingService = new LocationTrackingService();
export default locationTrackingService;
