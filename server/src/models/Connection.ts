import mongoose, { Schema, model, type HydratedDocument } from 'mongoose';

export type ConnectionStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface ConnectionRecord {
  sender: mongoose.Types.ObjectId;
  recipient: mongoose.Types.ObjectId;
  status: ConnectionStatus;
  message: string;
  respondedAt: Date | null;
  pairKey: string;
  createdAt: Date;
  updatedAt: Date;
}

export function generatePairKey(idA: string | mongoose.Types.ObjectId, idB: string | mongoose.Types.ObjectId): string {
  const strA = idA.toString();
  const strB = idB.toString();
  return strA < strB ? `${strA}:${strB}` : `${strB}:${strA}`;
}

const connectionSchema = new Schema<ConnectionRecord>(
  {
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'accepted', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },
    message: { type: String, trim: true, maxlength: 500, default: '' },
    respondedAt: { type: Date, default: null },
    pairKey: { type: String, required: true },
  },
  {
    timestamps: true,
    strict: 'throw',
    bufferCommands: false,
  },
);

// Concurrency-safe unique index: exactly one pending or accepted connection allowed per user pair
connectionSchema.index(
  { pairKey: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['pending', 'accepted'] } },
  },
);

// Query optimization indexes
connectionSchema.index({ recipient: 1, status: 1, createdAt: -1 });
connectionSchema.index({ sender: 1, status: 1, createdAt: -1 });
connectionSchema.index({ status: 1, respondedAt: -1 });
connectionSchema.index({ sender: 1, recipient: 1 });

connectionSchema.set('toJSON', {
  transform(_document, result) {
    Reflect.deleteProperty(result, '__v');
    return result;
  },
});

export const Connection = model<ConnectionRecord>('Connection', connectionSchema);
export type ConnectionDocument = HydratedDocument<ConnectionRecord>;

