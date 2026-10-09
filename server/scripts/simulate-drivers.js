#!/usr/bin/env node

/**
 * WaterFleetOS - Standalone Driver GPS Telemetry Simulator
 * 
 * Usage:
 *   node scripts/simulate-drivers.js
 *   npm run demo:drivers
 * 
 * Simulates multiple real-time drivers moving across Kanpur with
 * live coordinates, heading, speed, and delivery missions.
 */

import { io } from 'socket.io-client';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';

// Kanpur Key Coordinates
const KANPUR_ZONES = {
  SWAROOP_NAGAR: { lat: 26.4860, lng: 80.3240, name: 'Swaroop Nagar Depot' },
  SHASTRI_NAGAR: { lat: 26.4710, lng: 80.3060, name: 'Shastri Nagar Block 4' },
  KAKADEO:       { lat: 26.4775, lng: 80.2930, name: 'Kakadeo Coaching Hub' },
  GOVIND_NAGAR:  { lat: 26.4415, lng: 80.3045, name: 'Govind Nagar Sector 3' },
  KIDWAI_NAGAR:  { lat: 26.4325, lng: 80.3385, name: 'Kidwai Nagar Colony' },
  CIVIL_LINES:   { lat: 26.4720, lng: 80.3490, name: 'Civil Lines Admin Zone' },
};

function generateWaypoints(from, to, count = 12) {
  const points = [];
  const dLat = to.lat - from.lat;
  const dLng = to.lng - from.lng;

  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const curve = Math.sin(t * Math.PI) * (dLng * 0.15 - dLat * 0.1);
    points.push({
      lat: Number((from.lat + dLat * t + (i % 2 === 0 ? curve * 0.3 : -curve * 0.2)).toFixed(6)),
      lng: Number((from.lng + dLng * t + (i % 2 === 1 ? curve * 0.4 : -curve * 0.3)).toFixed(6)),
    });
  }
  return points;
}

function calculateBearing(p1, p2) {
  const y = Math.sin((p2.lng - p1.lng) * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180);
  const x = Math.cos(p1.lat * Math.PI / 180) * Math.sin(p2.lat * Math.PI / 180) -
            Math.sin(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * Math.cos((p2.lng - p1.lng) * Math.PI / 180);
  return Math.round(((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360);
}

const DRIVERS_CONFIG = [
  {
    email: 'driver1@waterfleet.gov.in',
    password: 'Password@123',
    vehicleNumber: 'UP78-WT-1001',
    driverName: 'Suresh Kumar',
    route: [
      ...generateWaypoints(KANPUR_ZONES.SWAROOP_NAGAR, KANPUR_ZONES.SHASTRI_NAGAR, 14),
      ...generateWaypoints(KANPUR_ZONES.SHASTRI_NAGAR, KANPUR_ZONES.SWAROOP_NAGAR, 14),
    ],
  },
  {
    email: 'driver2@waterfleet.gov.in',
    password: 'Password@123',
    vehicleNumber: 'UP78-WT-1002',
    driverName: 'Manoj Tiwari',
    route: [
      ...generateWaypoints(KANPUR_ZONES.KAKADEO, KANPUR_ZONES.GOVIND_NAGAR, 14),
      ...generateWaypoints(KANPUR_ZONES.GOVIND_NAGAR, KANPUR_ZONES.KAKADEO, 14),
    ],
  },
  {
    email: 'driver3@waterfleet.gov.in',
    password: 'Password@123',
    vehicleNumber: 'UP78-WT-1003',
    driverName: 'Dinesh Rawat',
    route: [
      ...generateWaypoints(KANPUR_ZONES.CIVIL_LINES, KANPUR_ZONES.KIDWAI_NAGAR, 14),
      ...generateWaypoints(KANPUR_ZONES.KIDWAI_NAGAR, KANPUR_ZONES.CIVIL_LINES, 14),
    ],
  },
  {
    email: 'driver4@waterfleet.gov.in',
    password: 'Password@123',
    vehicleNumber: 'UP78-WT-1004',
    driverName: 'Ashok Pal',
    route: [
      ...generateWaypoints(KANPUR_ZONES.SWAROOP_NAGAR, KANPUR_ZONES.CIVIL_LINES, 14),
      ...generateWaypoints(KANPUR_ZONES.CIVIL_LINES, KANPUR_ZONES.SWAROOP_NAGAR, 14),
    ],
  },
  {
    email: 'driver5@waterfleet.gov.in',
    password: 'Password@123',
    vehicleNumber: 'UP78-WT-1005',
    driverName: 'Rajendra Yadav',
    route: [
      ...generateWaypoints(KANPUR_ZONES.KIDWAI_NAGAR, KANPUR_ZONES.GOVIND_NAGAR, 14),
      ...generateWaypoints(KANPUR_ZONES.GOVIND_NAGAR, KANPUR_ZONES.KIDWAI_NAGAR, 14),
    ],
  },
];

async function loginDriver(driver) {
  try {
    const res = await fetch(`${SERVER_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: driver.email, password: driver.password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn(`[WARN] Login failed for ${driver.email}:`, err.message || res.status);
      return null;
    }
    const data = await res.json();
    return { token: data.token, user: data.user };
  } catch (err) {
    console.error(`[ERROR] Connection failed to ${SERVER_URL}:`, err.message);
    return null;
  }
}

async function runSimulator() {
  console.log('\n' + '='.repeat(70));
  console.log('   🚀 WATERFLEET-OS REAL-TIME MOCK DRIVER TELEMETRY SIMULATOR');
  console.log('   Target Server: ' + SERVER_URL);
  console.log('='.repeat(70) + '\n');

  console.log('Logging in 3 driver bots...');
  const activeBots = [];

  for (const config of DRIVERS_CONFIG) {
    const session = await loginDriver(config);
    if (!session) {
      console.warn(`⚠️  Could not log in ${config.driverName}. Make sure server is running and seeded.`);
      continue;
    }

    // Connect via socket
    const socket = io(SERVER_URL, {
      auth: { token: session.token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log(`[CONNECTED] 🛰️  ${config.driverName} (${config.vehicleNumber}) [Socket: ${socket.id}]`);
    });

    socket.on('connect_error', (err) => {
      console.warn(`[SOCKET ERR] ${config.driverName}:`, err.message);
    });

    activeBots.push({
      ...config,
      token: session.token,
      user: session.user,
      socket,
      step: Math.floor(Math.random() * config.route.length),
    });
  }

  if (activeBots.length === 0) {
    console.error('\n❌ No drivers could be initialized. Please run: npm run seed on server.\n');
    process.exit(1);
  }

  console.log(`\n✅ ${activeBots.length} driver bots active! Emitting GPS telemetry stream every 2.5s...\n`);

  setInterval(() => {
    console.clear();
    console.log('='.repeat(75));
    console.log(` 🚰 FLEETOS LIVE MOCK DRIVER STREAM - ${new Date().toLocaleTimeString('en-IN')} IST`);
    console.log('='.repeat(75));
    console.log(' Vehicle       Driver         Latitude   Longitude   Speed   Bearing  Status');
    console.log('-'.repeat(75));

    activeBots.forEach((bot) => {
      const prevCoord = bot.route[bot.step];
      bot.step = (bot.step + 1) % bot.route.length;
      const coord = bot.route[bot.step];

      const bearing = calculateBearing(prevCoord, coord);
      const speed = 26 + Math.floor(Math.random() * 14);

      // Emit via Socket.io
      bot.socket.emit('driver:location', {
        lat: coord.lat,
        lng: coord.lng,
        accuracy: 3.5,
        speed,
        heading: bearing,
        batteryLevel: 94,
        isCharging: false,
        isSimulation: true,
        isDemo: true,
        timestamp: new Date().toISOString(),
      });

      // Also HTTP ping as fallback to ensure DB is continuously updated
      fetch(`${SERVER_URL}/api/tracking/ping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bot.token}`,
        },
        body: JSON.stringify({
          lat: coord.lat,
          lng: coord.lng,
          speed,
          heading: bearing,
          batteryLevel: 94,
          isSimulation: true,
        }),
      }).catch(() => {});

      console.log(
        ` ${bot.vehicleNumber.padEnd(13)} ` +
        `${bot.driverName.padEnd(14)} ` +
        `${coord.lat.toFixed(4).padEnd(10)} ` +
        `${coord.lng.toFixed(4).padEnd(11)} ` +
        `${(speed + ' km/h').padEnd(7)} ` +
        `${(bearing + '°').padEnd(8)} ` +
        `ON PATROL`
      );
    });

    console.log('='.repeat(75));
    console.log(' Press Ctrl+C to terminate simulator stream.');
  }, 2500);
}

runSimulator();
