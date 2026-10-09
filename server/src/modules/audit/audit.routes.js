import { Router } from 'express';
import * as auditController from './audit.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN', 'SUPER_ADMIN'));

router.get('/', auditController.getAuditLogs);

export default router;
