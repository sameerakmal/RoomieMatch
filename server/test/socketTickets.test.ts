import assert from 'node:assert/strict';
import { before, after, beforeEach, afterEach, test } from 'node:test';
import { randomBytes } from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import { io as client, type Socket } from 'socket.io-client';
import type { Server } from 'socket.io';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.CLIENT_ORIGIN = 'http://localhost:5173,http://localhost:5174';
process.env.COOKIE_SAME_SITE = 'lax';
const origin = 'http://localhost:5173';
let db: MongoMemoryServer, server: http.Server, io: Server, base: string;
let User: typeof import('../src/models/User.js').User;
let Ticket: typeof import('../src/models/SocketTicket.js').SocketTicket;
let Revoked: typeof import('../src/models/RevokedSession.js').RevokedSession;
let service: typeof import('../src/services/socketTicketService.js');
let security: typeof import('../src/middleware/requestSecurity.js');
let auth: typeof import('../src/services/authService.js');
const sockets: Socket[] = [];

async function start() {
  const { app } = await import('../src/app.js');
  const { initSocketServer } = await import('../src/realtime/socketServer.js');
  server = http.createServer(app); io = initSocketServer(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
before(async () => {
  db = await MongoMemoryServer.create({ binary: { version: '8.0.17', downloadDir: join(tmpdir(), 'roomiematch-mongodb') } });
  process.env.MONGODB_URI = db.getUri('socket_tickets');
  ({ User } = await import('../src/models/User.js'));
  ({ SocketTicket: Ticket } = await import('../src/models/SocketTicket.js'));
  ({ RevokedSession: Revoked } = await import('../src/models/RevokedSession.js'));
  service = await import('../src/services/socketTicketService.js');
  security = await import('../src/middleware/requestSecurity.js');
  auth = await import('../src/services/authService.js');
  await (await import('../src/config/database.js')).connectDatabase();
  await start();
}, { timeout: 180000 });
beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Ticket.deleteMany({}), Revoked.deleteMany({})]);
  security.socketTicketIpLimit.resetKey('127.0.0.1');
});
afterEach(() => { for (const socket of sockets.splice(0)) socket.disconnect(); });
after(async () => {
  if (io) await new Promise<void>(resolve => io.close(() => resolve()));
  await mongoose.disconnect(); await db?.stop();
});

async function account(expiresIn = 3600) {
  const user = await User.create({ name: 'Ticket User', email: `${randomBytes(6).toString('hex')}@example.test`, passwordHash: 'unused-fixture' });
  const token = jwt.sign({}, process.env.JWT_SECRET!, { ...auth.jwtOptions, subject: user.id, jwtid: randomBytes(16).toString('hex'), expiresIn });
  return { user, token, cookie: `roomiematch_session=${token}` };
}
async function request(path: string, cookie?: string, headers = {}, method = 'POST') {
  return fetch(`${base}/api/auth${path}`, { method,
    headers: { 'Content-Type': 'application/json', 'X-RoomieMatch-Request': 'web', Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...headers },
    ...(method === 'POST' ? { body: '{}' } : {}),
  });
}
async function issue(cookie: string) {
  const response = await request('/socket-ticket', cookie);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  return (await response.json()) as { ticket: string; expiresAt: string };
}
function event(socket: Socket, name: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(name, done); reject(new Error(`Timed out: ${name}`)); }, 5000);
    function done(payload: unknown) { clearTimeout(timer); resolve(payload); }
    socket.once(name, done);
  });
}
function socketFor(authPayload: Record<string, unknown>, socketOrigin = origin) {
  const socket = client(base, { auth: authPayload, extraHeaders: { Origin: socketOrigin }, transports: ['websocket'], reconnection: false, autoConnect: false });
  sockets.push(socket); return socket;
}
async function connect(ticket: string) {
  const socket = socketFor({ ticket }); const connected = event(socket, 'connect'); socket.connect(); await connected; return socket;
}
async function rejectTicket(payload: Record<string, unknown>, socketOrigin = origin) {
  const socket = socketFor(payload, socketOrigin); const rejected = event(socket, 'connect_error'); socket.connect();
  const error = await rejected; assert.equal(socket.connected, false); socket.disconnect(); return error;
}

test('valid ticket: authenticated REST issues only an opaque ticket; Mongo stores only its hash and bound session/user', async () => {
  const { cookie, token, user } = await account(); const issued = await issue(cookie);
  assert.match(issued.ticket, /^[A-Za-z0-9_-]{43}$/);
  assert(!JSON.stringify(issued).includes(token));
  const stored = await Ticket.findById(service.hashTicket(issued.ticket));
  assert(stored); assert.equal(stored.userId.toString(), user.id);
  assert(!JSON.stringify(stored).includes(issued.ticket)); assert(!JSON.stringify(stored).includes(token));
  assert(new Date(issued.expiresAt).getTime() <= Date.now() + 30_000);
  const socket = await connect(issued.ticket);
  assert.equal(io.sockets.sockets.get(socket.id!)?.data.userId, user.id);
  assert.equal(await Ticket.countDocuments(), 0);
});
test('missing, malformed, random, query-only and replayed tickets are rejected; cookies are not a socket fallback', async () => {
  const { cookie } = await account(); const { ticket } = await issue(cookie);
  for (const payload of [{}, { ticket: 'bad' }, { ticket: randomBytes(32).toString('base64url') }]) {
    assert.equal((await rejectTicket(payload)).data.code, 'SOCKET_TICKET_INVALID');
  }
  const queryOnly = socketFor({}); queryOnly.io.opts.query = { ticket }; queryOnly.io.opts.extraHeaders = { Origin: origin, Cookie: cookie };
  const error = event(queryOnly, 'connect_error'); queryOnly.connect(); assert.equal((await error).data.code, 'SOCKET_TICKET_INVALID'); queryOnly.disconnect();
  await connect(ticket);
  assert.equal((await rejectTicket({ ticket })).data.code, 'SOCKET_TICKET_INVALID');
});
test('expired ticket is rejected even before Mongo TTL cleanup; issuance is capped at session expiry', async () => {
  const { cookie, token } = await account(20); const { ticket, expiresAt } = await issue(cookie);
  assert(new Date(expiresAt).getTime() <= auth.verifyAuthSession(token).expiresAt.getTime());
  await Ticket.updateOne({ _id: service.hashTicket(ticket) }, { $set: { expiresAt: new Date(Date.now() - 1) } });
  assert.equal((await rejectTicket({ ticket })).data.code, 'SOCKET_TICKET_INVALID');
});
test('atomic consumption allows exactly one concurrent caller', async () => {
  const { cookie } = await account(); const { ticket } = await issue(cookie);
  const results = await Promise.all(Array.from({ length: 16 }, () => service.consumeSocketTicket(ticket, origin)));
  assert.equal(results.filter(Boolean).length, 1);
});
test('ticket is origin-bound; disallowed and wrong allowed origins cannot consume it', async () => {
  const { cookie } = await account(); const { ticket } = await issue(cookie);
  assert.equal((await rejectTicket({ ticket }, 'https://attacker.example')).data.code, 'SOCKET_ORIGIN_INVALID');
  assert.equal((await rejectTicket({ ticket }, 'http://localhost:5174')).data.code, 'SOCKET_TICKET_INVALID');
  await connect(ticket);
});
test('another user\'s ticket never authenticates a claimed user ID or grants their conversation access', async () => {
  const a = await account(), b = await account(), c = await account();
  const { Connection } = await import('../src/models/Connection.js');
  const { Conversation } = await import('../src/models/Conversation.js');
  const connection = await Connection.create({ sender: a.user._id, recipient: c.user._id, status: 'accepted', pairKey: [a.user.id, c.user.id].sort().join(':') });
  const conversation = await Conversation.create({ participants: [a.user._id, c.user._id], connection: connection._id });
  const { ticket } = await issue(b.cookie);
  const socket = socketFor({ ticket, userId: a.user.id }); const connected = event(socket, 'connect'); socket.connect(); await connected;
  assert.equal(io.sockets.sockets.get(socket.id!)?.data.userId, b.user.id);
  const rejected = event(socket, 'conversation:error'); socket.emit('conversation:join', { conversationId: conversation.id });
  assert.match((await rejected).error, /not a participant/);
  assert.equal(io.sockets.adapter.rooms.get(`conversation:${conversation.id}`)?.has(socket.id!), undefined);
});
test('fresh ticket reconnects and multiple tabs receive independent single-use tickets', async () => {
  const { cookie } = await account(); const first = await issue(cookie), second = await issue(cookie);
  assert.notEqual(first.ticket, second.ticket);
  const a = await connect(first.ticket), b = await connect(second.ticket);
  assert.notEqual(a.id, b.id);
  const oldId = a.id; a.disconnect();
  a.auth = { ticket: (await issue(cookie)).ticket };
  const connected = event(a, 'connect'); a.connect(); await connected; assert.notEqual(a.id, oldId);
});
test('logout revokes REST session, unspent tickets, and all its socket tabs; another session stays valid', async () => {
  const a = await account(), b = await account();
  const tab1 = await connect((await issue(a.cookie)).ticket), tab2 = await connect((await issue(a.cookie)).ticket);
  const other = await connect((await issue(b.cookie)).ticket);
  const outstanding = await issue(a.cookie);
  const disconnected = [event(tab1, 'disconnect'), event(tab2, 'disconnect')];
  assert.equal((await request('/logout', a.cookie)).status, 200); await Promise.all(disconnected);
  assert.equal((await request('/me', a.cookie, {}, 'GET')).status, 401);
  assert.equal((await request('/socket-ticket', a.cookie)).status, 401);
  assert.equal((await rejectTicket({ ticket: outstanding.ticket })).data.code, 'SOCKET_TICKET_INVALID');
  assert.equal(other.connected, true); assert.equal((await request('/me', b.cookie, {}, 'GET')).status, 200);
});
test('expired session cannot issue tickets, and live sockets disconnect at session expiry', async () => {
  const expired = await account(-1); assert.equal((await request('/socket-ticket', expired.cookie)).status, 401);
  const short = await account(2); const socket = await connect((await issue(short.cookie)).ticket);
  await event(socket, 'disconnect'); assert.equal((await request('/socket-ticket', short.cookie)).status, 401);
});
test('issuance requires verified JSON POST and trusted Origin, and is rate-limited per user', async () => {
  const { cookie } = await account();
  assert.equal((await request('/socket-ticket')).status, 401);
  assert.equal((await request('/socket-ticket', cookie, { 'X-RoomieMatch-Request': '' })).status, 403);
  assert.equal((await request('/socket-ticket', cookie, { Origin: 'https://attacker.example' })).status, 403);
  for (let i = 0; i < 30; i++) assert.equal((await request('/socket-ticket', cookie)).status, 200);
  assert.equal((await request('/socket-ticket', cookie)).status, 429);
});
test('tickets and revocations survive a Socket.IO server instance restart', async () => {
  const active = await account(), revoked = await account();
  const unused = await issue(active.cookie), consumed = await issue(active.cookie);
  await connect(consumed.ticket); await request('/logout', revoked.cookie);
  await new Promise<void>(resolve => io.close(() => resolve())); await start();
  await connect(unused.ticket);
  assert.equal((await rejectTicket({ ticket: consumed.ticket })).data.code, 'SOCKET_TICKET_INVALID');
  assert.equal((await request('/socket-ticket', revoked.cookie)).status, 401);
});
