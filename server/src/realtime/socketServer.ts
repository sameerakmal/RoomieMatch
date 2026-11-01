import type { Server as HTTPServer } from 'node:http';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { consumeSocketTicket, sessionIsActive } from '../services/socketTicketService.js';
import { User, type UserDocument } from '../models/User.js';
import { Conversation } from '../models/Conversation.js';
import { Connection } from '../models/Connection.js';
import { Message } from '../models/Message.js';
import { presenceManager } from './presenceManager.js';
import { typingManager } from './typingManager.js';
import { realtimeDebug } from './diagnostics.js';

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    user: UserDocument;
    sessionHash: string;
    sessionExpiresAt: Date;
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

export function initSocketServer(httpServer: HTTPServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.clientOrigins,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 1e6, // 1MB buffer limit
  });

  const engineTraces = new WeakMap<object, string>();
  let engineSequence = 0;
  io.engine.on('connection', engine => {
    // A log-only correlation ID, not the private Engine.IO transport session ID.
    const engineTraceId = `engine-${++engineSequence}`;
    engineTraces.set(engine, engineTraceId);
    realtimeDebug('engine:open', { engineTraceId, transport: engine.transport.name });
    const trace = (direction: string, packet: { type: string; data?: unknown }) => {
      realtimeDebug('engine:packet', { engineTraceId, direction, type: packet.type,
        namespaceType: packet.type === 'message' && typeof packet.data === 'string' ? packet.data.charAt(0) : undefined });
    };
    engine.on('packet', (packet: { type: string; data?: unknown }) => trace('in', packet));
    engine.on('packetCreate', (packet: { type: string; data?: unknown }) => trace('out', packet));
    engine.on('close', (reason: string) => realtimeDebug('engine:close', { engineTraceId, reason }));
  });

  // 1. Authentication Middleware during handshake
  io.use(async (socket, next) => {
    const reject = (code: string, message: string) => {
      realtimeDebug('auth:rejected', { socketId: socket.id, reason: code });
      next(Object.assign(new Error(message), { data: { code } }));
    };
    try {
      const origin = socket.handshake.headers.origin;
      if (!origin || !env.clientOrigins.includes(origin)) {
        return reject('SOCKET_ORIGIN_INVALID', 'Authentication failed: origin is not allowed.');
      }
      if (mongoose.connection.readyState !== 1) {
        return reject('SOCKET_AUTH_UNAVAILABLE', 'Chat authentication is temporarily unavailable.');
      }
      const ticket = await consumeSocketTicket(socket.handshake.auth?.ticket, origin);
      if (!ticket) return reject('SOCKET_TICKET_INVALID', 'Authentication failed: invalid or expired socket ticket.');
      const user = await User.findById(ticket.userId);
      if (!user) return reject('SOCKET_SESSION_INVALID', 'Authentication failed: account is unavailable.');
      socket.data.userId = user._id.toString();
      socket.data.user = user;
      socket.data.sessionHash = ticket.sessionHash;
      socket.data.sessionExpiresAt = ticket.sessionExpiresAt;
      realtimeDebug('auth:authenticated', { socketId: socket.id, userId: socket.data.userId, origin });
      next();
    } catch {
      reject('SOCKET_AUTH_UNAVAILABLE', 'Chat authentication is temporarily unavailable.');
    }
  });

  // 2. Connection handling
  io.on('connection', (rawSocket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const userId = socket.data.userId;
    const trace = (event: string, details: Record<string, unknown> = {}) => realtimeDebug(event, {
      socketId: socket.id, engineTraceId: engineTraces.get(socket.conn), userId, ...details,
    });
    trace('socket:connected', { origin: socket.handshake.headers.origin, transport: socket.conn.transport.name });

    const endSession = () => {
      if (!socket.connected) return;
      socket.emit('session:ended');
      socket.disconnect(true);
    };
    const checkSession = async () => {
      try {
        const active = await sessionIsActive(socket.data.sessionHash, socket.data.sessionExpiresAt);
        if (!active) endSession();
        return active && socket.connected;
      } catch {
        // Fail closed on database outages; transport close allows a fresh-ticket retry.
        socket.conn.close();
        return false;
      }
    };
    // Join before checking again to close the logout-vs-handshake race. Logout either
    // disconnects this room or the post-join check observes its durable revocation.
    const becameOnline = presenceManager.addSocket(userId, socket.id);
    if (becameOnline) void broadcastAuthorizedPresence(io, userId, true);
    const ready = (async () => {
      await socket.join(`session:${socket.data.sessionHash}`);
      if (!await checkSession()) return false;
      await socket.join(`user:${userId}`);
      if (!socket.connected) return false;
      return true;
    })();
    socket.use((_event, next) => {
      void (async () => {
        if (await ready && await checkSession()) next();
      })();
    });
    // Exact expiry timer (chunked for sessions longer than Node's timeout limit).
    let expiryTimer: ReturnType<typeof setTimeout>;
    const scheduleExpiry = () => {
      const remaining = socket.data.sessionExpiresAt.getTime() - Date.now();
      if (remaining <= 0) { endSession(); return; }
      expiryTimer = setTimeout(scheduleExpiry, Math.min(remaining, 2_147_483_647));
      expiryTimer.unref();
    };
    // Also observes revocations written by another process; current Render instance
    // disconnects its session room immediately on logout.
    const revocationTimer = setInterval(() => { void checkSession(); }, 30_000);
    revocationTimer.unref();
    socket.on('disconnect', () => { clearTimeout(expiryTimer); clearInterval(revocationTimer); });

    // Client event: join conversation room
    socket.on('conversation:join', async (payload: { conversationId?: string }) => {
      const conversationId = payload?.conversationId;
      trace('conversation:join', { conversationId: typeof conversationId === 'string' && /^[a-f\d]{24}$/i.test(conversationId) ? conversationId : undefined });

      if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
        return socket.emit('conversation:error', {
          conversationId,
          error: 'Invalid conversation ID format.',
        });
      }

      try {
        const auth = await verifyActiveConversation(conversationId, userId);
        if (!auth.valid) {
          trace('conversation:rejected', { conversationId, reason: 'authorization_failed' });
          return socket.emit('conversation:error', {
            conversationId,
            error: auth.error,
          });
        }

        socket.join(`conversation:${conversationId}`);
        trace('conversation:joined', { conversationId, room: `conversation:${conversationId}`,
          roomSocketCount: io.sockets.adapter.rooms.get(`conversation:${conversationId}`)?.size ?? 0 });
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
        trace('conversation:left', { conversationId: /^[a-f\d]{24}$/i.test(conversationId) ? conversationId : undefined });
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
        trace('message:received', { conversationId });
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
            trace('message:rejected', { conversationId, reason: 'authorization_failed' });
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
              trace('message:deduplicated', { conversationId, messageId: existing._id.toString() });
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
          trace('message:persisted', { conversationId, messageId: message._id.toString() });

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
          if (process.env.REALTIME_DEBUG === 'true') {
            const room = `conversation:${conversationId}`;
            const members = io.sockets.adapter.rooms.get(room) ?? new Set<string>();
            const recipientIds = new Set(conversation.participants.map((id: mongoose.Types.ObjectId) => id.toString()).filter((id: string) => id !== userId));
            trace('message:broadcast', { conversationId, messageId: message._id.toString(), room,
              roomSocketCount: members.size, recipientSocketCount: [...members].filter(id => recipientIds.has(io.sockets.sockets.get(id)?.data.userId)).length });
          }
          io.to(`conversation:${conversationId}`).emit('message:new', formattedMessage);

          // Return acknowledgment to sender
          socket.emit('message:sent', {
            message: formattedMessage,
            idempotencyKey: safeIdempotencyKey,
          });
          trace('message:acknowledged', { conversationId, messageId: message._id.toString() });

          // Notify all participants so their conversation list updates in real-time
          for (const participantId of conversation.participants) {
            io.to(`user:${participantId.toString()}`).emit('conversation:updated', {
              conversationId,
              lastMessage: formattedMessage,
            });
          }
        } catch (err: any) {
          trace('message:error', { conversationId, reason: err.code === 11000 ? 'duplicate_key' : 'persistence_or_delivery_failed' });
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
    socket.on('disconnect', reason => {
      trace('socket:disconnected', { reason });
      const becameOffline = presenceManager.removeSocket(userId, socket.id);
      if (becameOffline) {
        void broadcastAuthorizedPresence(io, userId, false);
      }
    });
    // Register cleanup first: a session can expire between middleware and connection.
    scheduleExpiry();
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
