import type { RequestHandler } from 'express';
import mongoose from 'mongoose';
import { Notification } from '../models/Notification.js';
import type { UserDocument } from '../models/User.js';
import { toSafeProfile } from './matchingController.js';
import { HttpError } from '../utils/HttpError.js';

function isValidObjectId(id: unknown): id is string {
  return typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);
}

export const getNotifications: RequestHandler = async (request, response) => {
  const currentUserId = request.user!._id;
  const page = Math.max(1, parseInt(String(request.query.page || '1'), 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(request.query.limit || '15'), 10) || 15));

  const filter = { recipient: currentUserId };
  const total = await Notification.countDocuments(filter);
  const unreadCount = await Notification.countDocuments({ recipient: currentUserId, isRead: false });
  const totalPages = Math.ceil(total / limit) || 1;
  const skip = (page - 1) * limit;

  const notifications = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate<{ actor: UserDocument }>('actor', 'name profile');

  const items = notifications.map((notif) => ({
    id: notif._id.toString(),
    type: notif.type,
    isRead: notif.isRead,
    connectionId: notif.connectionId.toString(),
    createdAt: notif.createdAt.toISOString(),
    actor: notif.actor ? toSafeProfile(notif.actor) : null,
  }));

  response.json({
    notifications: items,
    unreadCount,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  });
};

export const markAsRead: RequestHandler = async (request, response) => {
  const currentUserId = request.user!._id;
  const idParam = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;

  if (!isValidObjectId(idParam)) {
    throw new HttpError(400, 'Invalid notification ID.');
  }

  const notification = await Notification.findOne({
    _id: idParam,
    recipient: currentUserId,
  });

  if (!notification) {
    throw new HttpError(404, 'Notification not found.');
  }

  if (!notification.isRead) {
    notification.isRead = true;
    await notification.save();
  }

  const unreadCount = await Notification.countDocuments({ recipient: currentUserId, isRead: false });

  response.json({
    success: true,
    notificationId: notification._id.toString(),
    unreadCount,
  });
};

export const markAllAsRead: RequestHandler = async (request, response) => {
  const currentUserId = request.user!._id;

  await Notification.updateMany(
    { recipient: currentUserId, isRead: false },
    { $set: { isRead: true } },
  );

  response.json({
    success: true,
    unreadCount: 0,
  });
};

