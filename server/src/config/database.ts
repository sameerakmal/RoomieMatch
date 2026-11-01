import mongoose from 'mongoose';
import { env } from './env.js';
import { User } from '../models/User.js';
import { Connection } from '../models/Connection.js';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { Notification } from '../models/Notification.js';
import { RoommatePreferences } from '../models/RoommatePreferences.js';
import { SocketTicket } from '../models/SocketTicket.js';
import { RevokedSession } from '../models/RevokedSession.js';

export async function connectDatabase(): Promise<void> {
  mongoose.set('bufferCommands', false);
  if (!env.mongoUri) {
    if (env.nodeEnv === 'production') {
      throw new Error('MONGODB_URI must be configured in production.');
    }
    console.warn('MONGODB_URI is not set. Starting development API without a database.');
    return;
  }
  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxPoolSize: 20,
    minPoolSize: 2,
  });

  // Safely ensure and synchronize all schema indexes before accepting traffic
  await Promise.all([
    User.init(),
    Connection.init(),
    Conversation.init(),
    Message.init(),
    Notification.init(),
    RoommatePreferences.init(),
    SocketTicket.init(),
    RevokedSession.init(),
  ]);

  console.info('MongoDB connected.');
  mongoose.connection.on('error', () => console.error('MongoDB connection error. Check database availability.'));
  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected.'));
}
