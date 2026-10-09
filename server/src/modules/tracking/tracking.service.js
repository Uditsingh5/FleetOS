import Vehicle from '../vehicles/vehicle.model.js';
import Driver from '../drivers/driver.model.js';
import Task from '../tasks/task.model.js';
import WaterRequest from '../requests/request.model.js';
import VehicleLocation from './vehicleLocation.model.js';
import { calculateDistance } from './route.service.js';
import { getIO } from '../../lib/socket.js';
import AppError from '../../utils/AppError.js';
import env from '../../config/env.js';
import logger from '../../lib/logger.js';

// Cache to sample history efficiently in memory before DB writes
const lastHistorySave = new Map(); // vehicleId -> { timestamp, lat, lng }
const lastAcceptedLocation = new Map(); // driver user id -> timestamp

const ACTIVE_TASK_STATUSES = ['ASSIGNED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'DELIVERING'];

/**
 * Record a location update from an authorized driver.
 */
export const recordLocation = async ({
  driverUserId,
  taskId = null,
  vehicleId = null,
  lat,
  lng,
  accuracy = null,
  speed = null,
  heading = null,
  batteryLevel = null,
  isCharging = null,
  isSimulation = false,
  timestamp = new Date(),
}) => {
  // Validate coordinates
  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) {
    throw new AppError('Invalid coordinates provided', 400, 'INVALID_COORDINATES');
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new AppError('Coordinates out of range', 400, 'INVALID_COORDINATES_RANGE');
  }

  const parsedTimestamp = timestamp ? new Date(timestamp) : new Date();
  if (Number.isNaN(parsedTimestamp.getTime())) {
    throw new AppError('Invalid location timestamp', 400, 'INVALID_LOCATION_TIMESTAMP');
  }
  if (parsedTimestamp.getTime() > Date.now() + 30000) {
    throw new AppError('Location timestamp cannot be in the future', 400, 'INVALID_LOCATION_TIMESTAMP');
  }

  const driverKey = driverUserId.toString();
  const previousTimestamp = lastAcceptedLocation.get(driverKey);
  if (previousTimestamp && parsedTimestamp.getTime() <= previousTimestamp) {
    throw new AppError('Stale location update ignored', 409, 'STALE_LOCATION');
  }

  // Find driver
  const driver = await Driver.findOne({ userId: driverUserId });
  if (!driver) {
    throw new AppError('Driver profile not found', 404, 'DRIVER_NOT_FOUND');
  }

  // Find active task for driver (optional, driver can also be on standby/patrol)
  const activeTask = await Task.findOne({
    driverId: driver._id,
    status: { $in: ACTIVE_TASK_STATUSES },
  }).populate('requestId');

  if (taskId && (!activeTask || activeTask._id.toString() !== taskId.toString())) {
    throw new AppError('Location task does not belong to the active driver assignment', 403, 'TASK_MISMATCH');
  }

  // Find vehicle linked to task or driver's current vehicle
  let vehicle = null;
  if (activeTask?.vehicleId) {
    vehicle = await Vehicle.findById(activeTask.vehicleId);
  }
  if (!vehicle && driver.currentVehicleId) {
    vehicle = await Vehicle.findById(driver.currentVehicleId);
  }
  if (!vehicle) {
    vehicle = await Vehicle.findOne({ driverId: driver._id });
  }

  if (vehicleId && (!vehicle || vehicle._id.toString() !== vehicleId.toString())) {
    throw new AppError('Location vehicle does not belong to the active driver assignment', 403, 'VEHICLE_MISMATCH');
  }

  const now = parsedTimestamp;
  if (!isSimulation) {
    lastAcceptedLocation.set(driverKey, now.getTime());
  }

  // Simulation telemetry is broadcast to authorized viewers but never
  // overwrites the driver's verified GPS position or vehicle state.
  if (!isSimulation) {
    driver.currentLocation = { lat, lng };
    driver.lastLocationUpdate = now;
    await driver.save();
  }

  // Update vehicle's location if assigned
  if (vehicle) {
    if (!isSimulation) {
      vehicle.currentLocation = { lat, lng };
      vehicle.lastLocationUpdate = now;
      await vehicle.save();
    }

    // Location history sampling:
    const cacheKey = vehicle._id.toString();
    const lastSample = lastHistorySave.get(cacheKey);
    let shouldSample = false;

    if (isSimulation) {
      shouldSample = false;
    } else if (!lastSample) {
      shouldSample = true;
    } else {
      const elapsedMs = now.getTime() - lastSample.timestamp.getTime();
      const distanceMoved = calculateDistance({ lat, lng }, { lat: lastSample.lat, lng: lastSample.lng });
      if (elapsedMs >= 30000 || (distanceMoved && distanceMoved >= 0.1)) {
        shouldSample = true;
      }
    }

    if (shouldSample) {
      lastHistorySave.set(cacheKey, { timestamp: now, lat, lng });
      await VehicleLocation.create({
        vehicleId: vehicle._id,
        taskId: activeTask?._id || null,
        lat,
        lng,
        accuracy,
        speed,
        heading,
        timestamp: now,
      });
    }
  }

  // Prepare realtime broadcast payload
  const isStale = false;
  const payload = {
    vehicleId: vehicle?._id || null,
    vehicleNumber: vehicle?.vehicleNumber || 'PATROL-UNIT',
    driverId: driver._id,
    driverName: driver.userId?.name,
    taskId: activeTask?._id || null,
    taskStatus: activeTask?.status || driver.status,
    requestId: activeTask?.requestId?._id || null,
    lat,
    lng,
    accuracy,
    speed,
    heading,
    batteryLevel,
    isCharging,
    isDemo: isSimulation,
    isSimulation,
    isStale,
    timestamp: now.toISOString(),
  };

  // Broadcast through Socket.IO
  const io = getIO();
  if (io) {
    // 1. Admin command center room
    io.to('admin-room').emit('location:update', payload);

    // 2. Specific task room
    if (activeTask?._id) {
      io.to(`task:${activeTask._id}`).emit('location:update', payload);
    }

    // 3. Citizen room if request has citizen
    if (activeTask?.requestId?.citizenId) {
      io.to(`citizen:${activeTask.requestId.citizenId}`).emit('location:update', payload);
      io.to(`user:${activeTask.requestId.citizenId}`).emit('location:update', payload);
    }
  }

  return payload;
};

/**
 * Check whether a socket user may subscribe to a task location stream.
 * Room membership is deliberately authorized server-side; task ids are not
 * treated as secrets supplied by the browser.
 */
export const canSubscribeToTask = async (taskId, user) => {
  if (!taskId || !user) return false;
  if (taskId.toString().startsWith('mock-')) {
    return ['ADMIN', 'SUPER_ADMIN', 'DRIVER', 'CITIZEN'].includes(user.role);
  }
  const task = await Task.findById(taskId).populate({
    path: 'requestId',
    select: 'citizenId',
  });
  if (!task) return false;
  if (['ADMIN', 'SUPER_ADMIN'].includes(user.role)) return true;
  if (user.role === 'DRIVER') {
    const driver = await Driver.findOne({ userId: user.userId }).select('_id');
    return Boolean(driver && task.driverId?.toString() === driver._id.toString());
  }
  return (
    user.role === 'CITIZEN' &&
    task.requestId?.citizenId?.toString() === user.userId.toString()
  );
};

import { simulationEngine } from './simulation.service.js';

/**
 * Get all vehicles live status for the admin map.
 * Supports mode='all' | 'real' | 'demo'.
 */
export const getAdminFleetLocations = async (mode = 'all') => {
  const staleThreshold = env.locationStaleThreshold || 60000;
  const now = Date.now();

  if (mode === 'demo') {
    return simulationEngine.getDrivers();
  }

  const vehicles = await Vehicle.find({ isActive: true })
    .populate({
      path: 'driverId',
      populate: { path: 'userId', select: 'name phone' },
    })
    .lean();

  // Find active tasks for all vehicles
  const vehicleIds = vehicles.map((v) => v._id);
  const activeTasks = await Task.find({
    vehicleId: { $in: vehicleIds },
    status: { $in: ['ASSIGNED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'DELIVERING'] },
  })
    .populate('requestId', 'address location severity requestedLiters')
    .lean();

  const taskMap = new Map();
  activeTasks.forEach((t) => taskMap.set(t.vehicleId.toString(), t));

  const realVehicles = vehicles.map((v) => {
    const task = taskMap.get(v._id.toString()) || null;
    const timeSinceUpdate = v.lastLocationUpdate ? now - new Date(v.lastLocationUpdate).getTime() : Infinity;
    const isStale = timeSinceUpdate > staleThreshold;

    return {
      _id: v._id,
      vehicleNumber: v.vehicleNumber,
      type: v.type,
      capacityLiters: v.capacityLiters,
      currentWaterLevel: v.currentWaterLevel,
      status: v.status,
      currentLocation: v.currentLocation,
      lastLocationUpdate: v.lastLocationUpdate,
      isStale,
      isDemo: false,
      driver: v.driverId
        ? {
            _id: v.driverId._id,
            name: v.driverId.userId?.name || 'Driver',
            phone: v.driverId.userId?.phone,
            status: v.driverId.status,
          }
        : null,
      activeTask: task
        ? {
            _id: task._id,
            status: task.status,
            distanceKm: task.distanceKm,
            estimatedArrival: task.estimatedArrival,
            route: task.route,
            request: task.requestId,
          }
        : null,
    };
  });

  if (mode === 'real') {
    return realVehicles;
  }

  // mode === 'all': include active simulated drivers alongside real vehicles
  if (simulationEngine.isActive) {
    return [...realVehicles, ...simulationEngine.getDrivers()];
  }

  return realVehicles;
};

/**
 * Get tracking data for a specific delivery task (used by citizen and admin).
 */
export const getTaskTracking = async (taskId, user) => {
  // Support mock tasks for demo mode
  if (taskId && taskId.startsWith('mock-')) {
    const mockDriver = simulationEngine.mockDrivers.find((d) => d.activeTask?._id === taskId);
    if (!mockDriver?.activeTask) {
      throw new AppError('Demo task not found or is no longer active', 404, 'TASK_NOT_FOUND');
    }
    const task = mockDriver.activeTask;

    return {
      task: {
        ...task,
        route: {
          waypoints: mockDriver.waypoints,
          provider: 'OSRM',
          routeId: `demo-route-${simulationEngine.routeVersion}-${mockDriver._id}`,
        },
      },
      request: task.request || {
        _id: 'mock-req-default',
        address: 'Shastri Nagar Block 4, Kanpur',
        severity: 'CRITICAL',
        requestedLiters: 8000,
        location: { lat: 26.4710, lng: 80.3060 },
      },
      vehicle: {
        _id: mockDriver._id,
        vehicleNumber: mockDriver.vehicleNumber,
        type: mockDriver.type,
        capacityLiters: mockDriver.capacityLiters,
        currentWaterLevel: mockDriver.currentWaterLevel,
        status: mockDriver.status,
        currentLocation: mockDriver.currentLocation,
        isStale: false,
        isDemo: true,
      },
      driver: mockDriver.driver,
      breadcrumbs: mockDriver.waypoints.slice(0, (mockDriver.currentStep || 0) + 1),
    };
  }
  const task = await Task.findById(taskId)
    .populate({
      path: 'requestId',
      populate: { path: 'citizenId', select: 'name phone' },
    })
    .populate({
      path: 'vehicleId',
      select: 'vehicleNumber type capacityLiters currentWaterLevel status currentLocation lastLocationUpdate',
    })
    .populate({
      path: 'driverId',
      populate: { path: 'userId', select: 'name phone' },
    })
    .lean();

  if (!task) {
    throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
  }

  // If citizen, verify ownership
  if (user.role === 'CITIZEN') {
    const citizenId = task.requestId?.citizenId?._id || task.requestId?.citizenId;
    if (!citizenId || citizenId.toString() !== user.userId.toString()) {
      throw new AppError('Access denied: You can only track your own water delivery', 403, 'FORBIDDEN');
    }
  }

  // Fetch sampled breadcrumbs
  const breadcrumbs = await VehicleLocation.find({ taskId: task._id })
    .sort({ timestamp: 1 })
    .limit(100)
    .select('lat lng timestamp speed')
    .lean();

  const staleThreshold = env.locationStaleThreshold || 60000;
  const lastUpdate = task.vehicleId?.lastLocationUpdate;
  const isStale = lastUpdate ? Date.now() - new Date(lastUpdate).getTime() > staleThreshold : true;

  return {
    task: {
      _id: task._id,
      status: task.status,
      assignedAt: task.assignedAt,
      acceptedAt: task.acceptedAt,
      startedAt: task.startedAt,
      arrivedAt: task.arrivedAt,
      completedAt: task.completedAt,
      deliveryLiters: task.deliveryLiters,
      estimatedArrival: task.estimatedArrival,
      distanceKm: task.distanceKm,
      route: task.route,
    },
    request: task.requestId,
    vehicle: {
      ...task.vehicleId,
      isStale,
    },
    driver: task.driverId
      ? {
          name: task.driverId.userId?.name,
          phone: task.driverId.userId?.phone,
        }
      : null,
    breadcrumbs,
  };
};

/**
 * Get sampled history for a vehicle.
 */
export const getVehicleBreadcrumbs = async (vehicleId, taskId = null) => {
  const query = { vehicleId };
  if (taskId) query.taskId = taskId;

  return VehicleLocation.find(query)
    .sort({ timestamp: 1 })
    .limit(150)
    .select('lat lng accuracy speed heading timestamp')
    .lean();
};
