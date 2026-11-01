// Run: PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node --import tsx server/test/browserRealtime.mjs
// Uses isolated browser contexts and a disposable MongoDB; never connects to Atlas.
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.COOKIE_SAME_SITE = 'lax';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.REALTIME_DEBUG = 'false';

let database, server, vite, io, browser;
const check = async (predicate, label) => {
  const deadline = Date.now() + 15000;
  while (!(await predicate())) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${label}`);
    await delay(50);
  }
};

try {
  database = await MongoMemoryServer.create({ binary: { version: '8.0.17', downloadDir: join(tmpdir(), 'roomiematch-mongodb') } });
  process.env.MONGODB_URI = database.getUri('browser_realtime');
  await mongoose.connect(process.env.MONGODB_URI);
  const { User } = await import('../src/models/User.ts');
  const { Connection } = await import('../src/models/Connection.ts');
  const { Conversation } = await import('../src/models/Conversation.ts');
  const { Message } = await import('../src/models/Message.ts');
  const users = await User.create(['Sender', 'Recipient', 'Outsider'].map((name, i) => ({
    name, email: `realtime-${i}@example.test`, passwordHash: 'unused-test-fixture',
  })));
  const connection = await Connection.create({ sender: users[0]._id, recipient: users[1]._id,
    status: 'accepted', pairKey: [users[0].id, users[1].id].sort().join(':') });
  const conversation = await Conversation.create({ connection: connection._id, participants: [users[0]._id, users[1]._id] });
  await Message.init();
  const { app } = await import('../src/app.ts');
  const { initSocketServer } = await import('../src/realtime/socketServer.ts');
  server = http.createServer(app);
  io = initSocketServer(server);
  await new Promise(resolve => server.listen(0, resolve));
  const backend = `http://localhost:${server.address().port}`;
  process.env.VITE_SOCKET_URL = backend;
  process.env.VITE_API_BASE_URL = '/api';
  process.env.VITE_REALTIME_DEBUG = 'true';
  vite = await createServer({ root: resolve('client'), configFile: false, plugins: [react(), tailwindcss()],
    server: { host: '0.0.0.0', port: 5279, strictPort: false, proxy: { '/api': backend } } });
  await vite.listen();
  const port = vite.httpServer.address().port;
  const frontend = `http://127.0.0.1:${port}`;
  const { env } = await import('../src/config/env.ts');
  env.clientOrigins.push(frontend);
  const { jwtOptions } = await import('../src/services/authService.ts');
  const room = `conversation:${conversation.id}`;
  let tokens = users.map(user => jwt.sign({}, process.env.JWT_SECRET, { ...jwtOptions, subject: user.id, expiresIn: 3600 }));
  for (const base of [backend, `http://127.0.0.1:${port}`]) {
    const result = await fetch(`${base}/api/auth/me`, { headers: { Cookie: `roomiematch_session=${tokens[0]}` } });
    assert.equal(result.status, 200, `fixture REST session at ${base}: ${await result.text()}`);
  }
  const cookie = (user, host) => ({ name: 'roomiematch_session', value: tokens[user], domain: host,
    path: '/', httpOnly: true, secure: false, sameSite: 'Lax' });

  for (const [name, executablePath] of [
    ['Chrome', process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
    ['Brave', process.env.BRAVE_PATH || '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'],
  ]) {
    browser = await chromium.launch({ executablePath, headless: true });
    // New independent sessions per browser; logout of Chrome must not revoke Brave's fixture.
    tokens = users.map(user => jwt.sign({}, process.env.JWT_SECRET, { ...jwtOptions, subject: user.id,
      jwtid: randomBytes(16).toString('hex'), expiresIn: 3600 }));
    const contexts = await Promise.all(users.map(() => browser.newContext()));
    await Promise.all(contexts.map((context, i) => context.addCookies([cookie(i, '127.0.0.1')])));
    const [sender, recipient, outsider] = await Promise.all(contexts.map(context => context.newPage()));
    const senderTab = await contexts[0].newPage();
    const recipientPackets = [];
    const ticketHashes = [];
    const pageErrors = [];
    let recipientIssuances = 0;
    const { SocketTicket } = await import('../src/models/SocketTicket.ts');
    const { hashTicket } = await import('../src/services/socketTicketService.ts');
    // Force an expired ticket on the first attempt to verify a fresh namespace retry.
    await recipient.route('**/api/auth/socket-ticket', async route => {
      const response = await route.fetch();
      if (response.status() === 200) {
        const data = await response.json();
        if (++recipientIssuances === 1) {
          await SocketTicket.updateOne({ _id: hashTicket(data.ticket) }, { $set: { expiresAt: new Date(0) } });
        }
      }
      await route.fulfill({ response });
    });
    for (const page of [sender, recipient, senderTab, outsider]) {
      page.on('pageerror', error => pageErrors.push(error.message));
      page.on('websocket', ws => {
        if (!ws.url().includes('/socket.io/')) return;
        assert(!new URL(ws.url()).searchParams.has('ticket'));
        if (page === recipient) ws.on('framereceived', ({ payload }) => recipientPackets.push(String(payload).slice(0, 2)));
        ws.on('framesent', ({ payload }) => {
          const text = String(payload);
          if (text.startsWith('40')) {
            const data = JSON.parse(text.slice(2));
            if (data.ticket) ticketHashes.push(hashTicket(data.ticket));
            assert(!Object.keys(data).some(key => /jwt|token|userId/i.test(key)));
          }
        });
      });
    }
    await Promise.all([sender, recipient, senderTab, outsider].map(page => page.goto(`${frontend}/messages/${conversation.id}`)));
    await check(() => io.sockets.adapter.rooms.get(room)?.size === 3, 'three authorized sockets joined');
    const rejection = await outsider.evaluate(async conversationId => {
      const { getSocket } = await import('/src/services/socket.ts');
      const socket = getSocket();
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('No room rejection')), 5000);
        socket.once('conversation:error', payload => { clearTimeout(timeout); resolve(payload.error); });
        socket.emit('conversation:join', { conversationId });
      });
    }, conversation.id);
    assert.equal(rejection, 'You are not a participant in this conversation.');
    assert(recipientPackets.some(p => p.startsWith('0')));
    assert(recipientPackets.includes('40'));
    assert(recipientPackets.includes('44'));
    assert(recipientIssuances >= 2);
    assert.equal(await sender.evaluate(async () => (await fetch('/api/auth/me')).status), 200);
    for (const context of contexts) assert.equal((await context.cookies(backend)).length, 0, 'No Render-equivalent cookie');
    for (const page of [sender, recipient, senderTab]) {
      await page.locator('textarea').waitFor();
      await check(async () => !(await page.locator('.reconnect-banner').count()), 'namespace connected UI');
    }
    // Wait for REST history loading before sending; tests the mounted recipient UI.
    await check(async () => !(await recipient.locator('.chat-messages-loading').count()), 'recipient history ready');
    const content = `${name} local realtime fixture`;
    await sender.locator('textarea').fill(content);
    await sender.locator('textarea').press('Enter');
    for (const page of [sender, recipient, senderTab]) {
      await check(async () => await page.locator('.message-content').filter({ hasText: content }).count() === 1, 'exactly one live message per tab');
    }
    assert.equal(await Message.countDocuments({ conversation: conversation.id, content }), 1);

    const retryContent = `${name} idempotency fixture`;
    await sender.evaluate(async ({ conversationId, content }) => {
      const { getSocket } = await import('/src/services/socket.ts');
      const payload = { conversationId, content, idempotencyKey: `${content}-key` };
      getSocket().emit('message:send', payload);
      getSocket().emit('message:send', payload);
    }, { conversationId: conversation.id, content: retryContent });
    await check(async () => await recipient.locator('.message-content').filter({ hasText: retryContent }).count() === 1, 'deduplicated recipient UI');
    assert.equal(await Message.countDocuments({ conversation: conversation.id, content: retryContent }), 1);

    const attemptsBeforeReconnect = ticketHashes.length;
    const oldIds = [...io.sockets.adapter.rooms.get(room)];
    for (const id of oldIds) {
      const socket = io.sockets.sockets.get(id);
      if (socket.data.userId === users[0].id) socket.conn.close();
    }
    await check(() => {
      const ids = [...(io.sockets.adapter.rooms.get(room) || [])];
      return ids.length === 3 && ids.filter(id => !oldIds.includes(id)).length === 2;
    }, 'sender tabs reconnect and rejoin');
    const reply = `${name} reply after reconnect`;
    await recipient.locator('textarea').fill(reply);
    await recipient.locator('textarea').press('Enter');
    for (const page of [sender, senderTab]) {
      await check(async () => await page.locator('.message-content').filter({ hasText: reply }).count() === 1, 'live reply after reconnect');
    }
    assert(ticketHashes.length >= attemptsBeforeReconnect + 2);
    assert.equal(new Set(ticketHashes).size, ticketHashes.length, 'Never reuse a ticket across attempts/tabs');
    await sender.getByRole('button', { name: 'Log out' }).click();
    await check(() => ![...io.sockets.sockets.values()].some(socket => socket.data.userId === users[0].id), 'logout disconnects both sender tabs');
    await check(() => sender.url().includes('/login') && senderTab.url().includes('/login'), 'logout reflected across tabs');
    assert.equal(await recipient.evaluate(async () => (await fetch('/api/auth/me')).status), 200);
    assert.deepEqual(pageErrors, []);
    console.log(`${name}: PASS cross-host ticket auth with REST-only cookie, expired-ticket retry, two-user live UI delivery, room authorization, deduplication, fresh-ticket reconnect, multiple tabs and logout`);
    await browser.close();
    browser = undefined;
  }
} finally {
  await browser?.close();
  await vite?.close();
  if (io) await new Promise(resolve => io.close(resolve));
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  await database?.stop();
}
