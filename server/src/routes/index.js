import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import userRoutes from '../modules/users/user.routes.js';
import vehicleRoutes from '../modules/vehicles/vehicle.routes.js';
import driverRoutes from '../modules/drivers/driver.routes.js';
import requestRoutes from '../modules/requests/request.routes.js';
import taskRoutes from '../modules/tasks/task.routes.js';
import trackingRoutes from '../modules/tracking/tracking.routes.js';
import analyticsRoutes from '../modules/analytics/analytics.routes.js';
import auditRoutes from '../modules/audit/audit.routes.js';
import notificationRoutes from '../modules/notifications/notification.routes.js';
import mapRoutes from '../modules/map/map.routes.js';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'WaterFleetOS API operational',
    timestamp: new Date().toISOString(),
    service: 'waterfleet-os-backend',
  });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/vehicles', vehicleRoutes);
router.use('/drivers', driverRoutes);
router.use('/requests', requestRoutes);
router.use('/tasks', taskRoutes);
router.use('/tracking', trackingRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/audit', auditRoutes);
router.use('/notifications', notificationRoutes);
router.use('/map', mapRoutes);

export default router;
