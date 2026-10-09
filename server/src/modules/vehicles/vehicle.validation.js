import { body } from 'express-validator';

export const createVehicleValidation = [
  body('vehicleNumber').trim().notEmpty().withMessage('Vehicle number is required'),
  body('type').isIn(['WATER_TANKER', 'TRUCK', 'UTILITY_VEHICLE']).withMessage('Invalid vehicle type'),
  body('capacityLiters').isInt({ min: 100 }).withMessage('Capacity must be at least 100 liters'),
  body('currentWaterLevel').optional().isInt({ min: 0 }),
  body('fuelLevel').optional().isFloat({ min: 0, max: 100 }),
];

export const updateVehicleStatusValidation = [
  body('status')
    .isIn(['AVAILABLE', 'ASSIGNED', 'EN_ROUTE', 'DELIVERING', 'MAINTENANCE', 'OFFLINE'])
    .withMessage('Invalid status'),
];
