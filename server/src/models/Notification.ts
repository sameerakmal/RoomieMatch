import mongoose, { Schema, model, type HydratedDocument } from 'mongoose';

export type NotificationType = 'connection_request' | 'connection_accepted' | 'connection_rejected';

export interface NotificationRecord {
  recipient: mongoose.Types.ObjectId;
  actor: mongoose.Types.ObjectId;
  type: NotificationType;
  connectionId: mongoose.Types.ObjectId;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<NotificationRecord>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: ['connection_request', 'connection_accepted', 'connection_rejected'],
    },
    connectionId: { type: Schema.Types.ObjectId, ref: 'Connection', required: true, index: true },
    isRead: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
    strict: 'throw',
    bufferCommands: false,
  },
);

// Prevent duplicate notifications on retried operations
notificationSchema.index(
  { recipient: 1, actor: 1, type: 1, connectionId: 1 },
  { unique: true },
);

// Index for listing unread/read notifications by recipient
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });

notificationSchema.set('toJSON', {
  transform(_document, result) {
    Reflect.deleteProperty(result, '__v');
    return result;
  },
});

export const Notification = model<NotificationRecord>('Notification', notificationSchema);
export type NotificationDocument = HydratedDocument<NotificationRecord>;

