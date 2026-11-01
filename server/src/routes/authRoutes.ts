import { Router } from 'express';
import { register, login, logout, me, socketTicket } from '../controllers/authController.js';
import { authenticate, requireDatabase } from '../middleware/authenticate.js';
import { authRateLimit, protectMutation, socketTicketIpLimit, socketTicketUserLimit } from '../middleware/requestSecurity.js';

export const authRoutes = Router();
authRoutes.use(protectMutation);
authRoutes.post('/register', authRateLimit, requireDatabase, register);
authRoutes.post('/login', authRateLimit, requireDatabase, login);
authRoutes.post('/logout', logout);
authRoutes.post('/socket-ticket', socketTicketIpLimit, authenticate, socketTicketUserLimit, socketTicket);
authRoutes.get('/me', authenticate, me);
