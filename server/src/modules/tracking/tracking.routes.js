import { Router } from 'express';
import * as trackingController from './tracking.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

// Driver sends GPS ping
router.post(
  '/ping',
  authorize('DRIVER'),
  trackingController.pingLocation
);

// Admin live fleet view
router.get(
  '/fleet',
  authorize('ADMIN', 'SUPER_ADMIN', 'CITIZEN'),
  trackingController.getFleetLocations
);

// Tracking a task delivery (Citizen for their task, Admin for any task)
router.get(
  '/tasks/:taskId',
  authorize('ADMIN', 'SUPER_ADMIN', 'CITIZEN'),
  trackingController.getTaskTracking
);

// Sampled breadcrumbs for a vehicle
router.get(
  '/breadcrumbs/:vehicleId',
  authorize('ADMIN', 'SUPER_ADMIN'),
  trackingController.getVehicleBreadcrumbs
);

// Demo driver simulation controls
router.get('/simulation/status', authorize('ADMIN', 'SUPER_ADMIN', 'DRIVER'), trackingController.getSimulationStatus);
router.post('/simulation/toggle', authorize('ADMIN', 'SUPER_ADMIN', 'DRIVER'), trackingController.toggleSimulation);
router.post('/simulation/start', authorize('ADMIN', 'SUPER_ADMIN', 'DRIVER'), trackingController.startSimulation);
router.post('/simulation/stop', authorize('ADMIN', 'SUPER_ADMIN', 'DRIVER'), trackingController.stopSimulation);
router.post('/simulation/pause', authorize('ADMIN', 'SUPER_ADMIN'), trackingController.pauseSimulation);
router.post('/simulation/resume', authorize('ADMIN', 'SUPER_ADMIN'), trackingController.resumeSimulation);

export default router;
