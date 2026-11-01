import type { RequestHandler } from 'express';
import mongoose from 'mongoose';
import { User, type UserDocument } from '../models/User.js';
import { authCookieName, clearAuthentication, verifyAuthToken } from '../services/authService.js';
import { HttpError } from '../utils/HttpError.js';

declare global {
  namespace Express {
    interface Request { user?: UserDocument }
  }
}
export const requireDatabase: RequestHandler = (_request, _response, next) => {
  if (mongoose.connection.readyState !== 1) throw new HttpError(503, 'Account services are temporarily unavailable. Please try again shortly.');
  next();
};
export const authenticate: RequestHandler = async (request, response, next) => {
  const token: unknown = request.cookies?.[authCookieName];
  let userId: string;
  try {
    userId = verifyAuthToken(token);
  } catch {
    clearAuthentication(response);
    throw new HttpError(401, 'Please log in to continue.');
  }
  if (mongoose.connection.readyState !== 1) throw new HttpError(503, 'Account services are temporarily unavailable. Please try again shortly.');
  const user = await User.findById(userId);
  if (!user) { clearAuthentication(response); throw new HttpError(401, 'Please log in to continue.'); }
  request.user = user;
  next();
};
