import * as taskService from './task.service.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response.js';
import asyncHandler from '../../utils/asyncHandler.js';

export const getRecommendations = asyncHandler(async (req, res) => {
  const recommendations = await taskService.getRecommendations(req.params.requestId);
  sendSuccess(res, recommendations);
});

export const createTask = asyncHandler(async (req, res) => {
  const task = await taskService.createTask(req.body, req.user);
  sendCreated(res, task, 'Task assigned successfully');
});

export const getTasks = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const result = await taskService.getTasks(req.user, {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    status,
  });
  sendPaginated(res, result.tasks, result.pagination);
});

export const getActiveTask = asyncHandler(async (req, res) => {
  const task = await taskService.getActiveTask(req.user.userId);
  sendSuccess(res, task);
});

export const getTaskById = asyncHandler(async (req, res) => {
  const task = await taskService.getTaskById(req.params.id);
  sendSuccess(res, task);
});

export const acceptTask = asyncHandler(async (req, res) => {
  const task = await taskService.acceptTask(req.params.id, req.user);
  sendSuccess(res, task, 'Task accepted');
});

export const startTask = asyncHandler(async (req, res) => {
  const task = await taskService.startTask(req.params.id, req.user);
  sendSuccess(res, task, 'En route to destination');
});

export const arriveTask = asyncHandler(async (req, res) => {
  const task = await taskService.arriveTask(req.params.id, req.user);
  sendSuccess(res, task, 'Arrived at destination');
});

export const startDelivery = asyncHandler(async (req, res) => {
  const task = await taskService.startDelivery(req.params.id, req.user);
  sendSuccess(res, task, 'Delivery in progress');
});

export const completeTask = asyncHandler(async (req, res) => {
  const { deliveryLiters, notes } = req.body;
  const task = await taskService.completeTask(
    req.params.id,
    { deliveryLiters: Number(deliveryLiters), notes },
    req.user
  );
  sendSuccess(res, task, 'Task completed successfully');
});

export const failTask = asyncHandler(async (req, res) => {
  const { failureReason } = req.body;
  const task = await taskService.failTask(req.params.id, { failureReason }, req.user);
  sendSuccess(res, task, 'Task marked as failed');
});
