import { Router } from 'express';
import * as requestController from './request.controller.js';
import { createRequestValidation } from './request.validation.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.post('/', authorize('CITIZEN'), createRequestValidation, requestController.createRequest);
router.get('/', authorize('CITIZEN', 'ADMIN', 'SUPER_ADMIN'), requestController.getRequests);
router.get('/:id', authorize('CITIZEN', 'ADMIN', 'SUPER_ADMIN'), requestController.getRequestById);
router.post('/:id/approve', authorize('ADMIN', 'SUPER_ADMIN'), requestController.approveRequest);
router.post('/:id/reject', authorize('ADMIN', 'SUPER_ADMIN'), requestController.rejectRequest);
router.post('/:id/cancel', authorize('CITIZEN', 'ADMIN', 'SUPER_ADMIN'), requestController.cancelRequest);

export default router;
