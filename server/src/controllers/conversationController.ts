import type { RequestHandler } from 'express';
import mongoose from 'mongoose';
import { Conversation } from '../models/Conversation.js';
import { Connection } from '../models/Connection.js';
import { Message, type MessageDocument } from '../models/Message.js';
import type { UserDocument } from '../models/User.js';
import { toSafeProfile } from './matchingController.js';
import { presenceManager } from '../realtime/presenceManager.js';
import { getSocketServer } from '../realtime/socketServer.js';
import { HttpError } from '../utils/HttpError.js';

function isValidObjectId(id: unknown): id is string {
  return typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);
}

function formatMessage(msg: MessageDocument) {
  return {
    id: msg._id.toString(),
    conversationId: msg.conversation.toString(),
    senderId: msg.sender.toString(),
    content: msg.content,
    messageType: msg.messageType,
    readBy: msg.readBy.map((id) => id.toString()),
    createdAt: msg.createdAt.toISOString(),
  };
}

async function formatConversation(
  conv: any,
  currentUserId: mongoose.Types.ObjectId,
) {
  const participants = (conv.participants || []) as UserDocument[];
  const otherUser = participants.find((p) => p && p._id && !p._id.equals(currentUserId));

  // Compute unread count for current user
  const unreadCount = await Message.countDocuments({
    conversation: conv._id,
    sender: { $ne: currentUserId },
    readBy: { $ne: currentUserId },
  });

  // Populate or format last message
  let lastMessageFormatted = null;
  if (conv.lastMessage) {
    let lastMsgDoc = conv.lastMessage as unknown as MessageDocument;
    if (!lastMsgDoc.content) {
      const fetched = await Message.findById(conv.lastMessage);
      if (fetched) lastMsgDoc = fetched;
    }
    if (lastMsgDoc && lastMsgDoc.content) {
      lastMessageFormatted = formatMessage(lastMsgDoc);
    }
  }

  const otherUserId = otherUser ? otherUser._id.toString() : '';

  return {
    id: conv._id.toString(),
    connectionId: conv.connection.toString(),
    otherParticipant: otherUser ? toSafeProfile(otherUser) : null,
    lastMessage: lastMessageFormatted,
    lastMessageAt: conv.lastMessageAt ? conv.lastMessageAt.toISOString() : null,
    unreadCount,
    isOnline: otherUserId ? presenceManager.isOnline(otherUserId) : false,
    createdAt: conv.createdAt.toISOString(),
    updatedAt: conv.updatedAt.toISOString(),
  };
}

export const getConversations: RequestHandler = async (request, response) => {
  const currentUserId = request.user!._id;

  // Retrieve user conversations sorted by most recent message
  const conversations = await Conversation.find({ participants: currentUserId })
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .populate<{ participants: UserDocument[] }>('participants', 'name profile')
    .populate<{ lastMessage: MessageDocument }>('lastMessage');

  // Verify accepted connection status for each conversation
  const connectionIds = conversations.map((c) => c.connection);
  const acceptedConnections = await Connection.find({
    _id: { $in: connectionIds },
    status: 'accepted',
  }).select('_id');

  const acceptedSet = new Set(acceptedConnections.map((c) => c._id.toString()));

  // Only return conversations where underlying connection is currently accepted
  const validConversations = conversations.filter((c) => acceptedSet.has(c.connection.toString()));

  const items = await Promise.all(
    validConversations.map((c) => formatConversation(c, currentUserId)),
  );

  const totalUnread = items.reduce((acc, c) => acc + c.unreadCount, 0);

  response.json({
    conversations: items,
    totalUnread,
  });
};

export const getOrCreateConversation: RequestHandler = async (request, response) => {
  const currentUserId = request.user!._id;
  const connectionIdParam = Array.isArray(request.params.connectionId)
    ? request.params.connectionId[0]
    : request.params.connectionId;

  if (!isValidObjectId(connectionIdParam)) {
    throw new HttpError(400, 'Invalid connection ID format.');
  }

  const connection = await Connection.findById(connectionIdParam);
  if (!connection) {
    throw new HttpError(404, 'Connection not found.');
  }

  // 1. Connection authorization: must be accepted
  if (connection.status !== 'accepted') {
    throw new HttpError(400, 'Cannot start conversation: connection must be accepted.');
  }

  // 2. Participant authorization: current user must be sender or recipient
  const isSender = connection.sender.equals(currentUserId);
  const isRecipient = connection.recipient.equals(currentUserId);
  if (!isSender && !isRecipient) {
    throw new HttpError(403, 'You are not authorized to start a conversation for this connection.');
  }

  // 3. Find existing conversation
  let conversation: any = await Conversation.findOne({ connection: connection._id })
    .populate('participants', 'name profile')
    .populate('lastMessage');

  // 4. Create conversation safely if none exists
  if (!conversation) {
    const participants = [connection.sender, connection.recipient].sort((a, b) =>
      a.toString().localeCompare(b.toString()),
    );

    try {
      const created = await Conversation.create({
        connection: connection._id,
        participants,
        lastMessageAt: new Date(),
      });
      conversation = await Conversation.findById(created._id)
        .populate('participants', 'name profile')
        .populate('lastMessage');
    } catch (err: any) {
      if (err.code === 11000) {
        // Concurrency race: fetch existing
        const existing = await Conversation.findOne({ connection: connection._id })
          .populate('participants', 'name profile')
          .populate('lastMessage');
        if (existing) conversation = existing;
        else throw err;
      } else {
        throw err;
      }
    }
  }

  if (!conversation) {
    throw new HttpError(500, 'Unable to create or retrieve conversation.');
  }

  const formatted = await formatConversation(conversation, currentUserId);
  response.status(200).json({ conversation: formatted });
};

export const getConversationById: RequestHandler = async (request, response) => {
  const currentUserId = request.user!._id;
  const idParam = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;

  if (!isValidObjectId(idParam)) {
    throw new HttpError(400, 'Invalid conversation ID format.');
  }

  const conversation = await Conversation.findById(idParam)
    .populate<{ participants: UserDocument[] }>('participants', 'name profile')
    .populate<{ lastMessage: MessageDocument }>('lastMessage');

  if (!conversation) {
    throw new HttpError(404, 'Conversation not found.');
  }

  // Authorization check: participant
  const isParticipant = conversation.participants.some((p) => p && p._id && p._id.equals(currentUserId));
  if (!isParticipant) {
    throw new HttpError(403, 'You are not authorized to view this conversation.');
  }

  // Authorization check: connection status
  const connection = await Connection.findById(conversation.connection);
  if (!connection || connection.status !== 'accepted') {
    throw new HttpError(403, 'Conversation is inaccessible because the connection is no longer accepted.');
  }

  const formatted = await formatConversation(conversation, currentUserId);
  response.json({ conversation: formatted });
};

export const getMessages: RequestHandler = async (request, response) => {
  const currentUserId = request.user!._id;
  const idParam = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;

  if (!isValidObjectId(idParam)) {
    throw new HttpError(400, 'Invalid conversation ID format.');
  }

  const conversation = await Conversation.findById(idParam);
  if (!conversation) {
    throw new HttpError(404, 'Conversation not found.');
  }

  // Participant authorization
  const isParticipant = conversation.participants.some((p) => p.equals(currentUserId));
  if (!isParticipant) {
    throw new HttpError(403, 'You are not authorized to view messages in this conversation.');
  }

  // Connection status authorization
  const connection = await Connection.findById(conversation.connection);
  if (!connection || connection.status !== 'accepted') {
    throw new HttpError(403, 'Messaging is unavailable because the connection is no longer accepted.');
  }

  // Pagination cursor and limit
  const limit = Math.min(100, Math.max(1, parseInt(String(request.query.limit || '30'), 10) || 30));
  const beforeCursor = typeof request.query.before === 'string' ? request.query.before.trim() : undefined;

  const query: mongoose.FilterQuery<any> = {
    conversation: conversation._id,
  };

  if (beforeCursor) {
    if (!isValidObjectId(beforeCursor)) {
      throw new HttpError(400, 'Invalid pagination cursor format.');
    }
    const cursorMsg = await Message.findOne({
      _id: beforeCursor,
      conversation: conversation._id,
    }).select('createdAt _id');

    if (!cursorMsg) {
      throw new HttpError(400, 'Pagination cursor message not found.');
    }

    query.$or = [
      { createdAt: { $lt: cursorMsg.createdAt } },
      { createdAt: cursorMsg.createdAt, _id: { $lt: cursorMsg._id } },
    ];
  }

  // Query limit + 1 using compound sorting matching the index and query conditions
  const rawMessages = await Message.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1);

  const hasMore = rawMessages.length > limit;
  if (hasMore) {
    rawMessages.pop();
  }

  // Reverse so response array is in chronological order (oldest to newest)
  rawMessages.reverse();

  const formattedMessages = rawMessages.map(formatMessage);
  const nextCursor = hasMore && formattedMessages.length > 0 ? formattedMessages[0].id : null;

  response.json({
    messages: formattedMessages,
    nextCursor,
    hasMore,
  });
};

export const markConversationAsRead: RequestHandler = async (request, response) => {
  const currentUserId = request.user!._id;
  const idParam = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;

  if (!isValidObjectId(idParam)) {
    throw new HttpError(400, 'Invalid conversation ID format.');
  }

  const conversation = await Conversation.findById(idParam);
  if (!conversation) {
    throw new HttpError(404, 'Conversation not found.');
  }

  const isParticipant = conversation.participants.some((p) => p.equals(currentUserId));
  if (!isParticipant) {
    throw new HttpError(403, 'You are not authorized to mark this conversation as read.');
  }

  const connection = await Connection.findById(conversation.connection);
  if (!connection || connection.status !== 'accepted') {
    throw new HttpError(403, 'Cannot access conversation: connection is no longer accepted.');
  }

  const result = await Message.updateMany(
    {
      conversation: conversation._id,
      sender: { $ne: currentUserId },
      readBy: { $ne: currentUserId },
    },
    { $addToSet: { readBy: currentUserId } },
  );

  // Notify active room participants via Socket.IO
  if (result.modifiedCount > 0) {
    const io = getSocketServer();
    if (io) {
      io.to(`conversation:${idParam}`).emit('message:read:update', {
        conversationId: idParam,
        readerId: currentUserId.toString(),
        readAt: new Date().toISOString(),
      });
    }
  }

  response.json({
    success: true,
    conversationId: idParam,
    markedCount: result.modifiedCount,
  });
};

export const getUnreadCount: RequestHandler = async (request, response) => {
  const currentUserId = request.user!._id;

  const userConversations = await Conversation.find({ participants: currentUserId }).select('_id');
  const conversationIds = userConversations.map((c) => c._id);

  const totalUnread = await Message.countDocuments({
    conversation: { $in: conversationIds },
    sender: { $ne: currentUserId },
    readBy: { $ne: currentUserId },
  });

  response.json({
    unreadCount: totalUnread,
  });
};
