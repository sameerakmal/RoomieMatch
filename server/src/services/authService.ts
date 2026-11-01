import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { CookieOptions, Response } from 'express';
import { env } from '../config/env.js';
import { User, type UserDocument } from '../models/User.js';
import { HttpError } from '../utils/HttpError.js';

const bcryptRounds = 12;
// Compare unknown accounts too, to avoid a quick-return timing distinction.
let dummyHash: Promise<string> | undefined;
export const authCookieName = env.nodeEnv === 'production' ? '__Host-roomiematch_session' : 'roomiematch_session';
export const cookieOptions: CookieOptions = { httpOnly: true, secure: env.nodeEnv === 'production', sameSite: env.cookieSameSite, path: '/' };
export const jwtOptions = { algorithm: 'HS256' as const, issuer: 'roomiematch-api', audience: 'roomiematch-client' };

export function authenticateResponse(response: Response, user: UserDocument): void {
  const token = jwt.sign({}, env.jwtSecret, { ...jwtOptions, subject: user.id as string, expiresIn: env.jwtExpiresInSeconds });
  response.cookie(authCookieName, token, { ...cookieOptions, maxAge: env.jwtExpiresInSeconds * 1000 });
}
export function clearAuthentication(response: Response): void {
  response.clearCookie(authCookieName, cookieOptions);
}
export async function registerUser(name: string, email: string, password: string): Promise<UserDocument> {
  if (await User.exists({ email })) throw new HttpError(409, 'An account with this email already exists.', { email: 'This email is already registered. Try logging in.' });
  const passwordHash = await bcrypt.hash(password, bcryptRounds);
  return User.create({ name, email, passwordHash });
}
export async function loginUser(email: string, password: string): Promise<UserDocument> {
  const user = await User.findOne({ email }).select('+passwordHash');
  dummyHash ??= bcrypt.hash(randomBytes(32).toString('hex'), bcryptRounds);
  const valid = await bcrypt.compare(password, user?.passwordHash ?? await dummyHash);
  if (!user || !valid) throw new HttpError(401, 'Email or password is incorrect.');
  return user;
}
