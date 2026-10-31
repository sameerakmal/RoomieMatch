import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { HttpError } from './utils/HttpError.js';
import { healthRoutes } from './routes/healthRoutes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

export const app = express();
app.disable('x-powered-by');
app.use(cors({ origin(origin, callback) {
  if (!origin || env.clientOrigins.includes(origin)) callback(null, true);
  else callback(new HttpError(403, 'This origin is not allowed.'));
} }));
app.use(express.json({ limit: '16kb' }));
app.use('/api', healthRoutes);
app.use(notFound);
app.use(errorHandler);
