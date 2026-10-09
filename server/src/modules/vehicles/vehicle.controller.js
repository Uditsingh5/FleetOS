import { validationResult } from 'express-validator';
import * as vehicleService from './vehicle.service.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response.js';
import asyncHandler from '../../utils/asyncHandler.js';
import AppError from '../../utils/AppError.js';

const handleValidation = (req) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(errors.array().map((e) => e.msg).join('. '), 400, 'VALIDATION_ERROR');
  }
};

export const getVehicles = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, type, isActive } = req.query;
  const result = await vehicleService.getVehicles({
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    status,
    type,
    isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
  });
  sendPaginated(res, result.vehicles, result.pagination);
});

export const getVehicleById = asyncHandler(async (req, res) => {
  const vehicle = await vehicleService.getVehicleById(req.params.id);
  sendSuccess(res, vehicle);
});

export const createVehicle = asyncHandler(async (req, res) => {
  handleValidation(req);
  const vehicle = await vehicleService.createVehicle(req.body, req.user);
  sendCreated(res, vehicle, 'Vehicle created');
});

export const updateVehicle = asyncHandler(async (req, res) => {
  const vehicle = await vehicleService.updateVehicle(req.params.id, req.body, req.user);
  sendSuccess(res, vehicle, 'Vehicle updated');
});

export const updateVehicleStatus = asyncHandler(async (req, res) => {
  handleValidation(req);
  const vehicle = await vehicleService.updateVehicleStatus(req.params.id, req.body.status, req.user);
  sendSuccess(res, vehicle, 'Vehicle status updated');
});

export const getVehicleLocation = asyncHandler(async (req, res) => {
  const location = await vehicleService.getVehicleLocation(req.params.id);
  sendSuccess(res, location);
});

