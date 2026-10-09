import { validationResult } from 'express-validator';
import * as requestService from './request.service.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response.js';
import asyncHandler from '../../utils/asyncHandler.js';
import AppError from '../../utils/AppError.js';

const handleValidation = (req) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(errors.array().map((e) => e.msg).join('. '), 400, 'VALIDATION_ERROR');
  }
};

export const createRequest = asyncHandler(async (req, res) => {
  handleValidation(req);
  const request = await requestService.createRequest(req.body, req.user);
  sendCreated(res, request, 'Water request submitted');
});

export const getRequests = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, severity, sort } = req.query;
  const result = await requestService.getRequests(req.user, {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    status,
    severity,
    sort,
  });
  sendPaginated(res, result.requests, result.pagination);
});

export const getRequestById = asyncHandler(async (req, res) => {
  const request = await requestService.getRequestById(req.params.id, req.user);
  sendSuccess(res, request);
});

export const approveRequest = asyncHandler(async (req, res) => {
  const request = await requestService.approveRequest(req.params.id, req.user);
  sendSuccess(res, request, 'Request approved');
});

export const rejectRequest = asyncHandler(async (req, res) => {
  const request = await requestService.rejectRequest(req.params.id, req.body.reason, req.user);
  sendSuccess(res, request, 'Request rejected');
});

export const cancelRequest = asyncHandler(async (req, res) => {
  const request = await requestService.cancelRequest(req.params.id, req.user);
  sendSuccess(res, request, 'Request cancelled');
});
