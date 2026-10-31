import dotenv from 'dotenv';

dotenv.config({ quiet: true });
const port = Number(process.env.PORT ?? 4000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535.');
const nodeEnv = process.env.NODE_ENV ?? 'development';
if (!['development', 'test', 'production'].includes(nodeEnv)) throw new Error('NODE_ENV must be development, test, or production.');
const mongoUri = process.env.MONGODB_URI?.trim() || undefined;
if (mongoUri && !/^mongodb(?:\+srv)?:\/\//.test(mongoUri)) throw new Error('MONGODB_URI must be a MongoDB connection string.');
if (nodeEnv === 'production' && !mongoUri) throw new Error('MONGODB_URI is required in production.');
if (nodeEnv === 'production' && !process.env.CLIENT_ORIGIN) throw new Error('CLIENT_ORIGIN is required in production.');
const clientOrigins = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(origin => origin.trim()).filter(Boolean);
if (clientOrigins.length === 0 || clientOrigins.some(origin => {
  try { const parsed = new URL(origin); return !['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin; }
  catch { return true; }
})) throw new Error('CLIENT_ORIGIN must contain comma-separated HTTP(S) origins without paths.');

export const env = { port, nodeEnv, mongoUri, clientOrigins };
