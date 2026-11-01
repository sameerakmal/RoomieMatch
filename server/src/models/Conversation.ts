import mongoose, { Schema, model, type HydratedDocument } from 'mongoose';

export interface ConversationRecord {
  participants: mongoose.Types.ObjectId[];
  connection: mongoose.Types.ObjectId;
  lastMessage?: mongoose.Types.ObjectId | null;
  lastMessageAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<ConversationRecord>(
  {
    participants: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      required: true,
      validate: {
        validator(val: mongoose.Types.ObjectId[]) {
          return Array.isArray(val) && val.length === 2 && !val[0].equals(val[1]);
        },
        message: 'A conversation must have exactly two distinct participants.',
      },
    },
    connection: {
      type: Schema.Types.ObjectId,
      ref: 'Connection',
      required: true,
      unique: true,
    },
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    strict: 'throw',
    bufferCommands: false,
  },
);

// Indexes for conversation lookups and recent chronological sorting
conversationSchema.index({ participants: 1, lastMessageAt: -1 });
conversationSchema.index({ participants: 1 });

conversationSchema.set('toJSON', {
  transform(_document, result) {
    Reflect.deleteProperty(result, '__v');
    return result;
  },
});

export const Conversation = model<ConversationRecord>('Conversation', conversationSchema);
export type ConversationDocument = HydratedDocument<ConversationRecord>;

