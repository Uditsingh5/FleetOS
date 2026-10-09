import { Router } from 'express';
import * as vehicleController from './vehicle.controller.js';
import { createVehicleValidation, updateVehicleStatusValidation } from './vehicle.validation.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', authorize('ADMIN', 'SUPER_ADMIN'), vehicleController.getVehicles);
router.post('/', authorize('ADMIN', 'SUPER_ADMIN'), createVehicleValidation, vehicleController.createVehicle);
router.get('/:id', authorize('ADMIN', 'SUPER_ADMIN', 'DRIVER'), vehicleController.getVehicleById);
router.patch('/:id', authorize('ADMIN', 'SUPER_ADMIN'), vehicleController.updateVehicle);
router.patch('/:id/status', authorize('ADMIN', 'SUPER_ADMIN'), updateVehicleStatusValidation, vehicleController.updateVehicleStatus);
router.get('/:id/location', authorize('ADMIN', 'SUPER_ADMIN', 'DRIVER'), vehicleController.getVehicleLocation);

export default router;
