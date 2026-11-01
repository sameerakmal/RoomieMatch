import { Schema, model } from 'mongoose';

const schema = new Schema({
  _id: { type: String, required: true }, // SHA-256 of a random 256-bit bearer ticket
  userId: { type: Schema.Types.ObjectId, required: true },
  sessionHash: { type: String, required: true, index: true },
  sessionExpiresAt: { type: Date, required: true },
  origin: { type: String, required: true },
  expiresAt: { type: Date, required: true },
}, { versionKey: false, bufferCommands: false });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const SocketTicket = model('SocketTicket', schema);
