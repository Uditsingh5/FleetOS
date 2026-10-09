import mongoose from 'mongoose';
import Task from './task.model.js';
import Vehicle from '../vehicles/vehicle.model.js';
import Driver from '../drivers/driver.model.js';
import WaterRequest from '../requests/request.model.js';
import { updateRequestStatus } from '../requests/request.service.js';
import { calculateDistance, estimateETA, generateRoute } from '../tracking/route.service.js';
import { createAuditLog } from '../audit/audit.service.js';
import { createNotification, notifyAdmins } from '../notifications/notification.service.js';
import { getIO } from '../../lib/socket.js';
import AppError from '../../utils/AppError.js';
import logger from '../../lib/logger.js';

// Valid task state transitions
const VALID_TRANSITIONS = {
  CREATED: ['ASSIGNED'],
  ASSIGNED: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['EN_ROUTE', 'CANCELLED'],
  EN_ROUTE: ['ARRIVED', 'FAILED', 'CANCELLED'],
  ARRIVED: ['DELIVERING', 'FAILED', 'CANCELLED'],
  DELIVERING: ['COMPLETED', 'FAILED', 'CANCELLED'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

/**
 * Get vehicle recommendations for a request.
 * Returns scored candidates, always ensuring actionable choices for dispatchers.
 */
export const getRecommendations = async (requestId) => {
  const request = await WaterRequest.findById(requestId).lean();
  if (!request) throw new AppError('Request not found', 404, 'REQUEST_NOT_FOUND');

  // Find all active vehicles
  const vehicles = await Vehicle.find({ isActive: true })
    .populate({
      path: 'driverId',
      populate: { path: 'userId', select: 'name phone' },
    })
    .lean();

  // Find available drivers who can be assigned if a vehicle has no driver
  const availableDrivers = await Driver.find({ status: { $in: ['AVAILABLE', 'OFFLINE'] } })
    .populate('userId', 'name phone')
    .lean();

  let unassignedDriverIndex = 0;

  // Score candidates
  const scored = vehicles.map((vehicle) => {
    let driver = vehicle.driverId;
    let driverAssigned = !!driver;

    // If vehicle has no driver attached, suggest an available driver from pool
    if (!driver && availableDrivers.length > 0) {
      driver = availableDrivers[unassignedDriverIndex % availableDrivers.length];
      unassignedDriverIndex++;
    }

    const distance = vehicle.currentLocation
      ? calculateDistance(vehicle.currentLocation, request.location)
      : 5.0; // default 5km in city

    // Distance score (0–40): closer = higher
    const distanceScore = Math.max(0, 40 - (distance || 5) * 4);

    // Water capacity score (0–35): more water available = higher
    const neededWater = request.requestedLiters || 3000;
    const currentWater = vehicle.currentWaterLevel || 0;
    const waterRatio = Math.min(1, currentWater / neededWater);
    const waterScore = waterRatio * 35;

    // Status / Availability score (0–25)
    let availabilityScore = 0;
    let readiness = 'READY';

    if (vehicle.status === 'AVAILABLE') {
      availabilityScore = 25;
      if (currentWater < 500) {
        readiness = 'NEEDS_REFILL';
        availabilityScore = 15;
      }
    } else if (['MAINTENANCE', 'OFFLINE'].includes(vehicle.status)) {
      availabilityScore = 5;
      readiness = 'STANDBY';
    } else {
      availabilityScore = 10;
      readiness = 'BUSY';
    }

    const totalScore = distanceScore + waterScore + availabilityScore;
    const etaInfo = estimateETA(distance || 5);

    return {
      vehicleId: vehicle._id,
      vehicleNumber: vehicle.vehicleNumber,
      type: vehicle.type,
      capacityLiters: vehicle.capacityLiters,
      currentWaterLevel: vehicle.currentWaterLevel,
      status: vehicle.status,
      readiness,
      distanceKm: Math.round((distance || 5) * 10) / 10,
      etaMinutes: etaInfo?.minutes || 15,
      driverId: driver?._id || null,
      driverName: driver?.userId?.name || (driverAssigned ? 'Assigned Driver' : 'Standby Pool Driver'),
      driverPhone: driver?.userId?.phone || '',
      score: Math.round(totalScore * 10) / 10,
    };
  });

  // Sort by score descending: Ready tankers first, highest scores on top
  scored.sort((a, b) => {
    if (a.readiness === 'READY' && b.readiness !== 'READY') return -1;
    if (b.readiness === 'READY' && a.readiness !== 'READY') return 1;
    return b.score - a.score;
  });

  return scored;
};

/**
 * Create and assign a task.
 * Robust execution with standalone MongoDB fallback (no replica set needed).
 */
const asId = (value) => {
  if (!value) return value;
  if (typeof value === 'string') return value;
  return value._id || value.id || value;
};

export const createTask = async ({ requestId, vehicleId, driverId }, adminUser) => {
  requestId = asId(requestId);
  vehicleId = asId(vehicleId);
  driverId = asId(driverId);
  let session = null;
  let useTransaction = false;

  try {
    session = await mongoose.startSession();
    session.startTransaction();
    useTransaction = true;
  } catch {
    // Standalone MongoDB without replica set
    if (session) {
      try { session.endSession(); } catch (_) {}
      session = null;
    }
    useTransaction = false;
  }

  const queryOptions = session ? { session } : {};

  try {
    // 1. Validate request
    const request = await WaterRequest.findById(requestId, null, queryOptions);
    if (!request) throw new AppError('Request not found', 404, 'REQUEST_NOT_FOUND');
    if (!['APPROVED', 'PENDING', 'VALIDATING'].includes(request.status)) {
      throw new AppError(`Request cannot be assigned from status ${request.status}`, 409, 'INVALID_STATUS');
    }

    // 2. Fetch and claim the vehicle
    let vehicle = await Vehicle.findById(vehicleId, null, queryOptions);
    if (!vehicle || !vehicle.isActive) {
      throw new AppError('Vehicle not found or inactive', 404, 'VEHICLE_NOT_FOUND');
    }

    // If vehicle water level is zero, top it up to capacity for assignment
    if (vehicle.currentWaterLevel <= 0) {
      vehicle.currentWaterLevel = vehicle.capacityLiters || 10000;
    }
    vehicle.status = 'ASSIGNED';

    // 3. Resolve driver
    let resolvedDriverId = driverId || vehicle.driverId;
    if (!resolvedDriverId) {
      const fallbackDriver = await Driver.findOne(
        { status: { $in: ['AVAILABLE', 'OFFLINE'] } },
        null,
        queryOptions
      );
      if (fallbackDriver) {
        resolvedDriverId = fallbackDriver._id;
      } else {
        const anyDriver = await Driver.findOne({}, null, queryOptions);
        if (anyDriver) resolvedDriverId = anyDriver._id;
      }
    }

    if (!resolvedDriverId) {
      throw new AppError('No available driver found to assign to this vehicle', 409, 'NO_DRIVER_AVAILABLE');
    }

    // Claim the driver
    const driver = await Driver.findById(resolvedDriverId, null, queryOptions);
    if (!driver) {
      throw new AppError('Driver not found', 404, 'DRIVER_NOT_FOUND');
    }
    driver.status = 'BUSY';
    driver.currentVehicleId = vehicle._id;
    await driver.save(queryOptions);

    vehicle.driverId = driver._id;
    await vehicle.save(queryOptions);

    // 4. Calculate route
    const defaultCoords = { lat: 26.449, lng: 80.331 };
    const route = await generateRoute(
      vehicle.currentLocation || defaultCoords,
      request.location || defaultCoords
    );
    if (!route) {
      throw new AppError('Unable to calculate a road route for this task', 503, 'ROUTE_UNAVAILABLE');
    }

    // 5. Create task
    const task = new Task({
      requestId: request._id,
      vehicleId: vehicle._id,
      driverId: driver._id,
      assignedBy: adminUser.userId,
      status: 'ASSIGNED',
      assignedAt: new Date(),
      distanceKm: route?.distanceKm || null,
      estimatedArrival: route?.eta || null,
      route: route,
    });
    await task.save(queryOptions);

    // 6. Link task to request and update status
    request.assignedTaskId = task._id;
    request.status = 'ASSIGNED';
    await request.save(queryOptions);

    if (useTransaction && session) {
      await session.commitTransaction();
    }

    // Post-assignment side effects
    await createAuditLog({
      actorId: adminUser.userId,
      actorRole: 'ADMIN',
      action: 'TASK_CREATED',
      entityType: 'TASK',
      entityId: task._id,
      metadata: {
        requestId: request._id,
        vehicleId: vehicle._id,
        driverId: driver._id,
        vehicleNumber: vehicle.vehicleNumber,
      },
    });

    // Notify driver
    await createNotification({
      userId: driver.userId,
      title: 'New Task Assigned',
      message: `You have been assigned to deliver water to ${request.address}. ${request.requestedLiters}L requested.`,
      type: 'TASK',
      relatedEntity: { entityType: 'TASK', entityId: task._id },
    });

    // Notify citizen
    await createNotification({
      userId: request.citizenId,
      title: 'Tanker Assigned',
      message: `Water tanker (${vehicle.vehicleNumber}) has been assigned to your request!`,
      type: 'SUCCESS',
      relatedEntity: { entityType: 'REQUEST', entityId: request._id },
    });

    // Broadcast across all socket channels
    const io = getIO();
    if (io) {
      const taskPayload = {
        taskId: task._id,
        requestId: request._id,
        vehicleId: vehicle._id,
        driverId: driver._id,
        vehicleNumber: vehicle.vehicleNumber,
        status: 'ASSIGNED',
        address: request.address,
      };

      const requestPayload = {
        _id: request._id,
        status: 'ASSIGNED',
        assignedTaskId: task._id,
        priorityScore: request.priorityScore,
        severity: request.severity,
      };

      io.to('admin-room').emit('task:assigned', taskPayload);
      io.to('admin-room').emit('task:status', taskPayload);
      io.to('admin-room').emit('request:updated', requestPayload);
      io.to('admin-room').emit('request:status', requestPayload);

      io.to(`user:${request.citizenId}`).emit('request:updated', requestPayload);
      io.to(`user:${request.citizenId}`).emit('request:status', requestPayload);
      io.to(`citizen:${request.citizenId}`).emit('request:updated', requestPayload);
      io.to(`citizen:${request.citizenId}`).emit('request:status', requestPayload);
      io.to(`driver:${driver.userId}`).emit('task:assigned', taskPayload);
      io.to(`task:${task._id}`).emit('task:status', taskPayload);
    }

    return task;
  } catch (error) {
    if (useTransaction && session) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

/**
 * Get tasks with filters.
 */
export const getTasks = async (user, { page = 1, limit = 20, status }) => {
  const filter = {};
  if (status) filter.status = status;

  // Drivers see only their tasks
  if (user.role === 'DRIVER') {
    const driver = await Driver.findOne({ userId: user.userId });
    if (!driver) throw new AppError('Driver profile not found', 404, 'DRIVER_NOT_FOUND');
    filter.driverId = driver._id;
  }

  const skip = (page - 1) * limit;

  const [tasks, total] = await Promise.all([
    Task.find(filter)
      .populate({
        path: 'requestId',
        select: 'address location severity requestedLiters estimatedAffectedPeople status citizenId',
        populate: { path: 'citizenId', select: 'name phone' },
      })
      .populate('vehicleId', 'vehicleNumber type capacityLiters currentWaterLevel status currentLocation')
      .populate({
        path: 'driverId',
        populate: { path: 'userId', select: 'name phone' },
      })
      .sort({ assignedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Task.countDocuments(filter),
  ]);

  return {
    tasks,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};

/**
 * Get a task by ID.
 */
export const getTaskById = async (taskId) => {
  const task = await Task.findById(taskId)
    .populate({
      path: 'requestId',
      populate: { path: 'citizenId', select: 'name phone' },
    })
    .populate('vehicleId')
    .populate({
      path: 'driverId',
      populate: { path: 'userId', select: 'name phone' },
    })
    .populate('assignedBy', 'name')
    .lean();

  if (!task) throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
  return task;
};

/**
 * Driver accepts task.
 */
export const acceptTask = async (taskId, driverUser) => {
  const driver = await Driver.findOne({ userId: driverUser.userId });
  if (!driver) throw new AppError('Driver not found', 404, 'DRIVER_NOT_FOUND');

  const task = await Task.findById(taskId);
  if (!task) throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');

  // Verify this driver is assigned
  if (task.driverId.toString() !== driver._id.toString()) {
    throw new AppError('Not authorized for this task', 403, 'FORBIDDEN');
  }

  validateTransition(task.status, 'ACCEPTED');

  task.status = 'ACCEPTED';
  task.acceptedAt = new Date();
  await task.save();

  await createAuditLog({
    actorId: driverUser.userId,
    actorRole: 'DRIVER',
    action: 'TASK_ACCEPTED',
    entityType: 'TASK',
    entityId: task._id,
  });

  broadcastTaskUpdate(task);
  return task;
};

/**
 * Driver starts journey.
 */
export const startTask = async (taskId, driverUser) => {
  const { task, driver } = await verifyDriverTask(taskId, driverUser);

  validateTransition(task.status, 'EN_ROUTE');

  task.status = 'EN_ROUTE';
  task.startedAt = new Date();
  await task.save();

  // Update request status
  await updateRequestStatus(task.requestId, 'EN_ROUTE');

  // Update vehicle status
  await Vehicle.findByIdAndUpdate(task.vehicleId, { status: 'EN_ROUTE' });

  await createAuditLog({
    actorId: driverUser.userId,
    actorRole: 'DRIVER',
    action: 'TASK_STARTED',
    entityType: 'TASK',
    entityId: task._id,
  });

  // Notify citizen
  const request = await WaterRequest.findById(task.requestId);
  if (request) {
    const vehicle = await Vehicle.findById(task.vehicleId);
    await createNotification({
      userId: request.citizenId,
      title: 'Tanker En Route',
      message: `Water tanker ${vehicle?.vehicleNumber || ''} is on its way! ETA: ${task.estimatedArrival ? Math.round((new Date(task.estimatedArrival) - Date.now()) / 60000) + ' min' : 'calculating...'}`,
      type: 'INFO',
      relatedEntity: { entityType: 'REQUEST', entityId: request._id },
    });
  }

  broadcastTaskUpdate(task);
  return task;
};

/**
 * Driver marks arrival.
 */
export const arriveTask = async (taskId, driverUser) => {
  const { task } = await verifyDriverTask(taskId, driverUser);

  validateTransition(task.status, 'ARRIVED');

  task.status = 'ARRIVED';
  task.arrivedAt = new Date();
  task.actualArrival = new Date();
  await task.save();

  await updateRequestStatus(task.requestId, 'ARRIVED');

  await createAuditLog({
    actorId: driverUser.userId,
    actorRole: 'DRIVER',
    action: 'TASK_ARRIVED',
    entityType: 'TASK',
    entityId: task._id,
  });

  const request = await WaterRequest.findById(task.requestId);
  if (request) {
    await createNotification({
      userId: request.citizenId,
      title: 'Tanker Arrived',
      message: 'The water tanker has arrived at your location!',
      type: 'SUCCESS',
      relatedEntity: { entityType: 'REQUEST', entityId: request._id },
    });
  }

  broadcastTaskUpdate(task);
  return task;
};

/**
 * Driver starts delivery.
 */
export const startDelivery = async (taskId, driverUser) => {
  const { task } = await verifyDriverTask(taskId, driverUser);

  validateTransition(task.status, 'DELIVERING');

  task.status = 'DELIVERING';
  task.deliveryStartedAt = new Date();
  await task.save();

  await updateRequestStatus(task.requestId, 'DELIVERING');
  await Vehicle.findByIdAndUpdate(task.vehicleId, { status: 'DELIVERING' });

  await createAuditLog({
    actorId: driverUser.userId,
    actorRole: 'DRIVER',
    action: 'DELIVERY_STARTED',
    entityType: 'TASK',
    entityId: task._id,
  });

  broadcastTaskUpdate(task);
  return task;
};

/**
 * Driver completes delivery.
 */
export const completeTask = async (taskId, { deliveryLiters, notes }, driverUser) => {
  const { task } = await verifyDriverTask(taskId, driverUser);

  validateTransition(task.status, 'COMPLETED');

  if (!deliveryLiters || deliveryLiters <= 0) {
    throw new AppError('Delivery liters must be positive', 400, 'VALIDATION_ERROR');
  }

  const request = await WaterRequest.findById(task.requestId);
  if (!request) {
    throw new AppError('Assigned water request not found', 404, 'REQUEST_NOT_FOUND');
  }
  if (request.assignedTaskId?.toString() !== task._id.toString()) {
    throw new AppError('This delivery is no longer assigned to the request', 409, 'INVALID_ASSIGNMENT');
  }
  if (request.status !== 'DELIVERING') {
    throw new AppError(
      `Request must be in DELIVERING status before completion (currently ${request.status})`,
      409,
      'INVALID_REQUEST_STATUS'
    );
  }

  task.status = 'COMPLETED';
  task.completedAt = new Date();
  task.deliveryLiters = deliveryLiters;
  task.notes = notes || null;
  await task.save();

  // Deduct water from vehicle
  await Vehicle.findByIdAndUpdate(task.vehicleId, {
    $inc: { currentWaterLevel: -deliveryLiters },
    status: 'AVAILABLE',
  });

  // Free up driver
  await Driver.findByIdAndUpdate(task.driverId, {
    status: 'AVAILABLE',
  });

  // Complete request
  await updateRequestStatus(task.requestId, 'COMPLETED');

  // Update driver stats
  await Driver.findByIdAndUpdate(task.driverId, {
    $inc: { totalTasks: 1, completedTasks: 1 },
  });

  await createAuditLog({
    actorId: driverUser.userId,
    actorRole: 'DRIVER',
    action: 'DELIVERY_COMPLETED',
    entityType: 'TASK',
    entityId: task._id,
    metadata: { deliveryLiters, notes },
  });

  // Notify citizen
  await createNotification({
    userId: request.citizenId,
    title: 'Water Delivered',
    message: `${deliveryLiters}L of water has been delivered to your location. Thank you for your patience.`,
    type: 'SUCCESS',
    relatedEntity: { entityType: 'REQUEST', entityId: request._id },
  });

  broadcastTaskUpdate(task);
  return task;
};

/**
 * Driver reports failure.
 */
export const failTask = async (taskId, { failureReason }, driverUser) => {
  const { task } = await verifyDriverTask(taskId, driverUser);

  validateTransition(task.status, 'FAILED');

  task.status = 'FAILED';
  task.failureReason = failureReason || 'Unknown failure';
  task.completedAt = new Date();
  await task.save();

  // Free vehicle and driver
  await Vehicle.findByIdAndUpdate(task.vehicleId, { status: 'AVAILABLE' });
  await Driver.findByIdAndUpdate(task.driverId, { status: 'AVAILABLE' });
  await Driver.findByIdAndUpdate(task.driverId, { $inc: { totalTasks: 1 } });

  // Revert request to APPROVED so it can be reassigned
  await updateRequestStatus(task.requestId, 'APPROVED');

  await createAuditLog({
    actorId: driverUser.userId,
    actorRole: 'DRIVER',
    action: 'TASK_FAILED',
    entityType: 'TASK',
    entityId: task._id,
    metadata: { failureReason },
  });

  await notifyAdmins({
    title: 'Delivery Failed',
    message: `Task ${task._id} failed: ${failureReason}`,
    type: 'WARNING',
    relatedEntity: { entityType: 'TASK', entityId: task._id },
  });

  broadcastTaskUpdate(task);
  return task;
};

/**
 * Get active task for driver.
 */
export const getActiveTask = async (driverUserId) => {
  const driver = await Driver.findOne({ userId: driverUserId });
  if (!driver) return null;

  const task = await Task.findOne({
    driverId: driver._id,
    status: { $in: ['ASSIGNED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'DELIVERING'] },
  })
    .populate({
      path: 'requestId',
      populate: { path: 'citizenId', select: 'name phone' },
    })
    .populate('vehicleId')
    .lean();

  return task;
};

// ---- Helpers ----

async function verifyDriverTask(taskId, driverUser) {
  const driver = await Driver.findOne({ userId: driverUser.userId });
  if (!driver) throw new AppError('Driver not found', 404, 'DRIVER_NOT_FOUND');

  const task = await Task.findById(taskId);
  if (!task) throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');

  if (task.driverId.toString() !== driver._id.toString()) {
    throw new AppError('Not authorized for this task', 403, 'FORBIDDEN');
  }

  return { task, driver };
}

function validateTransition(currentStatus, newStatus) {
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(newStatus)) {
    throw new AppError(
      `Cannot transition task from ${currentStatus} to ${newStatus}`,
      409,
      'INVALID_TRANSITION'
    );
  }
}

async function broadcastTaskUpdate(task) {
  const io = getIO();
  if (io) {
    const payload = {
      taskId: task._id,
      status: task.status,
      requestId: task.requestId,
      vehicleId: task.vehicleId,
      driverId: task.driverId,
    };
    io.to('admin-room').emit('task:status', payload);
    io.to(`task:${task._id}`).emit('task:status', payload);

    try {
      const reqDoc = await WaterRequest.findById(task.requestId);
      if (reqDoc) {
        const reqPayload = {
          _id: reqDoc._id,
          status: reqDoc.status,
          assignedTaskId: task._id,
          priorityScore: reqDoc.priorityScore,
        };
        io.to('admin-room').emit('request:updated', reqPayload);
        io.to('admin-room').emit('request:status', reqPayload);
        if (reqDoc.citizenId) {
          io.to(`user:${reqDoc.citizenId}`).emit('request:updated', reqPayload);
          io.to(`user:${reqDoc.citizenId}`).emit('request:status', reqPayload);
          io.to(`citizen:${reqDoc.citizenId}`).emit('request:updated', reqPayload);
          io.to(`citizen:${reqDoc.citizenId}`).emit('request:status', reqPayload);
        }
      }
    } catch {
      // Non-critical broadcast error
    }
  }
}
