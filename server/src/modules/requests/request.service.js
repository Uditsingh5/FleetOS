import WaterRequest from './request.model.js';
import { calculatePriorityScore } from './priority.service.js';
import { createAuditLog } from '../audit/audit.service.js';
import { createNotification, notifyAdmins } from '../notifications/notification.service.js';
import { getIO } from '../../lib/socket.js';
import AppError from '../../utils/AppError.js';

// Valid state transitions
const VALID_TRANSITIONS = {
  PENDING: ['VALIDATING', 'APPROVED', 'REJECTED', 'CANCELLED'],
  VALIDATING: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['EN_ROUTE', 'CANCELLED'],
  EN_ROUTE: ['ARRIVED', 'CANCELLED'],
  ARRIVED: ['DELIVERING', 'CANCELLED'],
  DELIVERING: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
};

/**
 * Create a water request (citizen).
 */
export const createRequest = async (data, citizenUser) => {
  const request = new WaterRequest({
    ...data,
    citizenId: citizenUser.userId,
    status: 'PENDING',
  });

  // Calculate priority
  request.priorityScore = calculatePriorityScore(request);

  await request.save();

  // Audit
  await createAuditLog({
    actorId: citizenUser.userId,
    actorRole: 'CITIZEN',
    action: 'REQUEST_CREATED',
    entityType: 'REQUEST',
    entityId: request._id,
    metadata: { severity: request.severity, isEmergency: request.isEmergency },
  });

  // Notify admins
  const notifType = request.severity === 'CRITICAL' || request.isEmergency ? 'CRITICAL' : 'REQUEST';
  await notifyAdmins({
    title: request.isEmergency ? '🚨 Emergency Water Request' : 'New Water Request',
    message: `${request.severity} severity request from ${request.address}. ${request.estimatedAffectedPeople} people affected.`,
    type: notifType,
    relatedEntity: { entityType: 'REQUEST', entityId: request._id },
  });

  // Broadcast
  const io = getIO();
  if (io) {
    io.to('admin-room').emit('request:created', {
      _id: request._id,
      address: request.address,
      severity: request.severity,
      status: request.status,
      priorityScore: request.priorityScore,
      estimatedAffectedPeople: request.estimatedAffectedPeople,
      requestedLiters: request.requestedLiters,
      isEmergency: request.isEmergency,
      createdAt: request.createdAt,
    });
  }

  return request;
};

/**
 * Get requests (admin: all; citizen: own).
 */
export const getRequests = async (user, { page = 1, limit = 20, status, severity, sort = '-priorityScore' }) => {
  const filter = {};

  // Citizens only see their own
  if (user.role === 'CITIZEN') {
    filter.citizenId = user.userId;
  }

  if (status) filter.status = status;
  if (severity) filter.severity = severity;

  const skip = (page - 1) * limit;
  const sortObj = {};
  if (sort.startsWith('-')) {
    sortObj[sort.substring(1)] = -1;
  } else {
    sortObj[sort] = 1;
  }

  const [requests, total] = await Promise.all([
    WaterRequest.find(filter)
      .populate('citizenId', 'name email phone')
      .populate('assignedTaskId')
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .lean(),
    WaterRequest.countDocuments(filter),
  ]);

  return {
    requests,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};

/**
 * Get a single request.
 */
export const getRequestById = async (requestId, user) => {
  const request = await WaterRequest.findById(requestId)
    .populate('citizenId', 'name email phone')
    .populate({
      path: 'assignedTaskId',
      populate: [
        {
          path: 'vehicleId',
          select: 'vehicleNumber type capacityLiters currentWaterLevel status currentLocation',
        },
        {
          path: 'driverId',
          populate: { path: 'userId', select: 'name phone' },
        },
      ],
    })
    .lean();

  if (!request) throw new AppError('Request not found', 404, 'REQUEST_NOT_FOUND');

  // Citizens can only view their own
  if (user.role === 'CITIZEN' && request.citizenId._id.toString() !== user.userId) {
    throw new AppError('Not authorized', 403, 'FORBIDDEN');
  }

  return request;
};

/**
 * Approve a request (admin).
 */
export const approveRequest = async (requestId, adminUser) => {
  const request = await WaterRequest.findById(requestId);
  if (!request) throw new AppError('Request not found', 404, 'REQUEST_NOT_FOUND');

  validateTransition(request.status, 'APPROVED');

  // Recalculate priority
  request.priorityScore = calculatePriorityScore(request);
  request.status = 'APPROVED';
  await request.save();

  await createAuditLog({
    actorId: adminUser.userId,
    actorRole: 'ADMIN',
    action: 'REQUEST_APPROVED',
    entityType: 'REQUEST',
    entityId: request._id,
  });

  await createNotification({
    userId: request.citizenId,
    title: 'Request Approved',
    message: 'Your water request has been approved and a tanker will be assigned shortly.',
    type: 'SUCCESS',
    relatedEntity: { entityType: 'REQUEST', entityId: request._id },
  });

  broadcastRequestUpdate(request);
  return request;
};

/**
 * Reject a request (admin).
 */
export const rejectRequest = async (requestId, reason, adminUser) => {
  const request = await WaterRequest.findById(requestId);
  if (!request) throw new AppError('Request not found', 404, 'REQUEST_NOT_FOUND');

  validateTransition(request.status, 'REJECTED');

  request.status = 'REJECTED';
  request.rejectionReason = reason || 'Request rejected by administrator';
  await request.save();

  await createAuditLog({
    actorId: adminUser.userId,
    actorRole: 'ADMIN',
    action: 'REQUEST_REJECTED',
    entityType: 'REQUEST',
    entityId: request._id,
    metadata: { reason },
  });

  await createNotification({
    userId: request.citizenId,
    title: 'Request Rejected',
    message: reason || 'Your water request has been rejected.',
    type: 'WARNING',
    relatedEntity: { entityType: 'REQUEST', entityId: request._id },
  });

  broadcastRequestUpdate(request);
  return request;
};

/**
 * Cancel a request.
 */
export const cancelRequest = async (requestId, user) => {
  const request = await WaterRequest.findById(requestId);
  if (!request) throw new AppError('Request not found', 404, 'REQUEST_NOT_FOUND');

  // Citizens can only cancel their own pending/approved requests
  if (user.role === 'CITIZEN') {
    if (request.citizenId.toString() !== user.userId) {
      throw new AppError('Not authorized', 403, 'FORBIDDEN');
    }
    if (!['PENDING', 'APPROVED'].includes(request.status)) {
      throw new AppError('Cannot cancel request in current status', 409, 'INVALID_STATUS');
    }
  }

  validateTransition(request.status, 'CANCELLED');

  request.status = 'CANCELLED';
  await request.save();

  await createAuditLog({
    actorId: user.userId,
    actorRole: user.role,
    action: 'REQUEST_CANCELLED',
    entityType: 'REQUEST',
    entityId: request._id,
  });

  broadcastRequestUpdate(request);
  return request;
};

/**
 * Update request status (internal, used by task service).
 */
export const updateRequestStatus = async (requestId, status) => {
  const request = await WaterRequest.findById(requestId);
  if (!request) return null;

  if (status === 'COMPLETED') {
    validateTransition(request.status, status);
    if (!request.assignedTaskId) {
      throw new AppError(
        'An assigned delivery task is required before completion',
        409,
        'INVALID_ASSIGNMENT'
      );
    }
  }

  request.status = status;
  if (status === 'COMPLETED') {
    request.resolvedAt = new Date();
  }
  await request.save();

  broadcastRequestUpdate(request);
  return request;
};

function validateTransition(currentStatus, newStatus) {
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(newStatus)) {
    throw new AppError(
      `Cannot transition from ${currentStatus} to ${newStatus}`,
      409,
      'INVALID_TRANSITION'
    );
  }
}

function broadcastRequestUpdate(request) {
  const io = getIO();
  if (io) {
    io.to('admin-room').emit('request:updated', {
      _id: request._id,
      status: request.status,
      priorityScore: request.priorityScore,
      severity: request.severity,
    });

    io.to(`user:${request.citizenId}`).emit('request:updated', {
      _id: request._id,
      status: request.status,
    });
  }
}
