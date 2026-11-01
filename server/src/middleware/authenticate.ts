import type { RequestHandler } from 'express';
import mongoose from 'mongoose';
import { User, type UserDocument } from '../models/User.js';
import { clearAuthentication, sessionCookie, verifyAuthSession, type AuthSession } from '../services/authService.js';
import { sessionIsActive } from '../services/socketTicketService.js';
import { HttpError } from '../utils/HttpError.js';

declare global {
  namespace Express {
    interface Request { user?: UserDocument; authSession?: AuthSession }
  }
}
export const requireDatabase: RequestHandler = (_request, _response, next) => {
  if (mongoose.connection.readyState !== 1) throw new HttpError(503, 'Account services are temporarily unavailable. Please try again shortly.');
  next();
};
export const authenticate: RequestHandler = async (request, response, next) => {
  const token = sessionCookie(request.cookies);
  let session: AuthSession;
  try {
    session = verifyAuthSession(token);
  } catch {
    if (token) clearAuthentication(response);
    throw new HttpError(401, 'Please log in to continue.');
  }
  if (mongoose.connection.readyState !== 1) throw new HttpError(503, 'Account services are temporarily unavailable. Please try again shortly.');
  if (!await sessionIsActive(session.hash, session.expiresAt)) {
    clearAuthentication(response);
    throw new HttpError(401, 'Please log in to continue.');
  }
  const user = await User.findById(session.userId);
  if (!user) { clearAuthentication(response); throw new HttpError(401, 'Please log in to continue.'); }
  request.user = user;
  request.authSession = session;
  next();
};
