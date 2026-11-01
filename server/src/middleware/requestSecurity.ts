import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { HttpError } from '../utils/HttpError.js';

// Requiring this custom header forces cross-origin browser writes through CORS
// preflight. Origin allowlisting is applied before this middleware in app.ts.
export const protectMutation: RequestHandler = (request, _response, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    if (request.get('X-RoomieMatch-Request') !== 'web') throw new HttpError(403, 'Request verification failed. Refresh the page and try again.');
    if (request.method !== 'POST' || request.path !== '/logout') {
      if (!request.is('application/json')) throw new HttpError(415, 'Send the request as application/json.');
    }
  }
  next();
};
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_request, _response, next) => next(new HttpError(429, 'Too many attempts. Please try again in 15 minutes.')),
});
