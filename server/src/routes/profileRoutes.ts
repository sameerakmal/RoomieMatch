import { Router } from 'express';
import { getProfile, updateProfile } from '../controllers/profileController.js';
import { authenticate } from '../middleware/authenticate.js';
import { protectMutation } from '../middleware/requestSecurity.js';

export const profileRoutes = Router();
profileRoutes.use(protectMutation, authenticate);
profileRoutes.get('/', getProfile);
profileRoutes.patch('/', updateProfile);
