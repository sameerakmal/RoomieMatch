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
let revokeConnectionConversations: typeof import('../src/realtime/socketServer.js').revokeConnectionConversations;

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
  process.env.MONGODB_URI = database.getUri('roomiematch_chat_test');

  ({ User } = await import('../src/models/User.js'));
  ({ RoommatePreferences } = await import('../src/models/RoommatePreferences.js'));
  ({ Connection } = await import('../src/models/Connection.js'));
  ({ Conversation } = await import('../src/models/Conversation.js'));
  ({ Message } = await import('../src/models/Message.js'));
  ({ presenceManager } = await import('../src/realtime/presenceManager.js'));
  ({ typingManager } = await import('../src/realtime/typingManager.js'));
  ({ revokeConnectionConversations } = await import('../src/realtime/socketServer.js'));

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
    body: { profile: { city: 'Mumbai', occupation: 'Engineer', bio: 'Quiet and tidy.' } },
  });

  await request('/preferences', {
    method: 'PUT',
    cookie,
    body: basePreferences,
  });

  return { cookie, user };
}

async function createAcceptedConnection(userA: { cookie: string; user: { id: string } }, userB: { cookie: string; user: { id: string } }) {
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
    body: {},
  });
  assert.equal(acceptRes.status, 200);

  return connId;
}

function createSocketClient(cookie?: string): ClientSocket {
  return ioc(baseUrl, {
    extraHeaders: cookie ? { Cookie: cookie } : undefined,
    transports: ['websocket'],
    autoConnect: true,
    reconnection: false,
    timeout: 5000,
  });
}

test('POST /api/conversations/:connectionId creates conversation for accepted connection', async () => {
  const userA = await createCompletedUser('Alice Chat', 'alicechat@example.com');
  const userB = await createCompletedUser('Bob Chat', 'bobchat@example.com');
  const connId = await createAcceptedConnection(userA, userB);

  const res = await request(`/conversations/${connId}`, {
    method: 'POST',
    cookie: userA.cookie,
    body: {},
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.conversation.id);
  assert.equal(data.conversation.connectionId, connId);
  assert.equal(data.conversation.otherParticipant.name, 'Bob Chat');

  // Calling again returns the same conversation without duplicate
  const res2 = await request(`/conversations/${connId}`, {
    method: 'POST',
    cookie: userB.cookie,
    body: {},
  });
  assert.equal(res2.status, 200);
  const data2 = await res2.json();
  assert.equal(data2.conversation.id, data.conversation.id);
  assert.equal(data2.conversation.otherParticipant.name, 'Alice Chat');
});

test('POST /api/conversations/:connectionId rejects non-accepted connections', async () => {
  const userA = await createCompletedUser('Alice NonAccepted', 'alicena@example.com');
  const userB = await createCompletedUser('Bob NonAccepted', 'bobna@example.com');

  // Pending connection
  const reqRes = await request(`/connections/request/${userB.user.id}`, {
    method: 'POST',
    cookie: userA.cookie,
    body: {},
  });
  const connId = (await reqRes.json()).connection.id;

  const resPending = await request(`/conversations/${connId}`, {
    method: 'POST',
    cookie: userA.cookie,
    body: {},
  });
  assert.equal(resPending.status, 400);
  assert.match((await resPending.json()).error.message, /must be accepted/i);

  // Cancelled connection
  await request(`/connections/${connId}/cancel`, { method: 'PATCH', cookie: userA.cookie, body: {} });
  const resCancelled = await request(`/conversations/${connId}`, {
    method: 'POST',
    cookie: userA.cookie,
    body: {},
  });
  assert.equal(resCancelled.status, 400);
});

test('POST /api/conversations/:connectionId rejects unauthorized user', async () => {
  const userA = await createCompletedUser('Alice Owner', 'aliceowner@example.com');
  const userB = await createCompletedUser('Bob Owner', 'bobowner@example.com');
  const userC = await createCompletedUser('Charlie Stranger', 'charliestranger@example.com');
  const connId = await createAcceptedConnection(userA, userB);

  const res = await request(`/conversations/${connId}`, {
    method: 'POST',
    cookie: userC.cookie,
    body: {},
  });
  assert.equal(res.status, 403);
});

test('GET /api/conversations lists only conversations belonging to authenticated user', async () => {
  const userA = await createCompletedUser('Alice List', 'alicelist@example.com');
  const userB = await createCompletedUser('Bob List', 'boblist@example.com');
  const userC = await createCompletedUser('Charlie List', 'charlielist@example.com');

  const connAB = await createAcceptedConnection(userA, userB);
  const connAC = await createAcceptedConnection(userA, userC);

  await request(`/conversations/${connAB}`, { method: 'POST', cookie: userA.cookie, body: {} });
  await request(`/conversations/${connAC}`, { method: 'POST', cookie: userA.cookie, body: {} });

  const resA = await request('/conversations', { cookie: userA.cookie });
  assert.equal(resA.status, 200);
  const dataA = await resA.json();
  assert.equal(dataA.conversations.length, 2);

  const resB = await request('/conversations', { cookie: userB.cookie });
  assert.equal(resB.status, 200);
  const dataB = await resB.json();
  assert.equal(dataB.conversations.length, 1);
  assert.equal(dataB.conversations[0].otherParticipant.name, 'Alice List');
});

test('GET /api/conversations/:id verifies authorization and connection status', async () => {
  const userA = await createCompletedUser('Alice Detail', 'alicedetail@example.com');
  const userB = await createCompletedUser('Bob Detail', 'bobdetail@example.com');
  const userC = await createCompletedUser('Charlie Detail', 'charliedetail@example.com');
  const connId = await createAcceptedConnection(userA, userB);

  const createRes = await request(`/conversations/${connId}`, { method: 'POST', cookie: userA.cookie, body: {} });
  const convId = (await createRes.json()).conversation.id;

  // Participant can view
  const resA = await request(`/conversations/${convId}`, { cookie: userA.cookie });
  assert.equal(resA.status, 200);
  assert.equal((await resA.json()).conversation.otherParticipant.name, 'Bob Detail');

  // Stranger cannot view
  const resC = await request(`/conversations/${convId}`, { cookie: userC.cookie });
  assert.equal(resC.status, 403);
});

test('GET /api/conversations/:id/messages returns paginated history in chronological order', async () => {
  const userA = await createCompletedUser('Alice Msg', 'alicemsg@example.com');
  const userB = await createCompletedUser('Bob Msg', 'bobmsg@example.com');
  const connId = await createAcceptedConnection(userA, userB);

  const createRes = await request(`/conversations/${connId}`, { method: 'POST', cookie: userA.cookie, body: {} });
  const convId = (await createRes.json()).conversation.id;

  // Insert 5 messages
  const uAId = new mongoose.Types.ObjectId(userA.user.id);
  const uBId = new mongoose.Types.ObjectId(userB.user.id);
  const convObjId = new mongoose.Types.ObjectId(convId);

  const m1 = await Message.create({ conversation: convObjId, sender: uAId, content: 'Message 1', readBy: [uAId] });
  const m2 = await Message.create({ conversation: convObjId, sender: uBId, content: 'Message 2', readBy: [uBId] });
  const m3 = await Message.create({ conversation: convObjId, sender: uAId, content: 'Message 3', readBy: [uAId] });
  const m4 = await Message.create({ conversation: convObjId, sender: uBId, content: 'Message 4', readBy: [uBId] });
  const m5 = await Message.create({ conversation: convObjId, sender: uAId, content: 'Message 5', readBy: [uAId] });

  // Update conversation lastMessage
  await Conversation.findByIdAndUpdate(convId, { lastMessage: m5._id, lastMessageAt: m5.createdAt });

  // 1. Fetch with limit 3 (most recent 3: m3, m4, m5 in chronological order)
  const res1 = await request(`/conversations/${convId}/messages?limit=3`, { cookie: userA.cookie });
  assert.equal(res1.status, 200);
  const data1 = await res1.json();
  assert.equal(data1.messages.length, 3);
  assert.equal(data1.hasMore, true);
  assert.equal(data1.messages[0].content, 'Message 3');
  assert.equal(data1.messages[1].content, 'Message 4');
  assert.equal(data1.messages[2].content, 'Message 5');

  // 2. Fetch older messages before cursor
  const res2 = await request(`/conversations/${convId}/messages?before=${data1.nextCursor}&limit=3`, { cookie: userA.cookie });
  assert.equal(res2.status, 200);
  const data2 = await res2.json();
  assert.equal(data2.messages.length, 2);
  assert.equal(data2.hasMore, false);
  assert.equal(data2.messages[0].content, 'Message 1');
  assert.equal(data2.messages[1].content, 'Message 2');
});

test('PATCH /api/conversations/:id/read updates unread messages and count decreases', async () => {
  const userA = await createCompletedUser('Alice Read', 'aliceread@example.com');
  const userB = await createCompletedUser('Bob Read', 'bobread@example.com');
  const connId = await createAcceptedConnection(userA, userB);

  const createRes = await request(`/conversations/${connId}`, { method: 'POST', cookie: userA.cookie, body: {} });
  const convId = (await createRes.json()).conversation.id;

  const uAId = new mongoose.Types.ObjectId(userA.user.id);
  const convObjId = new mongoose.Types.ObjectId(convId);

  // User A sends 2 messages
  await Message.create({ conversation: convObjId, sender: uAId, content: 'Unread 1', readBy: [uAId] });
  await Message.create({ conversation: convObjId, sender: uAId, content: 'Unread 2', readBy: [uAId] });

  // User B's unread count before reading is 2
  const unreadRes1 = await request('/conversations/unread-count', { cookie: userB.cookie });
  assert.equal((await unreadRes1.json()).unreadCount, 2);

  // User B reads conversation
  const readRes = await request(`/conversations/${convId}/read`, {
    method: 'PATCH',
    cookie: userB.cookie,
    body: {},
  });
  assert.equal(readRes.status, 200);
  assert.equal((await readRes.json()).markedCount, 2);

  // User B's unread count after reading is 0
  const unreadRes2 = await request('/conversations/unread-count', { cookie: userB.cookie });
  assert.equal((await unreadRes2.json()).unreadCount, 0);
});

test('Socket.IO: unauthenticated handshake is rejected', async () => {
  const client = createSocketClient(); // No cookie

  await new Promise<void>((resolve) => {
    client.on('connect_error', (err) => {
      assert.match(err.message, /authentication/i);
      client.disconnect();
      resolve();
    });
  });
});

test('Socket.IO: authenticated client connects and tracks presence', async () => {
  const userA = await createCompletedUser('Alice Socket', 'alicesocket@example.com');

  assert.equal(presenceManager.isOnline(userA.user.id), false);

  const client1 = createSocketClient(userA.cookie);

  await new Promise<void>((resolve) => {
    client1.on('connect', () => {
      assert.equal(presenceManager.isOnline(userA.user.id), true);
      resolve();
    });
  });

  // Second socket for same user (e.g. second tab)
  const client2 = createSocketClient(userA.cookie);
  await new Promise<void>((resolve) => {
    client2.on('connect', () => {
      assert.equal(presenceManager.getSocketsForUser(userA.user.id).length, 2);
      resolve();
    });
  });

  // Disconnect client1, presence should stay online because client2 is active
  client1.disconnect();
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(presenceManager.isOnline(userA.user.id), true);

  // Disconnect client2, user is now offline
  client2.disconnect();
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(presenceManager.isOnline(userA.user.id), false);
});

test('Socket.IO: room joining enforces authorization', async () => {
  const userA = await createCompletedUser('Alice Room', 'aliceroom@example.com');
  const userB = await createCompletedUser('Bob Room', 'bobroom@example.com');
  const userC = await createCompletedUser('Charlie Room', 'charlieroom@example.com');
  const connId = await createAcceptedConnection(userA, userB);

  const createRes = await request(`/conversations/${connId}`, { method: 'POST', cookie: userA.cookie, body: {} });
  const convId = (await createRes.json()).conversation.id;

  const clientA = createSocketClient(userA.cookie);
  const clientC = createSocketClient(userC.cookie);

  await Promise.all([
    new Promise<void>((r) => clientA.on('connect', r)),
    new Promise<void>((r) => clientC.on('connect', r)),
  ]);

  // Authorized user A joins room
  clientA.emit('conversation:join', { conversationId: convId });
  await new Promise<void>((resolve) => {
    clientA.on('conversation:joined', (data) => {
      assert.equal(data.conversationId, convId);
      resolve();
    });
  });

  // Unauthorized user C is rejected
  clientC.emit('conversation:join', { conversationId: convId });
  await new Promise<void>((resolve) => {
    clientC.on('conversation:error', (data) => {
      assert.match(data.error, /not a participant/i);
      resolve();
    });
  });

  clientA.disconnect();
  clientC.disconnect();
});

test('Socket.IO: message sending, delivery, idempotency, and read receipts', async () => {
  const userA = await createCompletedUser('Alice Realtime', 'alicert@example.com');
  const userB = await createCompletedUser('Bob Realtime', 'bobrt@example.com');
  const userC = await createCompletedUser('Charlie Observer', 'charlieob@example.com');
  const connId = await createAcceptedConnection(userA, userB);

  const createRes = await request(`/conversations/${connId}`, { method: 'POST', cookie: userA.cookie, body: {} });
  const convId = (await createRes.json()).conversation.id;

  const clientA = createSocketClient(userA.cookie);
  const clientB = createSocketClient(userB.cookie);
  const clientC = createSocketClient(userC.cookie);

  await Promise.all([
    new Promise<void>((r) => clientA.on('connect', r)),
    new Promise<void>((r) => clientB.on('connect', r)),
    new Promise<void>((r) => clientC.on('connect', r)),
  ]);

  clientA.emit('conversation:join', { conversationId: convId });
  clientB.emit('conversation:join', { conversationId: convId });

  await Promise.all([
    new Promise<void>((r) => clientA.on('conversation:joined', () => r())),
    new Promise<void>((r) => clientB.on('conversation:joined', () => r())),
  ]);

  let observerReceived = false;
  clientC.on('message:new', () => {
    observerReceived = true;
  });

  // 1. User A sends message
  const idempotencyKey = 'key-test-123';
  clientA.emit('message:send', {
    conversationId: convId,
    content: 'Hello Bob! Real-time Socket.IO works.',
    idempotencyKey,
  });

  // Sender receives message:sent
  await new Promise<void>((resolve) => {
    clientA.on('message:sent', (ack) => {
      assert.equal(ack.message.content, 'Hello Bob! Real-time Socket.IO works.');
      assert.equal(ack.idempotencyKey, idempotencyKey);
      resolve();
    });
  });

  // Recipient B receives message:new
  await new Promise<void>((resolve) => {
    clientB.on('message:new', (msg) => {
      assert.equal(msg.content, 'Hello Bob! Real-time Socket.IO works.');
      assert.equal(msg.senderId, userA.user.id);
      resolve();
    });
  });

  // Third party client C did not receive message
  assert.equal(observerReceived, false);

  // Verify message persisted in MongoDB
  const savedMsg = await Message.findOne({ conversation: convId, idempotencyKey });
  assert.ok(savedMsg);
  assert.equal(savedMsg.content, 'Hello Bob! Real-time Socket.IO works.');

  // Verify duplicate retry with same idempotencyKey does not duplicate
  clientA.emit('message:send', {
    conversationId: convId,
    content: 'Hello Bob! Real-time Socket.IO works.',
    idempotencyKey,
  });
  await new Promise<void>((resolve) => {
    clientA.on('message:sent', (ack) => {
      assert.equal(ack.message.id, savedMsg._id.toString());
      resolve();
    });
  });
  const count = await Message.countDocuments({ conversation: convId });
  assert.equal(count, 1);

  // 2. Typing indicator
  clientA.emit('typing:start', { conversationId: convId });
  await new Promise<void>((resolve) => {
    clientB.once('typing:update', (data) => {
      assert.equal(data.isTyping, true);
      assert.equal(data.userId, userA.user.id);
      resolve();
    });
  });

  clientA.emit('typing:stop', { conversationId: convId });
  await new Promise<void>((resolve) => {
    clientB.once('typing:update', (data) => {
      assert.equal(data.isTyping, false);
      resolve();
    });
  });

  // 3. Read receipt
  clientB.emit('message:read', { conversationId: convId });
  await new Promise<void>((resolve) => {
    clientA.once('message:read:update', (data) => {
      assert.equal(data.conversationId, convId);
      assert.equal(data.readerId, userB.user.id);
      resolve();
    });
  });

  // Verify readBy updated in MongoDB
  const readMsg = await Message.findById(savedMsg._id);
  assert.ok(readMsg!.readBy.some((id) => id.toString() === userB.user.id));

  clientA.disconnect();
  clientB.disconnect();
  clientC.disconnect();
});

test('Audit: Message idempotency index handles null keys, distinct keys, and duplicate retries', async () => {
  const userA = await createCompletedUser('Idem User A', 'idem_a@test.com');
  const userB = await createCompletedUser('Idem User B', 'idem_b@test.com');
  const connId = await createAcceptedConnection(userA, userB);

  const convRes = await request(`/conversations/${connId}`, {
    method: 'POST',
    cookie: userA.cookie,
  });
  const convId = (await convRes.json()).conversation.id;

  // 1. Multiple messages with NO idempotency key (idempotencyKey: null) in the same conversation
  for (let i = 1; i <= 5; i++) {
    const msg = await Message.create({
      conversation: convId,
      sender: userA.user.id,
      content: `No-key message ${i}`,
      messageType: 'text',
      readBy: [userA.user.id],
      idempotencyKey: null,
    });
    assert.ok(msg._id);
  }

  // 2. Multiple messages with distinct idempotency keys
  const msgKey1 = await Message.create({
    conversation: convId,
    sender: userA.user.id,
    content: 'Distinct key 1',
    messageType: 'text',
    readBy: [userA.user.id],
    idempotencyKey: 'distinct-key-1',
  });
  const msgKey2 = await Message.create({
    conversation: convId,
    sender: userA.user.id,
    content: 'Distinct key 2',
    messageType: 'text',
    readBy: [userA.user.id],
    idempotencyKey: 'distinct-key-2',
  });
  assert.ok(msgKey1._id);
  assert.ok(msgKey2._id);

  // 3. Repeated message with the same idempotency key via Socket.IO
  const clientA = createSocketClient(userA.cookie);
  await new Promise<void>((resolve) => clientA.on('connect', resolve));
  clientA.emit('conversation:join', { conversationId: convId });
  await new Promise<void>((resolve) => clientA.on('conversation:joined', () => resolve()));

  clientA.emit('message:send', {
    conversationId: convId,
    content: 'Retry of distinct key 1',
    idempotencyKey: 'distinct-key-1',
  });

  await new Promise<void>((resolve) => {
    clientA.on('message:sent', (ack) => {
      // Returns the original persisted message without error or duplicate insert
      assert.equal(ack.message.id, msgKey1._id.toString());
      assert.equal(ack.message.content, 'Distinct key 1');
      assert.equal(ack.idempotencyKey, 'distinct-key-1');
      resolve();
    });
  });

  // Total count in database must be exactly 5 (null) + 2 (distinct) = 7
  const totalCount = await Message.countDocuments({ conversation: convId });
  assert.equal(totalCount, 7);

  clientA.disconnect();
});

test('Audit: Compound cursor pagination (createdAt + _id) handles identical timestamps and gap-free paging', async () => {
  const userA = await createCompletedUser('Paging User A', 'paging_a@test.com');
  const userB = await createCompletedUser('Paging User B', 'paging_b@test.com');
  const connId = await createAcceptedConnection(userA, userB);

  const convRes = await request(`/conversations/${connId}`, {
    method: 'POST',
    cookie: userA.cookie,
  });
  const convId = (await convRes.json()).conversation.id;

  // Insert 10 messages all sharing the exact same createdAt timestamp
  const fixedTimestamp = new Date('2026-11-01T12:00:00.000Z');
  const createdIds: string[] = [];

  for (let i = 1; i <= 10; i++) {
    const msg = await Message.create({
      conversation: convId,
      sender: userA.user.id,
      content: `Same-time message ${i}`,
      messageType: 'text',
      readBy: [userA.user.id],
      createdAt: fixedTimestamp,
      updatedAt: fixedTimestamp,
    });
    createdIds.push(msg._id.toString());
  }

  // Page 1: limit 4
  const page1Res = await request(`/conversations/${convId}/messages?limit=4`, {
    cookie: userA.cookie,
  });
  assert.equal(page1Res.status, 200);
  const page1Data = await page1Res.json();
  assert.equal(page1Data.messages.length, 4);
  assert.equal(page1Data.hasMore, true);
  assert.ok(page1Data.nextCursor);

  // Page 2: limit 4 with before cursor
  const page2Res = await request(
    `/conversations/${convId}/messages?before=${page1Data.nextCursor}&limit=4`,
    { cookie: userA.cookie },
  );
  assert.equal(page2Res.status, 200);
  const page2Data = await page2Res.json();
  assert.equal(page2Data.messages.length, 4);
  assert.equal(page2Data.hasMore, true);
  assert.ok(page2Data.nextCursor);

  // Page 3: limit 4 with before cursor
  const page3Res = await request(
    `/conversations/${convId}/messages?before=${page2Data.nextCursor}&limit=4`,
    { cookie: userA.cookie },
  );
  assert.equal(page3Res.status, 200);
  const page3Data = await page3Res.json();
  assert.equal(page3Data.messages.length, 2);
  assert.equal(page3Data.hasMore, false);
  assert.equal(page3Data.nextCursor, null);

  // Combine all retrieved IDs
  const allPagedIds = [
    ...page1Data.messages.map((m: any) => m.id),
    ...page2Data.messages.map((m: any) => m.id),
    ...page3Data.messages.map((m: any) => m.id),
  ];

  assert.equal(allPagedIds.length, 10);
  // Verify strictly 0 duplicate IDs and 0 missing messages
  const uniqueIds = new Set(allPagedIds);
  assert.equal(uniqueIds.size, 10);
});

test('Audit: Revoked connection and untrusted sender IDs are strictly blocked', async () => {
  const userA = await createCompletedUser('Revoke User A', 'revoke_a@test.com');
  const userB = await createCompletedUser('Revoke User B', 'revoke_b@test.com');
  const connId = await createAcceptedConnection(userA, userB);

  const convRes = await request(`/conversations/${connId}`, {
    method: 'POST',
    cookie: userA.cookie,
  });
  const convId = (await convRes.json()).conversation.id;

  const clientA = createSocketClient(userA.cookie);
  await new Promise<void>((resolve) => clientA.on('connect', resolve));
  clientA.emit('conversation:join', { conversationId: convId });
  await new Promise<void>((resolve) => clientA.on('conversation:joined', () => resolve()));

  // Simulate connection revocation by setting status to 'cancelled'
  await Connection.findByIdAndUpdate(connId, { status: 'cancelled' });

  // 1. Sending messages on revoked connection fails
  clientA.emit('message:send', {
    conversationId: convId,
    content: 'Attempting to message after connection was revoked.',
  });

  await new Promise<void>((resolve) => {
    clientA.on('message:failed', (err) => {
      assert.match(err.error, /no longer accepted/i);
      resolve();
    });
  });

  // 2. REST message history is inaccessible after connection is revoked
  const histRes = await request(`/conversations/${convId}/messages`, {
    cookie: userA.cookie,
  });
  assert.equal(histRes.status, 403);

  // 3. Expired JWT handshake is rejected
  const jwt = (await import('jsonwebtoken')).default;
  const expiredToken = jwt.sign(
    { userId: userA.user.id },
    process.env.JWT_SECRET!,
    { expiresIn: -10 },
  );
  const expiredCookie = `roomiematch_session=${expiredToken}`;

  const expiredClient = createSocketClient(expiredCookie);

  await new Promise<void>((resolve) => {
    expiredClient.on('connect_error', (err) => {
      assert.match(err.message, /authentication failed|invalid or expired/i);
      resolve();
    });
  });

  clientA.disconnect();
  expiredClient.disconnect();
});

test('Audit: Multi-tab presence tracking and typing cleanup on disconnect', async () => {
  const userA = await createCompletedUser('Presence User A', 'pres_a@test.com');
  const userB = await createCompletedUser('Presence User B', 'pres_b@test.com');
  const userC = await createCompletedUser('Presence User C', 'pres_c@test.com'); // Unrelated user
  const connId = await createAcceptedConnection(userA, userB);

  const convRes = await request(`/conversations/${connId}`, {
    method: 'POST',
    cookie: userA.cookie,
  });
  const convId = (await convRes.json()).conversation.id;

  // Bob connects
  const clientB = createSocketClient(userB.cookie);
  await new Promise<void>((resolve) => clientB.on('connect', resolve));
  clientB.emit('conversation:join', { conversationId: convId });
  await new Promise<void>((resolve) => clientB.on('conversation:joined', () => resolve()));

  // Unrelated Charlie connects
  const clientC = createSocketClient(userC.cookie);
  await new Promise<void>((resolve) => clientC.on('connect', resolve));

  let charlieSawPresence = false;
  clientC.on('presence:update', (data) => {
    if (data.userId === userA.user.id) {
      charlieSawPresence = true;
    }
  });

  // User A opens Tab 1
  const clientA1 = createSocketClient(userA.cookie);
  await new Promise<void>((resolve) => clientA1.on('connect', resolve));

  // User A opens Tab 2
  const clientA2 = createSocketClient(userA.cookie);
  await new Promise<void>((resolve) => clientA2.on('connect', resolve));
  clientA2.emit('conversation:join', { conversationId: convId });
  await new Promise<void>((resolve) => clientA2.on('conversation:joined', () => resolve()));

  // Presence check: User A is online
  assert.equal(presenceManager.isOnline(userA.user.id), true);

  // Disconnect Tab 1: User A should STILL be online because Tab 2 remains open!
  clientA1.disconnect();
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(presenceManager.isOnline(userA.user.id), true);

  // Tab 2 starts typing
  clientA2.emit('typing:start', { conversationId: convId });
  await new Promise<void>((resolve) => {
    clientB.once('typing:update', (data) => {
      assert.equal(data.isTyping, true);
      resolve();
    });
  });

  // Tab 2 disconnects abruptly: Bob receives typing:false and offline presence
  let bobReceivedTypingCancel = false;
  clientB.on('typing:update', (data) => {
    if (data.userId === userA.user.id && data.isTyping === false) {
      bobReceivedTypingCancel = true;
    }
  });

  let bobReceivedOffline = false;
  clientB.on('presence:update', (data) => {
    if (data.userId === userA.user.id && data.isOnline === false) {
      bobReceivedOffline = true;
    }
  });

  clientA2.disconnect();
  await new Promise((r) => setTimeout(r, 200));

  // Verify typing cancelled and User A marked offline
  assert.equal(presenceManager.isOnline(userA.user.id), false);
  assert.equal(bobReceivedTypingCancel, true);
  assert.equal(bobReceivedOffline, true);

  // Verify unrelated Charlie did NOT receive User A's presence updates
  assert.equal(charlieSawPresence, false);

  clientB.disconnect();
  clientC.disconnect();
});

test('Regression: Multi-tab typing state preserves indicator when one tab disconnects while another is typing', async () => {
  const userA = await createCompletedUser('MultiTyping A', 'multityping_a@test.com');
  const userB = await createCompletedUser('MultiTyping B', 'multityping_b@test.com');
  const connId = await createAcceptedConnection(userA, userB);

  const convRes = await request(`/conversations/${connId}`, {
    method: 'POST',
    cookie: userA.cookie,
  });
  const convId = (await convRes.json()).conversation.id;

  // Bob connects
  const clientB = createSocketClient(userB.cookie);
  await new Promise<void>((resolve) => clientB.on('connect', resolve));
  clientB.emit('conversation:join', { conversationId: convId });
  await new Promise<void>((resolve) => clientB.on('conversation:joined', () => resolve()));

  // User A opens Tab 1 and Tab 2
  const clientA1 = createSocketClient(userA.cookie);
  const clientA2 = createSocketClient(userA.cookie);
  await Promise.all([
    new Promise<void>((resolve) => clientA1.on('connect', resolve)),
    new Promise<void>((resolve) => clientA2.on('connect', resolve)),
  ]);

  clientA1.emit('conversation:join', { conversationId: convId });
  clientA2.emit('conversation:join', { conversationId: convId });
  await Promise.all([
    new Promise<void>((resolve) => clientA1.on('conversation:joined', () => resolve())),
    new Promise<void>((resolve) => clientA2.on('conversation:joined', () => resolve())),
  ]);

  // 1. Tab 1 begins typing -> Bob receives typing:true
  clientA1.emit('typing:start', { conversationId: convId });
  await new Promise<void>((resolve) => {
    clientB.once('typing:update', (data) => {
      assert.equal(data.isTyping, true);
      assert.equal(data.userId, userA.user.id);
      resolve();
    });
  });

  // 2. Tab 2 also registers typing
  await new Promise<void>((resolve) => {
    clientA2.emit('typing:start', { conversationId: convId }, () => resolve());
  });
  assert.equal(typingManager.isTyping(convId, userA.user.id), true);

  // Track if Bob receives an unexpected typing cancellation
  let bobReceivedUnexpectedStop = false;
  const onTyping = (data: any) => {
    if (data.userId === userA.user.id && data.isTyping === false) {
      bobReceivedUnexpectedStop = true;
    }
  };
  clientB.on('typing:update', onTyping);

  // 3. Tab 1 disconnects abruptly.
  // Because Tab 2 is STILL typing, the typing indicator must NOT be cancelled!
  clientA1.disconnect();
  await new Promise((r) => setTimeout(r, 150));

  assert.equal(typingManager.isTyping(convId, userA.user.id), true);
  assert.equal(bobReceivedUnexpectedStop, false, 'Bob should not receive typing:false while Tab 2 is typing');

  // 4. Tab 2 now stops typing -> Now Bob receives typing:false
  clientB.off('typing:update', onTyping);
  clientA2.emit('typing:stop', { conversationId: convId });
  await new Promise<void>((resolve) => {
    clientB.once('typing:update', (data) => {
      assert.equal(data.isTyping, false);
      assert.equal(data.userId, userA.user.id);
      resolve();
    });
  });

  assert.equal(typingManager.isTyping(convId, userA.user.id), false);

  clientA2.disconnect();
  clientB.disconnect();
});

test('Regression: Connection revocation purges existing room memberships and blocks socket events', async () => {
  const userA = await createCompletedUser('SocketRevoke A', 'socketrevoke_a@test.com');
  const userB = await createCompletedUser('SocketRevoke B', 'socketrevoke_b@test.com');
  const connId = await createAcceptedConnection(userA, userB);

  const convRes = await request(`/conversations/${connId}`, {
    method: 'POST',
    cookie: userA.cookie,
  });
  const convId = (await convRes.json()).conversation.id;

  // Both participants connect and join the room while connection is accepted
  const clientA = createSocketClient(userA.cookie);
  const clientB = createSocketClient(userB.cookie);
  await Promise.all([
    new Promise<void>((resolve) => clientA.on('connect', resolve)),
    new Promise<void>((resolve) => clientB.on('connect', resolve)),
  ]);

  clientA.emit('conversation:join', { conversationId: convId });
  clientB.emit('conversation:join', { conversationId: convId });
  await Promise.all([
    new Promise<void>((resolve) => clientA.on('conversation:joined', () => resolve())),
    new Promise<void>((resolve) => clientB.on('conversation:joined', () => resolve())),
  ]);

  // Both participants are in the room. Now revoke the connection via the production API endpoint
  let clientAReceivedRevoke = false;
  let clientBReceivedRevoke = false;
  clientA.on('conversation:revoked', () => {
    clientAReceivedRevoke = true;
  });
  clientB.on('conversation:revoked', () => {
    clientBReceivedRevoke = true;
  });

  const disconnectRes = await request(`/connections/${connId}/disconnect`, {
    method: 'PATCH',
    cookie: userA.cookie,
    body: {},
  });
  assert.equal(disconnectRes.status, 200);

  // Allow events to propagate
  await new Promise((r) => setTimeout(r, 150));

  // 1. Both clients receive conversation:revoked and are removed from the room
  assert.equal(clientAReceivedRevoke, true, 'User A should receive conversation:revoked');
  assert.equal(clientBReceivedRevoke, true, 'User B should receive conversation:revoked');
  // 2. User A attempts to send a message
  clientA.emit('message:send', {
    conversationId: convId,
    content: 'Attempt after revocation',
  });

  await new Promise<void>((resolve) => {
    clientA.on('message:failed', (err) => {
      assert.match(err.error, /no longer accepted/i);
      resolve();
    });
  });

  // Verify Bob never receives message:new
  let bobReceivedMessage = false;
  clientB.on('message:new', () => {
    bobReceivedMessage = true;
  });

  // 3. User A attempts typing:start -> dropped, Bob never receives typing:update
  let bobReceivedTyping = false;
  clientB.on('typing:update', () => {
    bobReceivedTyping = true;
  });
  clientA.emit('typing:start', { conversationId: convId });

  // 4. User B attempts message:read -> dropped, User A never receives message:read:update
  let aReceivedRead = false;
  clientA.on('message:read:update', () => {
    aReceivedRead = true;
  });
  clientB.emit('message:read', { conversationId: convId });

  await new Promise((r) => setTimeout(r, 200));

  assert.equal(bobReceivedMessage, false);
  assert.equal(bobReceivedTyping, false);
  assert.equal(aReceivedRead, false);

  clientA.disconnect();
  clientB.disconnect();
});

test('Integration: Rejecting or cancelling a pending request does not revoke an unrelated accepted conversation', async () => {
  // User A and User B have an accepted connection and active conversation
  const userA = await createCompletedUser('Isolated User A', 'isolated_a@test.com');
  const userB = await createCompletedUser('Isolated User B', 'isolated_b@test.com');
  const connABId = await createAcceptedConnection(userA, userB);

  const convRes = await request(`/conversations/${connABId}`, {
    method: 'POST',
    cookie: userA.cookie,
  });
  const convABId = (await convRes.json()).conversation.id;

  // User A sends a pending connection request to User C
  const userC = await createCompletedUser('Isolated User C', 'isolated_c@test.com');
  const sendRes = await request(`/connections/request/${userC.user.id}`, {
    method: 'POST',
    cookie: userA.cookie,
    body: { message: 'Pending request to C' },
  });
  assert.equal(sendRes.status, 201);
  const pendingConnACId = (await sendRes.json()).connection.id;

  // Alice and Bob connect via Socket.IO and join their conversation room
  const clientA = createSocketClient(userA.cookie);
  const clientB = createSocketClient(userB.cookie);
  await Promise.all([
    new Promise<void>((resolve) => clientA.on('connect', resolve)),
    new Promise<void>((resolve) => clientB.on('connect', resolve)),
  ]);

  clientA.emit('conversation:join', { conversationId: convABId });
  clientB.emit('conversation:join', { conversationId: convABId });
  await Promise.all([
    new Promise<void>((resolve) => clientA.on('conversation:joined', () => resolve())),
    new Promise<void>((resolve) => clientB.on('conversation:joined', () => resolve())),
  ]);

  let convABReceivedRevoke = false;
  clientA.on('conversation:revoked', () => {
    convABReceivedRevoke = true;
  });
  clientB.on('conversation:revoked', () => {
    convABReceivedRevoke = true;
  });

  // User C rejects the pending request from User A via production endpoint
  const rejectRes = await request(`/connections/${pendingConnACId}/reject`, {
    method: 'PATCH',
    cookie: userC.cookie,
    body: {},
  });
  assert.equal(rejectRes.status, 200);

  // Allow any events to process
  await new Promise((r) => setTimeout(r, 150));

  // Verify that the unrelated conversation between Alice and Bob was NOT revoked
  assert.equal(convABReceivedRevoke, false, 'Unrelated conversation must not receive conversation:revoked');

  // Verify Alice can still send messages to Bob and Bob receives them
  let bobReceivedMsg = false;
  clientB.on('message:new', (msg) => {
    if (msg.content === 'Still connected!') {
      bobReceivedMsg = true;
    }
  });

  clientA.emit('message:send', {
    conversationId: convABId,
    content: 'Still connected!',
  });

  await new Promise((r) => setTimeout(r, 200));
  assert.equal(bobReceivedMsg, true, 'Bob should receive message in active conversation');

  clientA.disconnect();
  clientB.disconnect();
});

test('Integration: Database failure during revocation does not produce misleading revocation notifications', async () => {
  const userA = await createCompletedUser('DbFail User A', 'dbfail_a@test.com');
  const userB = await createCompletedUser('DbFail User B', 'dbfail_b@test.com');
  const connId = await createAcceptedConnection(userA, userB);

  const convRes = await request(`/conversations/${connId}`, {
    method: 'POST',
    cookie: userA.cookie,
  });
  const convId = (await convRes.json()).conversation.id;

  const clientA = createSocketClient(userA.cookie);
  const clientB = createSocketClient(userB.cookie);
  await Promise.all([
    new Promise<void>((resolve) => clientA.on('connect', resolve)),
    new Promise<void>((resolve) => clientB.on('connect', resolve)),
  ]);

  clientA.emit('conversation:join', { conversationId: convId });
  clientB.emit('conversation:join', { conversationId: convId });
  await Promise.all([
    new Promise<void>((resolve) => clientA.on('conversation:joined', () => resolve())),
    new Promise<void>((resolve) => clientB.on('conversation:joined', () => resolve())),
  ]);

  let revocationEmitted = false;
  clientA.on('conversation:revoked', () => {
    revocationEmitted = true;
  });
  clientB.on('conversation:revoked', () => {
    revocationEmitted = true;
  });

  // Temporarily stub Connection.prototype.save to throw a database error
  const originalSave = Connection.prototype.save;
  Connection.prototype.save = async function () {
    throw new Error('Database write error: disk full');
  };

  try {
    const res = await request(`/connections/${connId}/disconnect`, {
      method: 'PATCH',
      cookie: userA.cookie,
      body: {},
    });
    // Request must fail
    assert.equal(res.status, 500);

    await new Promise((r) => setTimeout(r, 150));
    // Since save failed, revocation must NOT have fired
    assert.equal(revocationEmitted, false, 'Failed DB write must not emit revocation notification');
  } finally {
    Connection.prototype.save = originalSave;
  }

  clientA.disconnect();
  clientB.disconnect();
});
