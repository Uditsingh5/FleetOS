import { body, param, validationResult } from 'express-validator';
import AppError from '../../utils/AppError.js';

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((err) => `${err.path}: ${err.msg}`).join(', ');
    return next(new AppError(messages, 400, 'VALIDATION_ERROR'));
  }
  next();
};

export const createTaskValidation = [
  body('requestId').isMongoId().withMessage('Valid requestId is required'),
  body('vehicleId').isMongoId().withMessage('Valid vehicleId is required'),
  body('driverId').optional({ nullable: true, checkFalsy: true }).isMongoId().withMessage('Valid driverId is required'),
  validate,
];

export const completeTaskValidation = [
  param('id').isMongoId().withMessage('Valid taskId is required'),
  body('deliveryLiters').isFloat({ min: 1 }).withMessage('deliveryLiters must be a positive number'),
  body('notes').optional().isString().trim().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters'),
  validate,
];

export const failTaskValidation = [
  param('id').isMongoId().withMessage('Valid taskId is required'),
  body('failureReason').isString().trim().notEmpty().withMessage('failureReason is required'),
  validate,
];
