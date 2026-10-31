import type { RequestHandler } from 'express';
import { getHealthStatus } from '../services/healthService.js';

export const healthController: RequestHandler = (_request, response) => {
  const health = getHealthStatus();
  response.set('Cache-Control', 'no-store').status(health.status === 'ok' ? 200 : 503).json(health);
};
