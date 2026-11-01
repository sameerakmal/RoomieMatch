import mongoose, { Schema, model, type HydratedDocument } from 'mongoose';

export type MessageType = 'text' | 'system';

export interface MessageRecord {
  conversation: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  content: string;
  messageType: MessageType;
  readBy: mongoose.Types.ObjectId[];
  idempotencyKey?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<MessageRecord>(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      minlength: [1, 'Message cannot be empty.'],
      maxlength: [4000, 'Message cannot exceed 4000 characters.'],
    },
    messageType: {
      type: String,
      required: true,
      enum: ['text', 'system'],
      default: 'text',
    },
    readBy: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: function (this: MessageRecord) {
        return this.sender ? [this.sender] : [];
      },
    },
    idempotencyKey: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
    strict: 'throw',
    bufferCommands: false,
  },
);

// Indexes for cursor pagination and history retrieval
messageSchema.index({ conversation: 1, createdAt: -1, _id: -1 });
messageSchema.index({ conversation: 1, readBy: 1 });

// Deduplication index for network retries and idempotency keys:
// strictly indexes only documents with a non-empty string idempotencyKey.
messageSchema.index(
  { conversation: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string', $gt: '' } },
  },
);

messageSchema.set('toJSON', {
  transform(_document, result) {
    Reflect.deleteProperty(result, '__v');
    return result;
  },
});

export const Message = model<MessageRecord>('Message', messageSchema);
export type MessageDocument = HydratedDocument<MessageRecord>;

