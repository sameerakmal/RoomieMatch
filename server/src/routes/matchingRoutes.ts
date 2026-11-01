import { Router } from 'express';
import { getMatchDetails, getMatches } from '../controllers/matchingController.js';
import { authenticate } from '../middleware/authenticate.js';

export const matchingRoutes = Router();

matchingRoutes.use(authenticate);
matchingRoutes.get('/', getMatches);
matchingRoutes.get('/:userId', getMatchDetails);

