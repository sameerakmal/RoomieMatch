import { Router } from 'express';
import { register, login, logout, me } from '../controllers/authController.js';
import { authenticate, requireDatabase } from '../middleware/authenticate.js';
import { authRateLimit, protectMutation } from '../middleware/requestSecurity.js';

export const authRoutes = Router();
authRoutes.use(protectMutation);
authRoutes.post('/register', authRateLimit, requireDatabase, register);
authRoutes.post('/login', authRateLimit, requireDatabase, login);
authRoutes.post('/logout', logout);
authRoutes.get('/me', authenticate, me);
