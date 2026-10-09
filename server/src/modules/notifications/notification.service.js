import Notification from './notification.model.js';
import { getIO } from '../../lib/socket.js';
import logger from '../../lib/logger.js';

/**
 * Create and deliver a notification to a user.
 */
export const createNotification = async ({ userId, title, message, type = 'INFO', relatedEntity = {} }) => {
  try {
    const notification = await Notification.create({
      userId,
      title,
      message,
      type,
      relatedEntity,
    });

    // Deliver via Socket.IO in real-time
    const io = getIO();
    if (io) {
      io.to(`user:${userId}`).emit('notification:new', {
        _id: notification._id,
        title,
        message,
        type,
        relatedEntity,
        isRead: false,
        createdAt: notification.createdAt,
      });
    }

    return notification;
  } catch (error) {
    logger.error({ err: error }, 'Failed to create notification');
  }
};

/**
 * Notify all admins.
 */
export const notifyAdmins = async ({ title, message, type = 'INFO', relatedEntity = {} }) => {
  try {
    const io = getIO();
    if (io) {
      io.to('admin-room').emit('notification:new', {
        title,
        message,
        type,
        relatedEntity,
        isRead: false,
        createdAt: new Date(),
      });
    }
    // We don't persist per-admin notification for broadcast — admin-room event is enough
  } catch (error) {
    logger.error({ err: error }, 'Failed to notify admins');
  }
};

/**
 * Get notifications for a user.
 */
export const getUserNotifications = async (userId, { page = 1, limit = 20, unreadOnly = false }) => {
  const filter = { userId };
  if (unreadOnly) filter.isRead = false;

  const skip = (page - 1) * limit;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ userId, isRead: false }),
  ]);

  return {
    notifications,
    unreadCount,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};

/**
 * Mark notification as read.
 */
export const markAsRead = async (notificationId, userId) => {
  return Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { isRead: true },
    { new: true }
  );
};

/**
 * Mark all notifications as read.
 */
export const markAllAsRead = async (userId) => {
  return Notification.updateMany({ userId, isRead: false }, { isRead: true });
};
