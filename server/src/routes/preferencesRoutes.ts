import { Router } from 'express';
import {
  getPreferences,
  getPreferencesStatus,
  patchPreferences,
  upsertPreferences,
} from '../controllers/preferencesController.js';
import { authenticate } from '../middleware/authenticate.js';
import { protectMutation } from '../middleware/requestSecurity.js';

export const preferencesRoutes = Router();
preferencesRoutes.use(protectMutation, authenticate);
preferencesRoutes.get('/', getPreferences);
preferencesRoutes.put('/', upsertPreferences);
preferencesRoutes.patch('/', patchPreferences);
preferencesRoutes.get('/status', getPreferencesStatus);

