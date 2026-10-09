import Driver from './driver.model.js';
import User from '../users/user.model.js';
import AppError from '../../utils/AppError.js';
import { createAuditLog } from '../audit/audit.service.js';

/**
 * Get all drivers with their user info.
 */
export const getDrivers = async ({ page = 1, limit = 20, status }) => {
  const filter = {};
  if (status) filter.status = status;

  const skip = (page - 1) * limit;

  const [drivers, total] = await Promise.all([
    Driver.find(filter)
      .populate('userId', 'name email phone isActive')
      .populate('currentVehicleId', 'vehicleNumber type capacityLiters currentWaterLevel status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Driver.countDocuments(filter),
  ]);

  return {
    drivers,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};

/**
 * Get a driver by ID.
 */
export const getDriverById = async (driverId) => {
  const driver = await Driver.findById(driverId)
    .populate('userId', 'name email phone isActive')
    .populate('currentVehicleId', 'vehicleNumber type capacityLiters currentWaterLevel status')
    .lean();

  if (!driver) throw new AppError('Driver not found', 404, 'DRIVER_NOT_FOUND');
  return driver;
};

/**
 * Get driver profile by user ID.
 */
export const getDriverByUserId = async (userId) => {
  const driver = await Driver.findOne({ userId })
    .populate('userId', 'name email phone isActive')
    .populate('currentVehicleId', 'vehicleNumber type capacityLiters currentWaterLevel status')
    .lean();

  if (!driver) throw new AppError('Driver profile not found', 404, 'DRIVER_NOT_FOUND');
  return driver;
};

/**
 * Update driver status.
 */
export const updateDriverStatus = async (driverId, status, actorUser) => {
  const driver = await Driver.findById(driverId);
  if (!driver) throw new AppError('Driver not found', 404, 'DRIVER_NOT_FOUND');

  // Prevent going offline while on active task
  if (['OFFLINE', 'ON_BREAK', 'SUSPENDED'].includes(status) && driver.status === 'BUSY') {
    throw new AppError('Cannot change status while driver has active task', 409, 'DRIVER_BUSY');
  }

  driver.status = status;
  await driver.save();

  await createAuditLog({
    actorId: actorUser.userId,
    actorRole: actorUser.role,
    action: 'DRIVER_STATUS_CHANGED',
    entityType: 'DRIVER',
    entityId: driver._id,
    metadata: { status },
  });

  return driver;
};

/**
 * Assign vehicle to driver.
 */
export const assignVehicle = async (driverId, vehicleId, adminUser) => {
  const driver = await Driver.findById(driverId);
  if (!driver) throw new AppError('Driver not found', 404, 'DRIVER_NOT_FOUND');

  driver.currentVehicleId = vehicleId;
  await driver.save();

  await createAuditLog({
    actorId: adminUser.userId,
    actorRole: adminUser.role,
    action: 'VEHICLE_ASSIGNED_TO_DRIVER',
    entityType: 'DRIVER',
    entityId: driver._id,
    metadata: { vehicleId },
  });

  return driver;
};
