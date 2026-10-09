import * as driverService from './driver.service.js';
import { sendSuccess, sendPaginated } from '../../utils/response.js';
import asyncHandler from '../../utils/asyncHandler.js';

export const getDrivers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const result = await driverService.getDrivers({
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    status,
  });
  sendPaginated(res, result.drivers, result.pagination);
});

export const getDriverById = asyncHandler(async (req, res) => {
  const driver = await driverService.getDriverById(req.params.id);
  sendSuccess(res, driver);
});

export const getMyProfile = asyncHandler(async (req, res) => {
  const driver = await driverService.getDriverByUserId(req.user.userId);
  sendSuccess(res, driver);
});

export const updateDriverStatus = asyncHandler(async (req, res) => {
  const driver = await driverService.updateDriverStatus(req.params.id, req.body.status, req.user);
  sendSuccess(res, driver, 'Driver status updated');
});
