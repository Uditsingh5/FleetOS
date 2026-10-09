import logger from '../lib/logger.js';
import env from '../config/env.js';

/**
 * Express validation error handler — catches express-validator errors.
 */
export const validationErrorHandler = (req, res, next) => {
  next();
};

/**
 * 404 Not Found handler.
 */
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    errorCode: 'NOT_FOUND',
  });
};

/**
 * Global error handler.
 */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errorCode = err.errorCode || 'INTERNAL_ERROR';

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    const messages = Object.values(err.errors).map((e) => e.message);
    message = messages.join('. ');
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = 409;
    errorCode = 'DUPLICATE_KEY';
    const field = Object.keys(err.keyPattern)[0];
    message = `Duplicate value for field: ${field}`;
  }

  // Mongoose cast error
  if (err.name === 'CastError') {
    statusCode = 400;
    errorCode = 'INVALID_ID';
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // Log server errors
  if (statusCode >= 500) {
    logger.error({ err, url: req.originalUrl, method: req.method }, message);
  } else if (statusCode >= 400) {
    logger.warn({ url: req.originalUrl, method: req.method, statusCode, errorCode }, message);
  }

  const response = {
    success: false,
    message,
    errorCode,
  };

  // Include stack trace only in development
  if (env.isDev && statusCode >= 500) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};
