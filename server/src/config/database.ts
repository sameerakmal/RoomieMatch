import mongoose from 'mongoose';
import { env } from './env.js';
import { User } from '../models/User.js';

export async function connectDatabase(): Promise<void> {
  mongoose.set('bufferCommands', false);
  if (!env.mongoUri) {
    console.warn('MONGODB_URI is not set. Starting development API without a database.');
    return;
  }
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5000 });
  // Establish the unique email index before accepting registration traffic.
  await User.init();
  console.info('MongoDB connected.');
  mongoose.connection.on('error', () => console.error('MongoDB connection error. Check database availability.'));
  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected.'));
}
