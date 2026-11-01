import type { RequestHandler } from 'express';
import { publicUser } from '../models/User.js';
import { authenticateResponse, clearAuthentication, loginUser, registerUser } from '../services/authService.js';
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
export const logout: RequestHandler = (_request, response) => {
  clearAuthentication(response);
  response.json({ message: 'You have been logged out.' });
};
export const me: RequestHandler = (request, response) => {
  response.json({ user: publicUser(request.user!) });
};
