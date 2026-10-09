import jwt from 'jsonwebtoken';
import User from '../users/user.model.js';
import Driver from '../drivers/driver.model.js';
import env from '../../config/env.js';
import AppError from '../../utils/AppError.js';
import { createAuditLog } from '../audit/audit.service.js';

/**
 * Register a new user.
 */
export const register = async ({ name, email, phone, password, role = 'CITIZEN' }) => {
  const existing = await User.findOne({ email });
  if (existing) {
    throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
  }

  // Only CITIZEN can self-register. ADMIN/DRIVER created by admin.
  const allowedSelfRegister = ['CITIZEN'];
  const userRole = allowedSelfRegister.includes(role) ? role : 'CITIZEN';

  const user = await User.create({ name, email, phone, password, role: userRole });
  const token = generateToken(user);

  await createAuditLog({
    actorId: user._id,
    actorRole: user.role,
    action: 'USER_REGISTERED',
    entityType: 'USER',
    entityId: user._id,
    metadata: { email, role: userRole },
  });

  return { user: sanitizeUser(user), token };
};

/**
 * Register an admin or driver (admin-only operation).
 */
export const registerByAdmin = async ({ name, email, phone, password, role, driverData }, adminUser) => {
  const existing = await User.findOne({ email });
  if (existing) {
    throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
  }

  const user = await User.create({ name, email, phone, password, role });

  // If creating a driver, also create driver profile
  if (role === 'DRIVER' && driverData) {
    await Driver.create({
      userId: user._id,
      licenseNumber: driverData.licenseNumber || 'N/A',
      licenseExpiry: driverData.licenseExpiry || null,
      status: 'OFFLINE',
    });
  }

  await createAuditLog({
    actorId: adminUser.userId,
    actorRole: adminUser.role,
    action: 'USER_CREATED_BY_ADMIN',
    entityType: 'USER',
    entityId: user._id,
    metadata: { email, role },
  });

  return { user: sanitizeUser(user) };
};

/**
 * Login a user.
 */
export const login = async ({ email, password }) => {
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select('+password');
  if (!user) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  if (!user.isActive) {
    throw new AppError('Account is deactivated', 403, 'ACCOUNT_DEACTIVATED');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  const token = generateToken(user);

  // For drivers, include driver profile
  let driverProfile = null;
  if (user.role === 'DRIVER') {
    driverProfile = await Driver.findOne({ userId: user._id }).lean();
  }

  return { user: sanitizeUser(user), token, driverProfile };
};

/**
 * Get current user profile.
 */
export const getMe = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  let driverProfile = null;
  if (user.role === 'DRIVER') {
    driverProfile = await Driver.findOne({ userId: user._id })
      .populate('currentVehicleId', 'vehicleNumber type capacityLiters currentWaterLevel status')
      .lean();
  }

  return { user: sanitizeUser(user), driverProfile };
};

function generateToken(user) {
  return jwt.sign(
    { userId: user._id, role: user.role },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

function sanitizeUser(user) {
  const obj = user.toJSON ? user.toJSON() : { ...user };
  delete obj.password;
  delete obj.__v;
  return obj;
}
