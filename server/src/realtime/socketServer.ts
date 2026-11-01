import type { Server as HTTPServer } from 'node:http';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { authCookieName, verifyAuthToken } from '../services/authService.js';
import { User, type UserDocument } from '../models/User.js';
import { Conversation } from '../models/Conversation.js';
import { Connection } from '../models/Connection.js';
import { Message } from '../models/Message.js';
import { presenceManager } from './presenceManager.js';
import { typingManager } from './typingManager.js';

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    user: UserDocument;
  };
}

let ioInstance: SocketIOServer | null = null;

export async function revokeConversationRoom(
  conversationId: string | mongoose.Types.ObjectId,
): Promise<void> {
  if (!ioInstance) return;
  const convIdStr = conversationId.toString();
  typingManager.clearConversation(convIdStr);

  const payload = {
    conversationId: convIdStr,
    message: 'Messaging is unavailable because the connection is no longer accepted.',
  };

  // 1. Notify participants currently inside the conversation room
  ioInstance.to(`conversation:${convIdStr}`).emit('conversation:revoked', payload);

  // 2. Also notify participants across all their tabs via individual user channels
  try {
    const conversation = await Conversation.findById(conversationId).select('participants');
    if (conversation?.participants) {
      for (const p of conversation.participants) {
        ioInstance.to(`user:${p.toString()}`).emit('conversation:revoked', payload);
      }
    }
  } catch {
    // Silently continue room eviction
  }

  // 3. Invalidate and evict all active sockets from the conversation room
  ioInstance.in(`conversation:${convIdStr}`).socketsLeave(`conversation:${convIdStr}`);
}

export async function revokeConnectionConversations(
  connectionId: string | mongoose.Types.ObjectId,
): Promise<void> {
  const conversations = await Conversation.find({ connection: connectionId }).select('_id');
  for (const conv of conversations) {
    await revokeConversationRoom(conv._id);
  }
}

async function verifyActiveConversation(
  conversationId: string,
  userId: string,
): Promise<{ conversation: any; valid: boolean; error?: string }> {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    return { conversation: null, valid: false, error: 'Conversation not found.' };
  }
  const isParticipant = conversation.participants.some((p) => p.toString() === userId);
  if (!isParticipant) {
    return {
      conversation,
      valid: false,
      error: 'You are not a participant in this conversation.',
    };
  }
  const connection = await Connection.findById(conversation.connection);
  if (!connection || connection.status !== 'accepted') {
    return {
      conversation,
      valid: false,
      error: 'Messaging is unavailable because the connection is no longer accepted.',
    };
  }
  return { conversation, valid: true };
}

async function broadcastAuthorizedPresence(
  io: SocketIOServer,
  targetUserId: string,
  isOnline: boolean,
): Promise<void> {
  try {
    const acceptedConnections = await Connection.find({
      $or: [
        { sender: targetUserId, status: 'accepted' },
        { recipient: targetUserId, status: 'accepted' },
      ],
    }).select('sender recipient');

    const partnerIds = new Set<string>();
    for (const conn of acceptedConnections) {
      const otherId =
        conn.sender.toString() === targetUserId
          ? conn.recipient.toString()
          : conn.sender.toString();
      partnerIds.add(otherId);
    }

    const targetRooms = [
      ...Array.from(partnerIds).map((id) => `user:${id}`),
      `user:${targetUserId}`,
    ];

    presenceManager.broadcastPresence(io, targetUserId, isOnline, targetRooms);
  } catch {
    // Silently catch broadcast errors to avoid unhandled rejections
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const item of cookieHeader.split(';')) {
    const [rawName, ...rawVal] = item.trim().split('=');
    if (rawName) {
      result[rawName.trim()] = decodeURIComponent(rawVal.join('='));
    }
  }
  return result;
}

export function initSocketServer(httpServer: HTTPServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.clientOrigins,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 1e6, // 1MB buffer limit
  });

  // 1. Authentication Middleware during handshake
  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie;
      const cookies = parseCookies(cookieHeader);
      const token = cookies[authCookieName] ?? cookies['__Host-roomiematch_session'] ?? cookies['roomiematch_session'];

      if (!token) {
        return next(new Error('Authentication required: missing session cookie.'));
      }

      const userId = verifyAuthToken(token);

      if (mongoose.connection.readyState !== 1) {
        return next(new Error('Database unavailable.'));
      }

      const user = await User.findById(userId);
      if (!user) {
        return next(new Error('User account not found.'));
      }

      socket.data.userId = user._id.toString();
      socket.data.user = user;
      next();
    } catch {
      next(new Error('Authentication failed: invalid or expired session.'));
    }
  });

  // 2. Connection handling
  io.on('connection', (rawSocket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const userId = socket.data.userId;

    // Join user's individual channel for direct messaging notifications
    socket.join(`user:${userId}`);

    // Update presence
    const becameOnline = presenceManager.addSocket(userId, socket.id);
    if (becameOnline) {
      void broadcastAuthorizedPresence(io, userId, true);
    }

    // Client event: join conversation room
    socket.on('conversation:join', async (payload: { conversationId?: string }) => {
      const conversationId = payload?.conversationId;

      if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
        return socket.emit('conversation:error', {
          conversationId,
          error: 'Invalid conversation ID format.',
        });
      }

      try {
        const auth = await verifyActiveConversation(conversationId, userId);
        if (!auth.valid) {
          return socket.emit('conversation:error', {
            conversationId,
            error: auth.error,
          });
        }

        socket.join(`conversation:${conversationId}`);
        socket.emit('conversation:joined', { conversationId });
      } catch {
        socket.emit('conversation:error', {
          conversationId,
          error: 'Unable to join conversation room.',
        });
      }
    });

    // Client event: leave conversation room
    socket.on('conversation:leave', (payload: { conversationId?: string }) => {
      const conversationId = payload?.conversationId;
      if (conversationId) {
        socket.leave(`conversation:${conversationId}`);
      }
    });

    // Client event: send real-time message
    socket.on(
      'message:send',
      async (payload: {
        conversationId?: string;
        content?: string;
        idempotencyKey?: string;
      }) => {
        const { conversationId, content, idempotencyKey } = payload || {};

        if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
          return socket.emit('message:failed', {
            conversationId,
            error: 'Invalid conversation ID format.',
            idempotencyKey,
          });
        }

        const trimmedContent = (content || '').trim();
        if (!trimmedContent) {
          return socket.emit('message:failed', {
            conversationId,
            error: 'Message content cannot be empty.',
            idempotencyKey,
          });
        }

        if (trimmedContent.length > 4000) {
          return socket.emit('message:failed', {
            conversationId,
            error: 'Message exceeds the maximum limit of 4000 characters.',
            idempotencyKey,
          });
        }

        // Sanitize idempotency key: must be a non-empty string or null
        const safeIdempotencyKey =
          typeof idempotencyKey === 'string' && idempotencyKey.trim().length > 0
            ? idempotencyKey.trim()
            : null;

        try {
          const auth = await verifyActiveConversation(conversationId, userId);
          if (!auth.valid) {
            if (auth.error?.includes('no longer accepted')) {
              await revokeConversationRoom(conversationId);
            }
            return socket.emit('message:failed', {
              conversationId,
              error: auth.error,
              idempotencyKey: safeIdempotencyKey,
            });
          }
          const conversation = auth.conversation;

          // Idempotency check: if network retry with same key exists, return existing
          if (safeIdempotencyKey) {
            const existing = await Message.findOne({
              conversation: conversation._id,
              idempotencyKey: safeIdempotencyKey,
            });
            if (existing) {
              const formattedExisting = {
                id: existing._id.toString(),
                conversationId,
                senderId: existing.sender.toString(),
                content: existing.content,
                messageType: existing.messageType,
                readBy: existing.readBy.map((id) => id.toString()),
                createdAt: existing.createdAt.toISOString(),
                idempotencyKey: existing.idempotencyKey || undefined,
              };
              return socket.emit('message:sent', {
                message: formattedExisting,
                idempotencyKey: safeIdempotencyKey,
              });
            }
          }

          // Persist message in MongoDB
          const userObjectId = new mongoose.Types.ObjectId(userId);
          const message = await Message.create({
            conversation: conversation._id,
            sender: userObjectId,
            content: trimmedContent,
            messageType: 'text',
            readBy: [userObjectId],
            idempotencyKey: safeIdempotencyKey,
          });

          // Update conversation lastMessage
          conversation.lastMessage = message._id;
          conversation.lastMessageAt = message.createdAt;
          await conversation.save();

          const formattedMessage = {
            id: message._id.toString(),
            conversationId,
            senderId: userId,
            content: message.content,
            messageType: message.messageType,
            readBy: [userId],
            createdAt: message.createdAt.toISOString(),
            idempotencyKey: message.idempotencyKey || undefined,
          };

          // Broadcast to conversation room
          io.to(`conversation:${conversationId}`).emit('message:new', formattedMessage);

          // Return acknowledgment to sender
          socket.emit('message:sent', {
            message: formattedMessage,
            idempotencyKey: safeIdempotencyKey,
          });

          // Notify all participants so their conversation list updates in real-time
          for (const participantId of conversation.participants) {
            io.to(`user:${participantId.toString()}`).emit('conversation:updated', {
              conversationId,
              lastMessage: formattedMessage,
            });
          }
        } catch (err: any) {
          if (err.code === 11000 && safeIdempotencyKey) {
            // Handled duplicate key safely
            const existing = await Message.findOne({
              conversation: conversationId,
              idempotencyKey: safeIdempotencyKey,
            });
            if (existing) {
              return socket.emit('message:sent', {
                message: {
                  id: existing._id.toString(),
                  conversationId,
                  senderId: existing.sender.toString(),
                  content: existing.content,
                  messageType: existing.messageType,
                  readBy: existing.readBy.map((id) => id.toString()),
                  createdAt: existing.createdAt.toISOString(),
                  idempotencyKey: existing.idempotencyKey || undefined,
                },
                idempotencyKey: safeIdempotencyKey,
              });
            }
          }

          socket.emit('message:failed', {
            conversationId,
            error: 'Failed to deliver message. Please try again.',
            idempotencyKey: safeIdempotencyKey,
          });
        }
      },
    );

    // Client event: typing started (multi-tab tracked)
    socket.on(
      'typing:start',
      async (
        payload: { conversationId?: string },
        callback?: (res: { ok: boolean }) => void,
      ) => {
        const conversationId = payload?.conversationId;
        if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
          if (typeof callback === 'function') callback({ ok: false });
          return;
        }

        const auth = await verifyActiveConversation(conversationId, userId);
        if (!auth.valid) {
          if (auth.error?.includes('no longer accepted')) {
            await revokeConversationRoom(conversationId);
          }
          if (typeof callback === 'function') callback({ ok: false });
          return;
        }

        const transitioned = typingManager.startTyping(conversationId, userId, socket.id);
        if (transitioned) {
          socket.to(`conversation:${conversationId}`).emit('typing:update', {
            conversationId,
            userId,
            isTyping: true,
          });
        }
        if (typeof callback === 'function') callback({ ok: true });
      },
    );

    // Client event: typing stopped (cleared only when no tabs typing)
    socket.on(
      'typing:stop',
      (
        payload: { conversationId?: string },
        callback?: (res: { ok: boolean }) => void,
      ) => {
        const conversationId = payload?.conversationId;
        if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
          if (typeof callback === 'function') callback({ ok: false });
          return;
        }

        const transitioned = typingManager.stopTyping(conversationId, userId, socket.id);
        if (transitioned) {
          socket.to(`conversation:${conversationId}`).emit('typing:update', {
            conversationId,
            userId,
            isTyping: false,
          });
        }
        if (typeof callback === 'function') callback({ ok: true });
      },
    );

    // Client event: mark messages read
    socket.on('message:read', async (payload: { conversationId?: string }) => {
      const conversationId = payload?.conversationId;
      if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) return;

      const auth = await verifyActiveConversation(conversationId, userId);
      if (!auth.valid) {
        if (auth.error?.includes('no longer accepted')) {
          await revokeConversationRoom(conversationId);
        }
        return;
      }

      try {
        const userObjectId = new mongoose.Types.ObjectId(userId);
        const result = await Message.updateMany(
          {
            conversation: conversationId,
            sender: { $ne: userObjectId },
            readBy: { $ne: userObjectId },
          },
          { $addToSet: { readBy: userObjectId } },
        );

        if (result.modifiedCount > 0) {
          io.to(`conversation:${conversationId}`).emit('message:read:update', {
            conversationId,
            readerId: userId,
            readAt: new Date().toISOString(),
          });
        }
      } catch {
        // Silently catch socket read errors
      }
    });

    // Disconnecting handling: clean up multi-tab typing indicators
    socket.on('disconnecting', () => {
      const ceasedConversations = typingManager.handleSocketDisconnect(userId, socket.id);
      for (const convId of ceasedConversations) {
        socket.to(`conversation:${convId}`).emit('typing:update', {
          conversationId: convId,
          userId,
          isTyping: false,
        });
      }
    });

    // Disconnect handling: update presence and broadcast offline to authorized connections
    socket.on('disconnect', () => {
      const becameOffline = presenceManager.removeSocket(userId, socket.id);
      if (becameOffline) {
        void broadcastAuthorizedPresence(io, userId, false);
      }
    });
  });

  ioInstance = io;
  return io;
}

export function getSocketServer(): SocketIOServer | null {
  return ioInstance;
}

export function closeSocketServer(): void {
  if (ioInstance) {
    ioInstance.close();
    ioInstance = null;
  }
}
