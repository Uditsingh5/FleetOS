import { Router } from 'express';
import * as analyticsController from './analytics.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN', 'SUPER_ADMIN'));

router.get('/overview', analyticsController.getOverview);
router.get('/requests', analyticsController.getRequestsAnalytics);
router.get('/fleet', analyticsController.getFleetAnalytics);
router.get('/water', analyticsController.getWaterAnalytics);
router.get('/scarcity', analyticsController.getScarcityHeatmap);

export default router;
