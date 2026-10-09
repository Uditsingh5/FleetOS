import * as notificationService from './notification.service.js';
import { sendSuccess, sendPaginated } from '../../utils/response.js';
import asyncHandler from '../../utils/asyncHandler.js';

export const getMyNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, unreadOnly } = req.query;
  const result = await notificationService.getUserNotifications(req.user.userId, {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    unreadOnly: unreadOnly === 'true',
  });
  sendPaginated(res, result.notifications, result.pagination, { unreadCount: result.unreadCount });
});

export const markAsRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markAsRead(req.params.id, req.user.userId);
  sendSuccess(res, notification, 'Notification marked as read');
});

export const markAllAsRead = asyncHandler(async (req, res) => {
  await notificationService.markAllAsRead(req.user.userId);
  sendSuccess(res, null, 'All notifications marked as read');
});
