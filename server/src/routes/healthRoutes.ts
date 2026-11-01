import { Router } from 'express';
import { healthController, readinessController } from '../controllers/healthController.js';

export const healthRoutes = Router();
healthRoutes.get('/health', healthController);
healthRoutes.get('/ready', readinessController);
