import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server-core';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.JWT_EXPIRES_IN_SECONDS = '3600';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.COOKIE_SAME_SITE = 'lax';

let database: MongoMemoryServer;
let server: Server;
let baseUrl: string;
let User: typeof import('../src/models/User.js').User;
let RoommatePreferences: typeof import('../src/models/RoommatePreferences.js').RoommatePreferences;
let Connection: typeof import('../src/models/Connection.js').Connection;
let Notification: typeof import('../src/models/Notification.js').Notification;

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
  process.env.MONGODB_URI = database.getUri('roomiematch_conn_test');
  ({ User } = await import('../src/models/User.js'));
  ({ RoommatePreferences } = await import('../src/models/RoommatePreferences.js'));
  ({ Connection } = await import('../src/models/Connection.js'));
  ({ Notification } = await import('../src/models/Notification.js'));
  const { connectDatabase } = await import('../src/config/database.js');
  await connectDatabase();
  const { app } = await import('../src/app.js');
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, { timeout: 180000 });

beforeEach(async () => {
  await User.deleteMany({});
  await RoommatePreferences.deleteMany({});
  await Connection.deleteMany({});
  await Notification.deleteMany({});
});

after(async () => {
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

async function createCompletedUser(name: string, email: string, city = 'Mumbai') {
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
    body: { profile: { city, occupation: 'Product Designer', bio: 'Calm and tidy living.' } },
  });

  await request('/preferences', {
    method: 'PUT',
    cookie,
    body: basePreferences,
  });

  return { cookie, user };
}

test('POST /api/connections/request/:userId sends a valid request with message and creates notification', async () => {
  const userA = await createCompletedUser('Alice Chen', 'alice@example.com');
  const userB = await createCompletedUser('Bob Miller', 'bob@example.com');

  const res = await request(`/connections/request/${userB.user.id}`, {
    method: 'POST',
    cookie: userA.cookie,
    body: { message: 'Hi Bob! I think our schedules and cleanliness standards align nicely.' },
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.connection.status, 'pending');
  assert.equal(data.connection.senderId, userA.user.id);
  assert.equal(data.connection.recipientId, userB.user.id);
  assert.equal(data.connection.isSender, true);
  assert.equal(data.connection.message, 'Hi Bob! I think our schedules and cleanliness standards align nicely.');

  // Notification was created for recipient Bob
  const notif = await Notification.findOne({ recipient: userB.user.id });
  assert.ok(notif);
  assert.equal(notif.type, 'connection_request');
  assert.equal(notif.actor.toString(), userA.user.id);
  assert.equal(notif.isRead, false);
});

test('POST /api/connections/request/:userId rejects sending a request to oneself', async () => {
  const userA = await createCompletedUser('Alice Self', 'aliceself@example.com');

  const res = await request(`/connections/request/${userA.user.id}`, {
    method: 'POST',
    cookie: userA.cookie,
    body: {},
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.error.message, /yourself/i);
});

test('POST /api/connections/request/:userId rejects nonexistent recipient', async () => {
  const userA = await createCompletedUser('Alice Solo', 'alicesolo@example.com');
  const fakeId = new mongoose.Types.ObjectId().toString();

  const res = await request(`/connections/request/${fakeId}`, {
    method: 'POST',
    cookie: userA.cookie,
    body: {},
  });

  assert.equal(res.status, 404);
});

test('POST /api/connections/request/:userId rejects duplicate pending requests', async () => {
  const userA = await createCompletedUser('Alice Dupe', 'alicedupe@example.com');
  const userB = await createCompletedUser('Bob Dupe', 'bobdupe@example.com');

  const res1 = await request(`/connections/request/${userB.user.id}`, {
    method: 'POST',
    cookie: userA.cookie,
    body: { message: 'First request' },
  });
  assert.equal(res1.status, 201);

  const res2 = await request(`/connections/request/${userB.user.id}`, {
    method: 'POST',
    cookie: userA.cookie,
    body: { message: 'Second request' },
  });
  assert.equal(res2.status, 409);
  const data = await res2.json();
  assert.match(data.error.message, /already sent/i);
});

test('POST /api/connections/request/:userId rejects reverse-direction pending request with informative message', async () => {
  const userA = await createCompletedUser('Alice Rev', 'alicerev@example.com');
  const userB = await createCompletedUser('Bob Rev', 'bobrev@example.com');

  // A sends to B
  const res1 = await request(`/connections/request/${userB.user.id}`, {
    method: 'POST',
    cookie: userA.cookie,
    body: {},
  });
  assert.equal(res1.status, 201);

  // B tries to send to A
  const res2 = await request(`/connections/request/${userA.user.id}`, {
    method: 'POST',
    cookie: userB.cookie,
    body: {},
  });
  assert.equal(res2.status, 409);
  const data = await res2.json();
  assert.match(data.error.message, /already sent you a connection request/i);
});

test('POST /api/connections/request/:userId rejects sending to an already accepted connection', async () => {
  const userA = await createCompletedUser('Alice Conn', 'aliceconn@example.com');
  const userB = await createCompletedUser('Bob Conn', 'bobconn@example.com');

  const sendRes = await request(`/connections/request/${userB.user.id}`, {
    method: 'POST',
    cookie: userA.cookie,
    body: {},
  });
  const connId = (await sendRes.json()).connection.id;

  // B accepts A's request
  const acceptRes = await request(`/connections/${connId}/accept`, {
    method: 'PATCH',
    cookie: userB.cookie,
    body: {},
  });
  assert.equal(acceptRes.status, 200);

  // A tries to request B again
  const retryA = await request(`/connections/request/${userB.user.id}`, {
    method: 'POST',
    cookie: userA.cookie,
    body: {},
  });
  assert.equal(retryA.status, 409);
  assert.match((await retryA.json()).error.message, /already connected/i);

  // B tries to request A again
  const retryB = await request(`/connections/request/${userA.user.id}`, {
    method: 'POST',
    cookie: userB.cookie,
    body: {},
  });
  assert.equal(retryB.status, 409);
  assert.match((await retryB.json()).error.message, /already connected/i);
});

test('PATCH /api/connections/:id/accept transitions pending to accepted and handles idempotency', async () => {
  const userA = await createCompletedUser('Alice Flow', 'aliceflow@example.com');
  const userB = await createCompletedUser('Bob Flow', 'bobflow@example.com');

  const sendRes = await request(`/connections/request/${userB.user.id}`, {
    method: 'POST',
    cookie: userA.cookie,
    body: {},
  });
  const connId = (await sendRes.json()).connection.id;

  // Recipient accepts
  const acceptRes1 = await request(`/connections/${connId}/accept`, {
    method: 'PATCH',
    cookie: userB.cookie,
    body: {},
  });
  assert.equal(acceptRes1.status, 200);
  const data1 = await acceptRes1.json();
  assert.equal(data1.connection.status, 'accepted');
  assert.ok(data1.connection.respondedAt);

  // Notification created for sender Alice
  const acceptNotif = await Notification.findOne({ recipient: userA.user.id, type: 'connection_accepted' });
  assert.ok(acceptNotif);

  // Repeated acceptance is idempotent
  const acceptRes2 = await request(`/connections/${connId}/accept`, {
    method: 'PATCH',
    cookie: userB.cookie,
    body: {},
  });
  assert.equal(acceptRes2.status, 200);
  const data2 = await acceptRes2.json();
  assert.equal(data2.connection.status, 'accepted');
});

test('PATCH /api/connections/:id/reject transitions pending to rejected and creates notification', async () => {
  const userA = await createCompletedUser('Alice Rej', 'alicerej@example.com');
  const userB = await createCompletedUser('Bob Rej', 'bobrej@example.com');

  const sendRes = await request(`/connections/request/${userB.user.id}`, {
    method: 'POST',
    cookie: userA.cookie,
    body: {},
  });
  const connId = (await sendRes.json()).connection.id;

  const rejRes = await request(`/connections/${connId}/reject`, {
    method: 'PATCH',
    cookie: userB.cookie,
    body: {},
  });
  assert.equal(rejRes.status, 200);
  const data = await rejRes.json();
  assert.equal(data.connection.status, 'rejected');

  const notif = await Notification.findOne({ recipient: userA.user.id, type: 'connection_rejected' });
  assert.ok(notif);
});

test('PATCH /api/connections/:id/cancel allows sender to cancel pending request', async () => {
  const userA = await createCompletedUser('Alice Can', 'alicecan@example.com');
  const userB = await createCompletedUser('Bob Can', 'bobcan@example.com');

  const sendRes = await request(`/connections/request/${userB.user.id}`, {
    method: 'POST',
    cookie: userA.cookie,
    body: {},
  });
  const connId = (await sendRes.json()).connection.id;

  const cancelRes = await request(`/connections/${connId}/cancel`, {
    method: 'PATCH',
    cookie: userA.cookie,
    body: {},
  });
  assert.equal(cancelRes.status, 200);
  const data = await cancelRes.json();
  assert.equal(data.connection.status, 'cancelled');
});

test('Invalid state transitions are rejected', async () => {
  const userA = await createCompletedUser('Alice St', 'alicest@example.com');
  const userB = await createCompletedUser('Bob St', 'bobst@example.com');

  // Cancelled request cannot be accepted
  const sendRes1 = await request(`/connections/request/${userB.user.id}`, {
    method: 'POST',
    cookie: userA.cookie,
    body: {},
  });
  const connId1 = (await sendRes1.json()).connection.id;
  await request(`/connections/${connId1}/cancel`, { method: 'PATCH', cookie: userA.cookie, body: {} });

  const acceptCancelled = await request(`/connections/${connId1}/accept`, {
    method: 'PATCH',
    cookie: userB.cookie,
    body: {},
  });
  assert.equal(acceptCancelled.status, 400);

  // Rejected request cannot be accepted
  const sendRes2 = await request(`/connections/request/${userB.user.id}`, {
    method: 'POST',
    cookie: userA.cookie,
    body: {},
  });
  const connId2 = (await sendRes2.json()).connection.id;
  await request(`/connections/${connId2}/reject`, { method: 'PATCH', cookie: userB.cookie, body: {} });

  const acceptRejected = await request(`/connections/${connId2}/accept`, {
    method: 'PATCH',
    cookie: userB.cookie,
    body: {},
  });
  assert.equal(acceptRejected.status, 400);

  // Accepted request cannot be cancelled
  const sendRes3 = await request(`/connections/request/${userB.user.id}`, {
    method: 'POST',
    cookie: userA.cookie,
    body: {},
  });
  const connId3 = (await sendRes3.json()).connection.id;
  await request(`/connections/${connId3}/accept`, { method: 'PATCH', cookie: userB.cookie, body: {} });

  const cancelAccepted = await request(`/connections/${connId3}/cancel`, {
    method: 'PATCH',
    cookie: userA.cookie,
    body: {},
  });
  assert.equal(cancelAccepted.status, 400);
});

test('Authorization checks: users cannot perform unauthorized actions', async () => {
  const userA = await createCompletedUser('Alice Auth', 'aliceauth@example.com');
  const userB = await createCompletedUser('Bob Auth', 'bobauth@example.com');
  const userC = await createCompletedUser('Charlie Stranger', 'charlieauth@example.com');

  const sendRes = await request(`/connections/request/${userB.user.id}`, {
    method: 'POST',
    cookie: userA.cookie,
    body: {},
  });
  const connId = (await sendRes.json()).connection.id;

  // Sender Alice cannot accept her own request
  const aAccept = await request(`/connections/${connId}/accept`, { method: 'PATCH', cookie: userA.cookie, body: {} });
  assert.equal(aAccept.status, 403);

  // Sender Alice cannot reject her own request
  const aReject = await request(`/connections/${connId}/reject`, { method: 'PATCH', cookie: userA.cookie, body: {} });
  assert.equal(aReject.status, 403);

  // Recipient Bob cannot cancel a request he received
  const bCancel = await request(`/connections/${connId}/cancel`, { method: 'PATCH', cookie: userB.cookie, body: {} });
  assert.equal(bCancel.status, 403);

  // Stranger Charlie cannot accept, reject, or cancel
  const cAccept = await request(`/connections/${connId}/accept`, { method: 'PATCH', cookie: userC.cookie, body: {} });
  assert.equal(cAccept.status, 403);

  const cCancel = await request(`/connections/${connId}/cancel`, { method: 'PATCH', cookie: userC.cookie, body: {} });
  assert.equal(cCancel.status, 403);

  // Stranger Charlie cannot view connection details (IDOR protection)
  const cView = await request(`/connections/${connId}`, { cookie: userC.cookie });
  assert.equal(cView.status, 403);
});

test('GET /api/connections/:id returns connection details with safe profile & shared lifestyle for participants', async () => {
  const userA = await createCompletedUser('Alice Det', 'alicedet@example.com');
  const userB = await createCompletedUser('Bob Det', 'bobdet@example.com');

  const sendRes = await request(`/connections/request/${userB.user.id}`, {
    method: 'POST',
    cookie: userA.cookie,
    body: { message: 'Looking forward to rooming!' },
  });
  const connId = (await sendRes.json()).connection.id;

  await request(`/connections/${connId}/accept`, { method: 'PATCH', cookie: userB.cookie, body: {} });

  const res = await request(`/connections/${connId}`, { cookie: userA.cookie });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.connection.status, 'accepted');
  assert.equal(data.connection.user.name, 'Bob Det');
  // Email and private fields not exposed
  assert.equal(data.connection.user.email, undefined);
  assert.equal(data.connection.user.passwordHash, undefined);
  assert.ok(data.connection.compatibility);
  assert.ok(Array.isArray(data.connection.sharedLifestyle));
});

test('Pagination works for received requests, sent requests, and connections', async () => {
  const userMain = await createCompletedUser('Main User', 'mainuser@example.com');
  const user1 = await createCompletedUser('User One', 'user1@example.com');
  const user2 = await createCompletedUser('User Two', 'user2@example.com');
  const user3 = await createCompletedUser('User Three', 'user3@example.com');

  // user1 and user2 send requests to userMain
  await request(`/connections/request/${userMain.user.id}`, { method: 'POST', cookie: user1.cookie, body: {} });
  await request(`/connections/request/${userMain.user.id}`, { method: 'POST', cookie: user2.cookie, body: {} });

  // userMain sends request to user3
  await request(`/connections/request/${user3.user.id}`, { method: 'POST', cookie: userMain.cookie, body: {} });

  // Test received pagination
  const recRes = await request('/connections/received?page=1&limit=1', { cookie: userMain.cookie });
  assert.equal(recRes.status, 200);
  const recData = await recRes.json();
  assert.equal(recData.requests.length, 1);
  assert.equal(recData.pagination.total, 2);
  assert.equal(recData.pagination.totalPages, 2);

  // Test sent pagination
  const sentRes = await request('/connections/sent?page=1&limit=10', { cookie: userMain.cookie });
  assert.equal(sentRes.status, 200);
  const sentData = await sentRes.json();
  assert.equal(sentData.requests.length, 1);
  assert.equal(sentData.requests[0].recipient.name, 'User Three');

  // userMain accepts user1's request
  const conn1 = await Connection.findOne({ sender: user1.user.id, recipient: userMain.user.id });
  await request(`/connections/${conn1!._id}/accept`, { method: 'PATCH', cookie: userMain.cookie, body: {} });

  // Test connections list
  const connRes = await request('/connections?page=1&limit=10', { cookie: userMain.cookie });
  assert.equal(connRes.status, 200);
  const connData = await connRes.json();
  assert.equal(connData.connections.length, 1);
  assert.equal(connData.connections[0].user.name, 'User One');
});

test('Notifications: list, unread count, mark as read, mark all read, and privacy', async () => {
  const userA = await createCompletedUser('Alice Notif', 'alicenotif@example.com');
  const userB = await createCompletedUser('Bob Notif', 'bobnotif@example.com');

  // A requests B -> B gets notification
  await request(`/connections/request/${userB.user.id}`, { method: 'POST', cookie: userA.cookie, body: {} });

  // B views notifications
  const notifRes1 = await request('/notifications', { cookie: userB.cookie });
  assert.equal(notifRes1.status, 200);
  const notifData1 = await notifRes1.json();
  assert.equal(notifData1.unreadCount, 1);
  assert.equal(notifData1.notifications.length, 1);
  const notifId = notifData1.notifications[0].id;
  assert.equal(notifData1.notifications[0].actor.name, 'Alice Notif');
  // Email not exposed in actor profile
  assert.equal(notifData1.notifications[0].actor.email, undefined);

  // User A cannot read User B's notification
  const badRead = await request(`/notifications/${notifId}/read`, { method: 'PATCH', cookie: userA.cookie, body: {} });
  assert.equal(badRead.status, 404);

  // User B marks notification as read
  const markRes = await request(`/notifications/${notifId}/read`, { method: 'PATCH', cookie: userB.cookie, body: {} });
  assert.equal(markRes.status, 200);
  const markData = await markRes.json();
  assert.equal(markData.unreadCount, 0);

  // Mark all as read
  const markAllRes = await request('/notifications/read-all', { method: 'PATCH', cookie: userB.cookie, body: {} });
  assert.equal(markAllRes.status, 200);
  assert.equal((await markAllRes.json()).unreadCount, 0);
});

test('GET /api/connections/summary returns real database counts and recent activity', async () => {
  const userMain = await createCompletedUser('Summary Main', 'summain@example.com');
  const userA = await createCompletedUser('Summary A', 'suma@example.com');
  const userB = await createCompletedUser('Summary B', 'sumb@example.com');
  const userC = await createCompletedUser('Summary C', 'sumc@example.com');

  // userA -> userMain (incoming pending)
  await request(`/connections/request/${userMain.user.id}`, { method: 'POST', cookie: userA.cookie, body: {} });

  // userMain -> userB (outgoing pending)
  await request(`/connections/request/${userB.user.id}`, { method: 'POST', cookie: userMain.cookie, body: {} });

  // userMain <-> userC (accepted)
  const cRes = await request(`/connections/request/${userC.user.id}`, { method: 'POST', cookie: userMain.cookie, body: {} });
  const cId = (await cRes.json()).connection.id;
  await request(`/connections/${cId}/accept`, { method: 'PATCH', cookie: userC.cookie, body: {} });

  const summaryRes = await request('/connections/summary', { cookie: userMain.cookie });
  assert.equal(summaryRes.status, 200);
  const summary = await summaryRes.json();

  assert.equal(summary.incomingPendingCount, 1);
  assert.equal(summary.outgoingPendingCount, 1);
  assert.equal(summary.acceptedCount, 1);
  assert.ok(summary.recentActivity.length >= 3);
});

test('Candidate discovery & match details annotate real-time connection status', async () => {
  const userA = await createCompletedUser('Alice Match', 'alicematch@example.com');
  const userB = await createCompletedUser('Bob Match', 'bobmatch@example.com');

  // Before request: connection is null
  const discRes1 = await request('/matches', { cookie: userA.cookie });
  assert.equal(discRes1.status, 200);
  const discData1 = await discRes1.json();
  const matchB1 = discData1.matches.find((m: any) => m.candidate.id === userB.user.id);
  assert.ok(matchB1);
  assert.equal(matchB1.connection, null);

  // A requests B
  await request(`/connections/request/${userB.user.id}`, { method: 'POST', cookie: userA.cookie, body: {} });

  // Now discovery for A shows connection pending (direction sent)
  const discRes2 = await request('/matches', { cookie: userA.cookie });
  const discData2 = await discRes2.json();
  const matchB2 = discData2.matches.find((m: any) => m.candidate.id === userB.user.id);
  assert.ok(matchB2.connection);
  assert.equal(matchB2.connection.status, 'pending');
  assert.equal(matchB2.connection.direction, 'sent');

  // Discovery for B shows connection pending (direction received)
  const discResB = await request('/matches', { cookie: userB.cookie });
  const discDataB = await discResB.json();
  const matchA = discDataB.matches.find((m: any) => m.candidate.id === userA.user.id);
  assert.ok(matchA.connection);
  assert.equal(matchA.connection.status, 'pending');
  assert.equal(matchA.connection.direction, 'received');

  // Match detail for user A also has connection status
  const detailRes = await request(`/matches/${userB.user.id}`, { cookie: userA.cookie });
  assert.equal(detailRes.status, 200);
  const detailData = await detailRes.json();
  assert.ok(detailData.connection);
  assert.equal(detailData.connection.status, 'pending');
  assert.equal(detailData.connection.direction, 'sent');
});

