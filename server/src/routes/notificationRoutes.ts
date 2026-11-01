import { Router } from 'express';
import {
  getNotifications,
  markAllAsRead,
  markAsRead,
} from '../controllers/notificationController.js';
import { authenticate } from '../middleware/authenticate.js';
import { protectMutation } from '../middleware/requestSecurity.js';

export const notificationRoutes = Router();

notificationRoutes.use(protectMutation, authenticate);

notificationRoutes.get('/', getNotifications);
notificationRoutes.patch('/read-all', markAllAsRead);
notificationRoutes.patch('/:id/read', markAsRead);

