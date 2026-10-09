import { body } from 'express-validator';

export const createRequestValidation = [
  body('location.lat').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude is required'),
  body('location.lng').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude is required'),
  body('address').trim().notEmpty().withMessage('Address is required'),
  body('severity').isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).withMessage('Invalid severity'),
  body('requestedLiters').isInt({ min: 100, max: 50000 }).withMessage('Requested liters must be 100–50000'),
  body('estimatedAffectedPeople').optional().isInt({ min: 1 }),
  body('description').optional().trim().isLength({ max: 1000 }),
  body('isEmergency').optional().isBoolean(),
];
