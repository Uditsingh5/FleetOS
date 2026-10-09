import { Router } from 'express';
import * as authController from './auth.controller.js';
import { registerValidation, loginValidation, adminRegisterValidation } from './auth.validation.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';
import { authLimiter } from '../../middleware/rateLimit.middleware.js';

const router = Router();

router.post('/register', authLimiter, registerValidation, authController.register);
router.post('/login', authLimiter, loginValidation, authController.login);
router.get('/me', authenticate, authController.getMe);
router.post(
  '/register-user',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  adminRegisterValidation,
  authController.registerByAdmin
);

export default router;
