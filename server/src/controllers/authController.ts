import type { RequestHandler } from 'express';
import { publicUser } from '../models/User.js';
import { authenticateResponse, clearAuthentication, loginUser, registerUser, sessionCookie, verifyAuthSession, type AuthSession } from '../services/authService.js';
import { issueSocketTicket, revokeSession } from '../services/socketTicketService.js';
import { getSocketServer } from '../realtime/socketServer.js';
import { env } from '../config/env.js';
import { HttpError } from '../utils/HttpError.js';
import { validateCredentials } from '../utils/validation.js';

export const register: RequestHandler = async (request, response) => {
  const { name, email, password } = validateCredentials(request.body, true);
  const user = await registerUser(name!, email, password);
  authenticateResponse(response, user);
  response.status(201).json({ user: publicUser(user) });
};
export const login: RequestHandler = async (request, response) => {
  const { email, password } = validateCredentials(request.body);
  const user = await loginUser(email, password);
  authenticateResponse(response, user);
  response.json({ user: publicUser(user) });
};
export const logout: RequestHandler = async (request, response) => {
  let session: AuthSession | undefined;
  try { session = verifyAuthSession(sessionCookie(request.cookies)); } catch { /* Already expired/absent. */ }
  if (session) {
    await revokeSession(session);
    getSocketServer()?.in(`session:${session.hash}`).disconnectSockets(true);
  }
  clearAuthentication(response);
  response.json({ message: 'You have been logged out.' });
};
export const socketTicket: RequestHandler = async (request, response) => {
  const origin = request.get('Origin');
  if (!origin || !env.clientOrigins.includes(origin)) throw new HttpError(403, 'This origin is not allowed.');
  response.set('Cache-Control', 'no-store');
  response.json(await issueSocketTicket(request.authSession!, origin));
};
export const me: RequestHandler = (request, response) => {
  response.json({ user: publicUser(request.user!) });
};
