import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { HttpError } from './utils/HttpError.js';
import { healthRoutes } from './routes/healthRoutes.js';
import { authRoutes } from './routes/authRoutes.js';
import { profileRoutes } from './routes/profileRoutes.js';
import { preferencesRoutes } from './routes/preferencesRoutes.js';
import { matchingRoutes } from './routes/matchingRoutes.js';
import { connectionRoutes } from './routes/connectionRoutes.js';
import { notificationRoutes } from './routes/notificationRoutes.js';
import { conversationRoutes } from './routes/conversationRoutes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

export const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({ credentials: true, origin(origin, callback) {
  if (!origin || env.clientOrigins.includes(origin)) callback(null, true);
  else callback(new HttpError(403, 'This origin is not allowed.'));
} }));
app.use(express.json({ limit: '16kb' }));
app.use(cookieParser());
app.use('/api/auth', (_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); }, authRoutes);
app.use('/api/profile', (_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); }, profileRoutes);
app.use('/api/preferences', (_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); }, preferencesRoutes);
app.use('/api/matches', (_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); }, matchingRoutes);
app.use('/api/connections', (_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); }, connectionRoutes);
app.use('/api/notifications', (_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); }, notificationRoutes);
app.use('/api/conversations', (_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); }, conversationRoutes);
app.use('/api', healthRoutes);
app.use('/', healthRoutes);
app.use(notFound);
app.use(errorHandler);
