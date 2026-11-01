import { Schema, model } from 'mongoose';

const schema = new Schema({
  _id: { type: String, required: true }, // SHA-256 of the JWT; never the JWT itself
  expiresAt: { type: Date, required: true },
}, { versionKey: false, bufferCommands: false });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const RevokedSession = model('RevokedSession', schema);
