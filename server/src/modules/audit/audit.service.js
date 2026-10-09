import AuditLog from './audit.model.js';
import logger from '../../lib/logger.js';

/**
 * Create an audit log entry.
 */
export const createAuditLog = async ({ actorId, actorRole, action, entityType, entityId, metadata = {} }) => {
  try {
    await AuditLog.create({
      actorId,
      actorRole,
      action,
      entityType,
      entityId,
      metadata,
      timestamp: new Date(),
    });
  } catch (error) {
    // Audit logging should never fail the primary operation
    logger.error({ err: error }, 'Failed to create audit log');
  }
};

/**
 * Get audit logs with pagination and filters.
 */
export const getAuditLogs = async ({ page = 1, limit = 50, entityType, entityId, actorId, action }) => {
  const filter = {};
  if (entityType) filter.entityType = entityType;
  if (entityId) filter.entityId = entityId;
  if (actorId) filter.actorId = actorId;
  if (action) filter.action = { $regex: action, $options: 'i' };

  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate('actorId', 'name email role')
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};
