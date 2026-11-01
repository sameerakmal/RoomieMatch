import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomBytes } from 'node:crypto';

// Isolate these transport tests from developer database and CORS configuration.
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = '';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.COOKIE_SAME_SITE = 'lax';
const { app } = await import('../src/app.js');
let server: Server;
let baseUrl: string;
before(async () => {
  await new Promise<void>(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });

test('health reports unconfigured development database honestly', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.database, 'unconfigured');
  assert.equal(body.service, 'roomiematch-api');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.ok(Number.isFinite(Date.parse(body.timestamp)));
});
test('root health endpoint works identically to /api/health', async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, 'ok');
});
test('readiness endpoint confirms readiness without exposing internal details', async () => {
  const response = await fetch(`${baseUrl}/api/ready`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, 'ready');
  assert.equal(body.service, 'roomiematch-api');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.ok(Number.isFinite(Date.parse(body.timestamp)));
  assert.equal(body.database, undefined);
});
test('unknown API routes return a JSON 404', async () => {
  const response = await fetch(`${baseUrl}/api/missing`);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.message, 'Route not found.');
});
test('malformed JSON returns a controlled 400', async () => {
  const response = await fetch(`${baseUrl}/api/missing`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.message, 'Request body must be valid JSON.');
});
test('oversized JSON returns 413', async () => {
  const response = await fetch(`${baseUrl}/api/missing`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payload: 'x'.repeat(17000) }) });
  assert.equal(response.status, 413);
});
test('CORS allows the configured client and rejects other origins', async () => {
  const allowed = await fetch(`${baseUrl}/api/health`, { headers: { Origin: 'http://localhost:5173' } });
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  const blocked = await fetch(`${baseUrl}/api/health`, { headers: { Origin: 'https://untrusted.example' } });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.headers.get('access-control-allow-origin'), null);
});
test('CORS preflight is supported', async () => {
  const response = await fetch(`${baseUrl}/api/health`, { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'GET' } });
  assert.equal(response.status, 204);
});
