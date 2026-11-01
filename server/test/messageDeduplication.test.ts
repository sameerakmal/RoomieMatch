import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import {
  createOptimisticMessage,
  reconcileMessage,
  reconcileFailedMessage,
  mergeOlderMessages,
} from '../../client/src/utils/messageDeduplication.js';
import type { MessageItem } from '../../client/src/types/index.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.JWT_EXPIRES_IN_SECONDS = '3600';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.COOKIE_SAME_SITE = 'lax';

let database: MongoMemoryServer;
let server: http.Server;
let baseUrl: string;
let User: typeof import('../src/models/User.js').User;
let RoommatePreferences: typeof import('../src/models/RoommatePreferences.js').RoommatePreferences;
let Connection: typeof import('../src/models/Connection.js').Connection;
let Conversation: typeof import('../src/models/Conversation.js').Conversation;
let Message: typeof import('../src/models/Message.js').Message;
let presenceManager: typeof import('../src/realtime/presenceManager.js').presenceManager;
let typingManager: typeof import('../src/realtime/typingManager.js').typingManager;

const basePreferences = {
  sleepSchedule: {
    bedtime: '23:00',
    wakeUpTime: '07:00',
    consistency: 'very-consistent',
    wakingEnvironment: 'quiet',
    dailyRoutine: 'working-professional',
    timeAtHome: 'partially-at-home',
  },
  cleanliness: {
    cleanlinessLevel: 'very-organized',
    cleaningFrequency: 'daily',
    kitchenCleanliness: 'clean-immediately',
    bathroomCleaning: 'shared-schedule',
    sharedSpaceOrganization: 'very-tidy',
  },
  noise: {
    noiseTolerance: 'moderate',
    musicHabits: 'rarely',
    studyWorkEnvironment: 'silent',
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    headphoneUsage: 'always',
  },
  guests: {
    guestFrequency: 'rarely',
    overnightGuests: 'not-comfortable',
    advanceNotice: 'required',
    socialLifestyle: 'introverted',
    sharedActivities: 'sometimes',
  },
  budget: {
    minRent: 15000,
    maxRent: 30000,
    accommodationType: 'apartment',
    foodPreference: 'vegetarian',
    foodSharing: 'flexible',
    smoking: 'smoke-free-required',
    alcohol: 'alcohol-free-preferred',
    pets: 'prefer-no-pets',
    roomArrangement: 'private-room',
  },
  requirements: {
    quietEnvironment: 'preferred',
    smokeFree: 'required',
    petFree: 'preferred',
    alcoholFree: 'preferred',
    cleanlinessLevel: 'preferred',
    overnightGuestPolicy: 'preferred',
    dietarySharing: 'preferred',
  },
};

before(async () => {
  database = await MongoMemoryServer.create({
    binary: { version: '8.0.17', downloadDir: join(tmpdir(), 'roomiematch-mongodb') },
  });
  process.env.MONGODB_URI = database.getUri('roomiematch_dedup_test');

  ({ User } = await import('../src/models/User.js'));
  ({ RoommatePreferences } = await import('../src/models/RoommatePreferences.js'));
  ({ Connection } = await import('../src/models/Connection.js'));
  ({ Conversation } = await import('../src/models/Conversation.js'));
  ({ Message } = await import('../src/models/Message.js'));
  ({ presenceManager } = await import('../src/realtime/presenceManager.js'));
  ({ typingManager } = await import('../src/realtime/typingManager.js'));

  const { connectDatabase } = await import('../src/config/database.js');
  await connectDatabase();

  const { app } = await import('../src/app.js');
  const { initSocketServer } = await import('../src/realtime/socketServer.js');

  server = http.createServer(app);
  initSocketServer(server);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, { timeout: 180000 });

beforeEach(async () => {
  await User.deleteMany({});
  await RoommatePreferences.deleteMany({});
  await Connection.deleteMany({});
  await Conversation.deleteMany({});
  await Message.deleteMany({});
  presenceManager.clear();
  typingManager.clear();
});

after(async () => {
  const { closeSocketServer } = await import('../src/realtime/socketServer.js');
  closeSocketServer();
  if (server) await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  await mongoose.disconnect();
  if (database) await database.stop();
});

async function request(
  path: string,
  options: { method?: string; body?: unknown; cookie?: string; headers?: Record<string, string> } = {},
) {
  return fetch(`${baseUrl}/api${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-RoomieMatch-Request': 'web',
      Origin: 'http://localhost:5173',
      ...(options.cookie ? { Cookie: options.cookie } : {}),
      ...options.headers,
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
}

async function createCompletedUser(name: string, email: string) {
  const regRes = await request('/auth/register', {
    method: 'POST',
    body: { name, email, password: 'SecurePassword-123' },
  });
  assert.equal(regRes.status, 201);
  const cookie = regRes.headers.get('set-cookie')!.split(';')[0];
  const user = (await regRes.json()).user;

  await request('/profile', {
    method: 'PATCH',
    cookie,
    body: { profile: { city: 'Delhi', occupation: 'Designer', bio: 'Neat and focused.' } },
  });

  await request('/preferences', {
    method: 'PUT',
    cookie,
    body: basePreferences,
  });

  return { cookie, user };
}

async function createAcceptedConnection(
  userA: { cookie: string; user: { id: string } },
  userB: { cookie: string; user: { id: string } },
) {
  const reqRes = await request(`/connections/request/${userB.user.id}`, {
    method: 'POST',
    cookie: userA.cookie,
    body: { message: 'Let us connect!' },
  });
  assert.equal(reqRes.status, 201);
  const connId = (await reqRes.json()).connection.id;

  const acceptRes = await request(`/connections/${connId}/accept`, {
    method: 'PATCH',
    cookie: userB.cookie,
  });
  assert.equal(acceptRes.status, 200);
  return connId;
}

function createSocketClient(cookie?: string): ClientSocket {
  return ioc(baseUrl, {
    extraHeaders: { Origin: 'http://localhost:5173' },
    auth: async callback => {
      try {
        const response = await request('/auth/socket-ticket', { method: 'POST', body: {}, cookie });
        const data = await response.json();
        callback({ ticket: data.ticket });
      } catch { callback({}); }
    },
    transports: ['websocket'],
    autoConnect: true,
    reconnection: false,
    timeout: 5000,
  });
}

// -------------------------------------------------------------
// 1. Client Deduplication & Reconciliation Logic Tests
// -------------------------------------------------------------

test('Regression: Sender sends message, receives ack and broadcast in any order, produces exactly one message', () => {
  const currentUserId = 'user_sender_1';
  const conversationId = 'conv_123';
  const content = 'hii';

  // 1. User clicks Send: optimistic message is created
  const { message: opt1, idempotencyKey: key1 } = createOptimisticMessage({
    conversationId,
    senderId: currentUserId,
    content,
  });

  assert.equal(opt1.pending, true);
  assert.equal(opt1.idempotencyKey, key1);

  let senderMessages = [opt1];
  assert.equal(senderMessages.length, 1);

  const canonicalServerMsg: MessageItem = {
    id: 'mongo_msg_001',
    conversationId,
    senderId: currentUserId,
    content,
    messageType: 'text',
    readBy: [currentUserId],
    createdAt: new Date().toISOString(),
    idempotencyKey: key1,
  };

  // Order A: message:new broadcast arrives first, then message:sent ack arrives
  senderMessages = reconcileMessage(senderMessages, canonicalServerMsg);
  assert.equal(senderMessages.length, 1, 'Broadcast must replace optimistic placeholder in-place');
  assert.equal(senderMessages[0].id, 'mongo_msg_001', 'ID must update to server MongoDB ID');
  assert.equal(senderMessages[0].pending, false, 'Pending state must be cleared');

  // Next, message:sent acknowledgment arrives with the same canonical message
  senderMessages = reconcileMessage(senderMessages, canonicalServerMsg, key1);
  assert.equal(senderMessages.length, 1, 'Acknowledgment must not append a duplicate message');
  assert.equal(senderMessages[0].id, 'mongo_msg_001');

  // Order B: Repeat with message:sent arriving before message:new
  const { message: opt2, idempotencyKey: key2 } = createOptimisticMessage({
    conversationId,
    senderId: currentUserId,
    content: 'what are you doing',
  });
  let senderMessagesB = [opt2];

  const canonicalServerMsg2: MessageItem = {
    id: 'mongo_msg_002',
    conversationId,
    senderId: currentUserId,
    content: 'what are you doing',
    messageType: 'text',
    readBy: [currentUserId],
    createdAt: new Date().toISOString(),
    idempotencyKey: key2,
  };

  // Sent ack arrives first
  senderMessagesB = reconcileMessage(senderMessagesB, canonicalServerMsg2, key2);
  assert.equal(senderMessagesB.length, 1, 'Sent ack should replace optimistic placeholder');
  assert.equal(senderMessagesB[0].id, 'mongo_msg_002');
  assert.equal(senderMessagesB[0].pending, false);

  // Broadcast arrives second
  senderMessagesB = reconcileMessage(senderMessagesB, canonicalServerMsg2);
  assert.equal(senderMessagesB.length, 1, 'Subsequent broadcast must not duplicate message');
  assert.equal(senderMessagesB[0].id, 'mongo_msg_002');
});

test('Regression: Recipient receives broadcast and displays exactly one message bubble', () => {
  const currentUserId = 'user_recipient_2';
  const conversationId = 'conv_123';

  const incomingFromSender: MessageItem = {
    id: 'mongo_msg_001',
    conversationId,
    senderId: 'user_sender_1',
    content: 'hii',
    messageType: 'text',
    readBy: ['user_sender_1'],
    createdAt: new Date().toISOString(),
    idempotencyKey: 'msg_key_abc',
  };

  let recipientMessages: MessageItem[] = [];

  // First arrival
  recipientMessages = reconcileMessage(recipientMessages, incomingFromSender);
  assert.equal(recipientMessages.length, 1, 'Recipient must add incoming message');
  assert.equal(recipientMessages[0].id, 'mongo_msg_001');

  // Re-delivery or redundant socket broadcast
  recipientMessages = reconcileMessage(recipientMessages, incomingFromSender);
  assert.equal(recipientMessages.length, 1, 'Recipient must ignore duplicate broadcast of same message');
});

test('Regression: Two identical message texts sent separately both appear with distinct IDs', () => {
  const currentUserId = 'user_sender_1';
  const conversationId = 'conv_123';

  let messages: MessageItem[] = [];

  // Send first "hii"
  const { message: opt1, idempotencyKey: key1 } = createOptimisticMessage({
    conversationId,
    senderId: currentUserId,
    content: 'hii',
  });
  messages = [...messages, opt1];

  const srv1: MessageItem = {
    id: 'mongo_msg_101',
    conversationId,
    senderId: currentUserId,
    content: 'hii',
    messageType: 'text',
    readBy: [currentUserId],
    createdAt: '2026-11-01T13:26:00.000Z',
    idempotencyKey: key1,
  };
  messages = reconcileMessage(messages, srv1, key1);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].id, 'mongo_msg_101');

  // Send second "hii" (identical content)
  const { message: opt2, idempotencyKey: key2 } = createOptimisticMessage({
    conversationId,
    senderId: currentUserId,
    content: 'hii',
  });
  messages = [...messages, opt2];
  assert.equal(messages.length, 2, 'Optimistic list must contain both messages');

  const srv2: MessageItem = {
    id: 'mongo_msg_102',
    conversationId,
    senderId: currentUserId,
    content: 'hii',
    messageType: 'text',
    readBy: [currentUserId],
    createdAt: '2026-11-01T13:26:05.000Z',
    idempotencyKey: key2,
  };
  messages = reconcileMessage(messages, srv2, key2);

  assert.equal(messages.length, 2, 'Both identical messages must be preserved');
  assert.equal(messages[0].id, 'mongo_msg_101');
  assert.equal(messages[1].id, 'mongo_msg_102');
  assert.equal(messages[0].content, 'hii');
  assert.equal(messages[1].content, 'hii');
});

test('Regression: Retrying the same idempotency key does not create duplicate messages', () => {
  const currentUserId = 'user_sender_1';
  const conversationId = 'conv_123';
  const key = 'idemp_key_fixed_123';

  const canonical: MessageItem = {
    id: 'mongo_msg_existing',
    conversationId,
    senderId: currentUserId,
    content: 'Retryable message',
    messageType: 'text',
    readBy: [currentUserId],
    createdAt: new Date().toISOString(),
    idempotencyKey: key,
  };

  let messages: MessageItem[] = [canonical];

  // Simulating duplicate retry response from server with same idempotency key and ID
  messages = reconcileMessage(messages, canonical, key);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].id, 'mongo_msg_existing');
});

test('Regression: Failed message updates optimistic item to failed state', () => {
  const conversationId = 'conv_123';
  const senderId = 'user_sender_1';

  const { message: opt, idempotencyKey } = createOptimisticMessage({
    conversationId,
    senderId,
    content: 'Will fail',
  });

  let messages = [opt];
  assert.equal(messages[0].pending, true);

  messages = reconcileFailedMessage(messages, idempotencyKey);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].pending, false);
  assert.equal(messages[0].failed, true);
});

test('Regression: Pagination mergeOlderMessages avoids duplicate messages when historical pages overlap', () => {
  const current: MessageItem[] = [
    {
      id: 'msg_2',
      conversationId: 'c1',
      senderId: 'u1',
      content: 'Second',
      messageType: 'text',
      readBy: ['u1'],
      createdAt: '2026-11-01T10:01:00.000Z',
    },
    {
      id: 'msg_3',
      conversationId: 'c1',
      senderId: 'u1',
      content: 'Third',
      messageType: 'text',
      readBy: ['u1'],
      createdAt: '2026-11-01T10:02:00.000Z',
    },
  ];

  const olderPage: MessageItem[] = [
    {
      id: 'msg_1',
      conversationId: 'c1',
      senderId: 'u1',
      content: 'First',
      messageType: 'text',
      readBy: ['u1'],
      createdAt: '2026-11-01T10:00:00.000Z',
    },
    {
      id: 'msg_2', // Overlaps with current
      conversationId: 'c1',
      senderId: 'u1',
      content: 'Second',
      messageType: 'text',
      readBy: ['u1'],
      createdAt: '2026-11-01T10:01:00.000Z',
    },
  ];

  const merged = mergeOlderMessages(current, olderPage);
  assert.equal(merged.length, 3);
  assert.deepEqual(
    merged.map((m) => m.id),
    ['msg_1', 'msg_2', 'msg_3'],
  );
});

// -------------------------------------------------------------
// 2. End-to-End Socket.IO & REST Verification Tests
// -------------------------------------------------------------

test('Regression E2E: Real-time Socket.IO broadcast and REST history always preserve idempotencyKey', async () => {
  const userA = await createCompletedUser('Dedup E2E A', 'dedup_e2e_a@test.com');
  const userB = await createCompletedUser('Dedup E2E B', 'dedup_e2e_b@test.com');
  const connId = await createAcceptedConnection(userA, userB);

  const convRes = await request(`/conversations/${connId}`, {
    method: 'POST',
    cookie: userA.cookie,
  });
  const convId = (await convRes.json()).conversation.id;

  const clientA = createSocketClient(userA.cookie);
  const clientB = createSocketClient(userB.cookie);
  await Promise.all([
    new Promise<void>((r) => clientA.on('connect', r)),
    new Promise<void>((r) => clientB.on('connect', r)),
  ]);

  clientA.emit('conversation:join', { conversationId: convId });
  clientB.emit('conversation:join', { conversationId: convId });
  await Promise.all([
    new Promise<void>((r) => clientA.once('conversation:joined', () => r())),
    new Promise<void>((r) => clientB.once('conversation:joined', () => r())),
  ]);

  const testKey = 'realtime_idemp_key_777';

  let ackPayload: any;
  let broadcastMsg: any;

  clientA.on('message:sent', (ack) => {
    ackPayload = ack;
  });

  clientB.on('message:new', (msg) => {
    broadcastMsg = msg;
  });

  clientA.emit('message:send', {
    conversationId: convId,
    content: 'Testing idempotencyKey preservation',
    idempotencyKey: testKey,
  });

  await new Promise((r) => setTimeout(r, 350));

  assert.ok(ackPayload, 'Sender must receive message:sent acknowledgement');
  assert.equal(ackPayload.idempotencyKey, testKey);
  assert.equal(ackPayload.message.idempotencyKey, testKey, 'Ack message object must include idempotencyKey');

  assert.ok(broadcastMsg, 'Recipient must receive message:new broadcast');
  assert.equal(broadcastMsg.idempotencyKey, testKey, 'Broadcast message object must include idempotencyKey');

  // Verify REST history also includes idempotencyKey
  const historyRes = await request(`/conversations/${convId}/messages`, {
    cookie: userA.cookie,
  });
  assert.equal(historyRes.status, 200);
  const historyData = await historyRes.json();
  assert.equal(historyData.messages.length, 1);
  assert.equal(historyData.messages[0].idempotencyKey, testKey, 'REST history message must include idempotencyKey');

  clientA.disconnect();
  clientB.disconnect();
});

test('Regression E2E: Switching conversations isolates room events and leaves previous room cleanly', async () => {
  const userA = await createCompletedUser('Room Switch A', 'room_switch_a@test.com');
  const userB = await createCompletedUser('Room Switch B', 'room_switch_b@test.com');
  const userC = await createCompletedUser('Room Switch C', 'room_switch_c@test.com');

  const connABId = await createAcceptedConnection(userA, userB);
  const connACId = await createAcceptedConnection(userA, userC);

  const convABRes = await request(`/conversations/${connABId}`, {
    method: 'POST',
    cookie: userA.cookie,
  });
  const convABId = (await convABRes.json()).conversation.id;

  const convACRes = await request(`/conversations/${connACId}`, {
    method: 'POST',
    cookie: userA.cookie,
  });
  const convACId = (await convACRes.json()).conversation.id;

  const clientA = createSocketClient(userA.cookie);
  const clientB = createSocketClient(userB.cookie);
  await Promise.all([
    new Promise<void>((r) => clientA.on('connect', r)),
    new Promise<void>((r) => clientB.on('connect', r)),
  ]);

  // Client A joins room AB
  clientA.emit('conversation:join', { conversationId: convABId });
  await new Promise<void>((r) => clientA.once('conversation:joined', () => r()));

  // Client A leaves room AB and joins room AC
  clientA.emit('conversation:leave', { conversationId: convABId });
  clientA.emit('conversation:join', { conversationId: convACId });
  await new Promise<void>((r) => clientA.once('conversation:joined', () => r()));

  // Client B joins AB
  clientB.emit('conversation:join', { conversationId: convABId });
  await new Promise<void>((r) => clientB.once('conversation:joined', () => r()));

  let clientAReceivedMsgInAB = false;
  clientA.on('message:new', (msg) => {
    if (msg.conversationId === convABId) {
      clientAReceivedMsgInAB = true;
    }
  });

  clientB.emit('message:send', {
    conversationId: convABId,
    content: 'Message in AB room',
    idempotencyKey: 'switch_key_001',
  });

  await new Promise((r) => setTimeout(r, 300));
  assert.equal(
    clientAReceivedMsgInAB,
    false,
    'Client A must not receive events for conversation AB after leaving the room',
  );

  clientA.disconnect();
  clientB.disconnect();
});

