import { validationResult } from 'express-validator';
import * as authService from './auth.service.js';
import { sendSuccess, sendCreated } from '../../utils/response.js';
import asyncHandler from '../../utils/asyncHandler.js';
import AppError from '../../utils/AppError.js';

const handleValidation = (req) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => e.msg).join('. ');
    throw new AppError(messages, 400, 'VALIDATION_ERROR');
  }
};

export const register = asyncHandler(async (req, res) => {
  handleValidation(req);
  const result = await authService.register(req.body);
  sendCreated(res, result, 'Registration successful');
});

export const login = asyncHandler(async (req, res) => {
  handleValidation(req);
  const result = await authService.login(req.body);
  sendSuccess(res, result, 'Login successful');
});

export const getMe = asyncHandler(async (req, res) => {
  const result = await authService.getMe(req.user.userId);
  sendSuccess(res, result);
});

export const registerByAdmin = asyncHandler(async (req, res) => {
  handleValidation(req);
  const result = await authService.registerByAdmin(req.body, req.user);
  sendCreated(res, result, 'User created successfully');
});
