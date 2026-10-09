import { Router } from 'express';
import * as driverController from './driver.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', authorize('ADMIN', 'SUPER_ADMIN'), driverController.getDrivers);
router.get('/me', authorize('DRIVER'), driverController.getMyProfile);
router.get('/:id', authorize('ADMIN', 'SUPER_ADMIN'), driverController.getDriverById);
router.patch('/:id/status', authorize('ADMIN', 'SUPER_ADMIN', 'DRIVER'), driverController.updateDriverStatus);

export default router;
