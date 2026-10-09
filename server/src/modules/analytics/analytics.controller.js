import * as analyticsService from './analytics.service.js';
import { sendSuccess } from '../../utils/response.js';
import asyncHandler from '../../utils/asyncHandler.js';

export const getOverview = asyncHandler(async (req, res) => {
  const data = await analyticsService.getOverview();
  sendSuccess(res, data);
});

export const getRequestsAnalytics = asyncHandler(async (req, res) => {
  const data = await analyticsService.getRequestsAnalytics();
  sendSuccess(res, data);
});

export const getFleetAnalytics = asyncHandler(async (req, res) => {
  const data = await analyticsService.getFleetAnalytics();
  sendSuccess(res, data);
});

export const getWaterAnalytics = asyncHandler(async (req, res) => {
  const data = await analyticsService.getWaterAnalytics();
  sendSuccess(res, data);
});

export const getScarcityHeatmap = asyncHandler(async (req, res) => {
  const data = await analyticsService.getScarcityHeatmap();
  sendSuccess(res, data);
});
