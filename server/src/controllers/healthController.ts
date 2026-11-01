import type { RequestHandler } from 'express';
import { getHealthStatus, getReadinessStatus } from '../services/healthService.js';

export const healthController: RequestHandler = (_request, response) => {
  const health = getHealthStatus();
  response.set('Cache-Control', 'no-store').status(health.status === 'ok' ? 200 : 503).json(health);
};

export const readinessController: RequestHandler = (_request, response) => {
  const readiness = getReadinessStatus();
  response.set('Cache-Control', 'no-store').status(readiness.status === 'ready' ? 200 : 503).json(readiness);
};
