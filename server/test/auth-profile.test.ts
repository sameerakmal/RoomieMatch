import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
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
let authRateLimit: typeof import('../src/middleware/requestSecurity.js').authRateLimit;
const credentials = { name: 'Test Roomie', email: 'roomie@example.com', password: 'Test-only-password-42' };

before(async () => {
  // This is an actual mongod process, isolated from any developer/Atlas database.
  database = await MongoMemoryServer.create({ binary: { version: '8.0.17', downloadDir: join(tmpdir(), 'roomiematch-mongodb') } });
  process.env.MONGODB_URI = database.getUri('roomiematch_test');
  ({ User } = await import('../src/models/User.js'));
  const { connectDatabase } = await import('../src/config/database.js');
  await connectDatabase();
  const { app } = await import('../src/app.js');
  ({ authRateLimit } = await import('../src/middleware/requestSecurity.js'));
  await new Promise<void>(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, { timeout: 180000 });
beforeEach(async () => { await User.deleteMany({}); authRateLimit.resetKey('127.0.0.1'); });
after(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await mongoose.disconnect();
  if (database) await database.stop();
});

async function request(path: string, options: { method?: string; body?: unknown; cookie?: string; headers?: Record<string, string> } = {}) {
  return fetch(`${baseUrl}/api${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json', 'X-RoomieMatch-Request': 'web', Origin: 'http://localhost:5173',
      ...(options.cookie ? { Cookie: options.cookie } : {}), ...options.headers,
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
}
async function account(overrides = {}) {
  const response = await request('/auth/register', { method: 'POST', body: { ...credentials, ...overrides } });
  assert.equal(response.status, 201);
  return { cookie: response.headers.get('set-cookie')!.split(';')[0], user: (await response.json()).user };
}
function assertPublic(body: unknown) {
  const serialized = JSON.stringify(body);
  assert.ok(!serialized.includes('passwordHash'));
  assert.ok(!serialized.includes(credentials.password));
  assert.ok(!serialized.includes('token'));
  assert.ok(!serialized.includes(process.env.JWT_SECRET!));
}

test('registration persists a normalized account, bcrypt hash, and HttpOnly JWT cookie', async () => {
  const response = await request('/auth/register', { method: 'POST', body: { ...credentials, name: '  Test Roomie  ', email: '  ROOMIE@Example.COM ' } });
  assert.equal(response.status, 201);
  const { user } = await response.json();
  assert.equal(user.name, 'Test Roomie');
  assert.equal(user.email, 'roomie@example.com');
  assert.equal(user.profile.city, '');
  assert.equal(user.profile.age, null);
  assertPublic(user);
  const stored = await User.findById(user.id).select('+passwordHash');
  assert.ok(stored);
  assert.notEqual(stored.passwordHash, credentials.password);
  assert.equal(bcrypt.getRounds(stored.passwordHash), 12);
  assert.ok(await bcrypt.compare(credentials.password, stored.passwordHash));
  assert.equal((await User.findById(user.id))?.passwordHash, undefined);
  const cookie = response.headers.get('set-cookie')!;
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /Max-Age=3600/);
  assert.doesNotMatch(cookie, /; Secure/);
  const token = cookie.split(';')[0].split('=')[1];
  const claims = jwt.verify(token, process.env.JWT_SECRET!, { algorithms: ['HS256'], issuer: 'roomiematch-api', audience: 'roomiematch-client' });
  assert.equal(typeof claims === 'object' && claims.sub, user.id);
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('normalized duplicate emails return 409', async () => {
  await account();
  const response = await request('/auth/register', { method: 'POST', body: { ...credentials, email: ' ROOMIE@EXAMPLE.COM ' } });
  assert.equal(response.status, 409);
  assert.equal(await User.countDocuments(), 1);
});
test('concurrent duplicate registration is protected by the unique database index', async () => {
  const responses = await Promise.all([0, 1].map(() => request('/auth/register', { method: 'POST', body: credentials })));
  assert.deepEqual(responses.map(response => response.status).sort(), [201, 409]);
  assert.equal(await User.countDocuments(), 1);
});
test('invalid registration data is rejected without creating accounts', async () => {
  const invalidBodies = [
    {}, null, [], { ...credentials, name: ' ' }, { ...credentials, email: 'invalid' },
    { ...credentials, password: 'short' }, { ...credentials, password: '🙂'.repeat(19) },
    { ...credentials, email: { $ne: null } }, { ...credentials, role: 'admin' },
  ];
  for (const body of invalidBodies) {
    const response = await request('/auth/register', { method: 'POST', body });
    assert.equal(response.status, 400);
    assertPublic(await response.json());
  }
  assert.equal(await User.countDocuments(), 0);
});
test('login accepts normalized credentials and sets a session cookie', async () => {
  await account();
  const response = await request('/auth/login', { method: 'POST', body: { email: ' ROOMIE@EXAMPLE.COM ', password: credentials.password } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie')!, /HttpOnly/);
  assertPublic(await response.json());
});
test('incorrect password and unknown email return the same generic credentials error', async () => {
  await account();
  const wrong = await request('/auth/login', { method: 'POST', body: { email: credentials.email, password: 'wrong-password' } });
  const unknown = await request('/auth/login', { method: 'POST', body: { email: 'missing@example.com', password: credentials.password } });
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.deepEqual(await wrong.json(), await unknown.json());
  assert.equal(wrong.headers.get('set-cookie'), null);
});
test('missing authentication rejects me, profile retrieval, and profile edits', async () => {
  for (const [path, method] of [['/auth/me', 'GET'], ['/profile', 'GET'], ['/profile', 'PATCH']]) {
    const response = await request(path, { method, ...(method === 'PATCH' ? { body: { name: 'Someone' } } : {}) });
    assert.equal(response.status, 401);
  }
});
test('me restores an authenticated user from the cookie without exposing credentials', async () => {
  const { cookie, user } = await account();
  const response = await request('/auth/me', { cookie });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.user.id, user.id);
  assertPublic(body);
});
test('tampered, expired and incorrectly signed JWTs cannot authenticate', async () => {
  const { user } = await account();
  const options = { subject: user.id, issuer: 'roomiematch-api', audience: 'roomiematch-client' };
  for (const token of ['not-a-jwt', jwt.sign({}, process.env.JWT_SECRET!, { ...options, expiresIn: -1 }), jwt.sign({}, randomBytes(32).toString('hex'), { ...options, expiresIn: 60 })]) {
    const response = await request('/auth/me', { cookie: `roomiematch_session=${token}` });
    assert.equal(response.status, 401);
    assert.match(response.headers.get('set-cookie')!, /Expires=Thu, 01 Jan 1970/);
  }
});
test('a deleted account can no longer use its valid JWT', async () => {
  const { cookie, user } = await account();
  await User.deleteOne({ _id: user.id });
  assert.equal((await request('/auth/me', { cookie })).status, 401);
});
test('profile retrieval returns only the authenticated account', async () => {
  const first = await account();
  const second = await account({ email: 'second@example.com', name: 'Second Roomie' });
  const response = await request('/profile', { cookie: first.cookie });
  assert.equal(response.status, 200);
  const { user } = await response.json();
  assert.equal(user.id, first.user.id);
  assert.notEqual(user.id, second.user.id);
  assertPublic(user);
});
test('profile updates persist all editable fields and survive a new request', async () => {
  const { cookie, user } = await account();
  const profile = { city: '  Bengaluru  ', occupation: ' Designer ', age: 27, moveInDate: '2027-01-15', bio: 'Quiet mornings and good coffee.', profilePhotoUrl: 'https://example.com/photo.jpg' };
  const response = await request('/profile', { method: 'PATCH', cookie, body: { name: 'Updated Roomie', profile } });
  assert.equal(response.status, 200);
  const saved = (await response.json()).user;
  assert.equal(saved.name, 'Updated Roomie');
  assert.equal(saved.profile.city, 'Bengaluru');
  assert.equal(saved.profile.occupation, 'Designer');
  assert.equal(saved.profile.moveInDate, '2027-01-15');
  assert.equal(saved.profile.age, 27);
  assert.equal(saved.profile.bio, profile.bio);
  assert.equal(saved.profile.profilePhotoUrl, profile.profilePhotoUrl);
  assertPublic(saved);
  assert.equal((await User.findById(user.id))?.profile.city, 'Bengaluru');
  const restored = await request('/profile', { cookie });
  assert.deepEqual((await restored.json()).user, saved);
});
test('partial edits preserve other fields and optional details can be cleared', async () => {
  const { cookie } = await account();
  await request('/profile', { method: 'PATCH', cookie, body: { profile: { city: 'Pune', age: 25, moveInDate: '2027-04-10' } } });
  const partial = await request('/profile', { method: 'PATCH', cookie, body: { profile: { occupation: 'Writer' } } });
  assert.equal((await partial.json()).user.profile.city, 'Pune');
  const cleared = await request('/profile', { method: 'PATCH', cookie, body: { profile: { city: '', age: null, moveInDate: null } } });
  assert.equal(cleared.status, 200);
  const { profile } = (await cleared.json()).user;
  assert.equal(profile.city, '');
  assert.equal(profile.age, null);
  assert.equal(profile.moveInDate, null);
  assert.equal(profile.occupation, 'Writer');
});
test('protected fields, nested privilege fields and database operators are rejected atomically', async () => {
  const { cookie, user } = await account();
  const protectedBodies = [
    { email: 'stolen@example.com' }, { passwordHash: 'replacement' }, { password: 'replacement' },
    { role: 'admin' }, { permissions: ['admin'] }, { _id: new mongoose.Types.ObjectId().toString() },
    { $set: { email: 'stolen@example.com' } }, { 'profile.city': 'Unexpected' },
    { profile: { city: 'Unexpected', role: 'admin' } }, { profile: { city: { $ne: null } } },
  ];
  for (const body of protectedBodies) assert.equal((await request('/profile', { method: 'PATCH', cookie, body })).status, 400);
  const stored = await User.findById(user.id).select('+passwordHash');
  assert.equal(stored?.email, credentials.email);
  assert.equal(stored?.profile.city, '');
  assert.ok(await bcrypt.compare(credentials.password, stored!.passwordHash));
});
test('invalid profile values reject unsafe URLs, invalid dates and out-of-range ages', async () => {
  const { cookie } = await account();
  for (const profile of [{ age: 17 }, { age: 121 }, { age: 24.5 }, { age: '24' }, { bio: 'x'.repeat(501) }, { moveInDate: '2027-02-30' }, { profilePhotoUrl: 'javascript:alert(1)' }, { profilePhotoUrl: 'https://user:password@example.com/photo.jpg' }]) {
    assert.equal((await request('/profile', { method: 'PATCH', cookie, body: { profile } })).status, 400);
  }
});
test('profile edits never modify another account', async () => {
  const first = await account();
  const second = await account({ email: 'second@example.com' });
  await request('/profile', { method: 'PATCH', cookie: first.cookie, body: { profile: { city: 'Delhi' } } });
  assert.equal((await User.findById(first.user.id))?.profile.city, 'Delhi');
  assert.equal((await User.findById(second.user.id))?.profile.city, '');
});
test('mutations reject missing verification headers and untrusted origins', async () => {
  assert.equal((await request('/auth/register', { method: 'POST', body: credentials, headers: { 'X-RoomieMatch-Request': '' } })).status, 403);
  assert.equal((await request('/auth/register', { method: 'POST', body: credentials, headers: { Origin: 'https://untrusted.example' } })).status, 403);
  assert.equal((await request('/auth/logout', { method: 'POST', headers: { 'X-RoomieMatch-Request': '' } })).status, 403);
  assert.equal(await User.countDocuments(), 0);
});
test('logout clears the authentication cookie with matching security attributes', async () => {
  const { cookie } = await account();
  const response = await request('/auth/logout', { method: 'POST', cookie });
  assert.equal(response.status, 200);
  const clearedCookie = response.headers.get('set-cookie')!;
  assert.match(clearedCookie, /roomiematch_session=;/);
  assert.match(clearedCookie, /HttpOnly/);
  assert.match(clearedCookie, /Path=\//);
  assert.match(clearedCookie, /SameSite=Lax/);
  assert.match(clearedCookie, /Expires=Thu, 01 Jan 1970/);
  assert.equal((await request('/auth/me', { cookie: clearedCookie.split(';')[0] })).status, 401);
  assert.equal((await request('/auth/logout', { method: 'POST' })).status, 200);
});
test('production cookies are Secure, HttpOnly, host-only and use the __Host prefix', () => {
  const output = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', "const {cookieOptions,authCookieName}=await import('./src/services/authService.ts');console.log(JSON.stringify({cookieOptions,authCookieName}));"], {
    env: { ...process.env, NODE_ENV: 'production', COOKIE_SAME_SITE: 'none', CLIENT_ORIGIN: 'https://roomiematch.example' }, encoding: 'utf8',
  });
  const settings = JSON.parse(output);
  assert.equal(settings.authCookieName, '__Host-roomiematch_session');
  assert.deepEqual(settings.cookieOptions, { httpOnly: true, secure: true, sameSite: 'none', path: '/' });
});
test('excessive failed auth attempts are rate limited', async () => {
  for (let attempt = 0; attempt < 30; attempt++) assert.equal((await request('/auth/login', { method: 'POST', body: {} })).status, 400);
  assert.equal((await request('/auth/login', { method: 'POST', body: {} })).status, 429);
});
