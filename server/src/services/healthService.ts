import mongoose from 'mongoose';
import { env } from '../config/env.js';

export function getHealthStatus() {
  const states: Record<number, string> = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  const database = env.mongoUri ? states[mongoose.connection.readyState] ?? 'disconnected' : 'unconfigured';
  const healthy = database === 'connected' || (database === 'unconfigured' && env.nodeEnv !== 'production');
  return { status: healthy ? 'ok' : 'degraded', service: 'roomiematch-api', database, timestamp: new Date().toISOString() };
}

export function getReadinessStatus() {
  const ready = mongoose.connection.readyState === 1 || (!env.mongoUri && env.nodeEnv !== 'production');
  return {
    status: ready ? 'ready' : 'not_ready',
    service: 'roomiematch-api',
    timestamp: new Date().toISOString(),
  };
}
