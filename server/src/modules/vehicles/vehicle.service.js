import Vehicle from './vehicle.model.js';
import AppError from '../../utils/AppError.js';
import { createAuditLog } from '../audit/audit.service.js';

/**
 * Get all vehicles with filters and pagination.
 */
export const getVehicles = async ({ page = 1, limit = 20, status, type, isActive }) => {
  const filter = {};
  if (status) filter.status = status;
  if (type) filter.type = type;
  if (isActive !== undefined) filter.isActive = isActive;

  const skip = (page - 1) * limit;

  const [vehicles, total] = await Promise.all([
    Vehicle.find(filter)
      .populate('driverId', 'userId status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Vehicle.countDocuments(filter),
  ]);

  return {
    vehicles,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};

/**
 * Get a single vehicle by ID.
 */
export const getVehicleById = async (vehicleId) => {
  const vehicle = await Vehicle.findById(vehicleId)
    .populate({
      path: 'driverId',
      populate: { path: 'userId', select: 'name email phone' },
    })
    .lean();

  if (!vehicle) throw new AppError('Vehicle not found', 404, 'VEHICLE_NOT_FOUND');
  return vehicle;
};

/**
 * Create a new vehicle.
 */
export const createVehicle = async (data, adminUser) => {
  const vehicle = await Vehicle.create(data);

  await createAuditLog({
    actorId: adminUser.userId,
    actorRole: adminUser.role,
    action: 'VEHICLE_CREATED',
    entityType: 'VEHICLE',
    entityId: vehicle._id,
    metadata: { vehicleNumber: vehicle.vehicleNumber },
  });

  return vehicle;
};

/**
 * Update vehicle.
 */
export const updateVehicle = async (vehicleId, data, adminUser) => {
  const vehicle = await Vehicle.findByIdAndUpdate(vehicleId, data, {
    new: true,
    runValidators: true,
  });

  if (!vehicle) throw new AppError('Vehicle not found', 404, 'VEHICLE_NOT_FOUND');

  await createAuditLog({
    actorId: adminUser.userId,
    actorRole: adminUser.role,
    action: 'VEHICLE_UPDATED',
    entityType: 'VEHICLE',
    entityId: vehicle._id,
    metadata: data,
  });

  return vehicle;
};

/**
 * Update vehicle status with validation.
 */
export const updateVehicleStatus = async (vehicleId, status, adminUser) => {
  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle) throw new AppError('Vehicle not found', 404, 'VEHICLE_NOT_FOUND');

  // Prevent status changes on vehicles with active tasks
  if (['MAINTENANCE', 'OFFLINE'].includes(status) && ['ASSIGNED', 'EN_ROUTE', 'DELIVERING'].includes(vehicle.status)) {
    throw new AppError('Cannot change status while vehicle has active task', 409, 'VEHICLE_ACTIVE');
  }

  vehicle.status = status;
  await vehicle.save();

  await createAuditLog({
    actorId: adminUser.userId,
    actorRole: adminUser.role,
    action: 'VEHICLE_STATUS_CHANGED',
    entityType: 'VEHICLE',
    entityId: vehicle._id,
    metadata: { status },
  });

  return vehicle;
};

/**
 * Get available vehicles (for assignment recommendations).
 */
export const getAvailableVehicles = async () => {
  return Vehicle.find({
    status: 'AVAILABLE',
    isActive: true,
    currentWaterLevel: { $gt: 0 },
  })
    .populate({
      path: 'driverId',
      populate: { path: 'userId', select: 'name phone' },
    })
    .lean();
};

/**
 * Get current location and stale status of a vehicle.
 */
export const getVehicleLocation = async (vehicleId) => {
  const vehicle = await Vehicle.findById(vehicleId)
    .select('vehicleNumber status currentLocation lastLocationUpdate')
    .lean();
  if (!vehicle) throw new AppError('Vehicle not found', 404, 'VEHICLE_NOT_FOUND');
  const isStale = vehicle.lastLocationUpdate
    ? Date.now() - new Date(vehicle.lastLocationUpdate).getTime() > 60000
    : true;
  return {
    vehicleId: vehicle._id,
    vehicleNumber: vehicle.vehicleNumber,
    status: vehicle.status,
    currentLocation: vehicle.currentLocation,
    lastLocationUpdate: vehicle.lastLocationUpdate,
    isStale,
  };
};

