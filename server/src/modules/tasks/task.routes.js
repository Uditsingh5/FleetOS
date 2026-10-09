import { Router } from 'express';
import * as taskController from './task.controller.js';
import {
  createTaskValidation,
  completeTaskValidation,
  failTaskValidation,
} from './task.validation.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

// Admin-only endpoints
router.get(
  '/recommendations/:requestId',
  authorize('ADMIN', 'SUPER_ADMIN'),
  taskController.getRecommendations
);
router.post(
  '/',
  authorize('ADMIN', 'SUPER_ADMIN'),
  createTaskValidation,
  taskController.createTask
);

// Admin & Driver list/detail endpoints
router.get(
  '/',
  authorize('ADMIN', 'SUPER_ADMIN', 'DRIVER'),
  taskController.getTasks
);
router.get(
  '/active',
  authorize('DRIVER'),
  taskController.getActiveTask
);
router.get(
  '/:id',
  authorize('ADMIN', 'SUPER_ADMIN', 'DRIVER'),
  taskController.getTaskById
);

// Driver workflow endpoints
router.post(
  '/:id/accept',
  authorize('DRIVER'),
  taskController.acceptTask
);
router.post(
  '/:id/start',
  authorize('DRIVER'),
  taskController.startTask
);
router.post(
  '/:id/arrive',
  authorize('DRIVER'),
  taskController.arriveTask
);
router.post(
  '/:id/delivering',
  authorize('DRIVER'),
  taskController.startDelivery
);
router.post(
  '/:id/start-delivery',
  authorize('DRIVER'),
  taskController.startDelivery
);
router.post(
  '/:id/complete',
  authorize('DRIVER'),
  completeTaskValidation,
  taskController.completeTask
);
router.post(
  '/:id/fail',
  authorize('DRIVER'),
  failTaskValidation,
  taskController.failTask
);

export default router;
