import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import type { Socket } from 'socket.io-client';
import { installSocketTicketAuth } from '../../client/src/services/socketTicketAuth.js';

function fixture() {
  let connects = 0;
  const manager = Object.assign(new EventEmitter(), { engine: { readyState: 'open' } });
  const socket = Object.assign(new EventEmitter(), { io: manager, active: false, auth: {} as Socket['auth'],
    connect: () => { connects++; },
  });
  return { socket: socket as unknown as Socket, manager, connects: () => connects };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
function authenticate(socket: Socket, callback: (data: object) => void) {
  assert.equal(typeof socket.auth, 'function');
  (socket.auth as (cb: typeof callback) => void)(callback);
}

test('client requests a new ticket for every namespace attempt and never stores it on socket.auth', async () => {
  const { socket } = fixture(); let requests = 0; const sent: object[] = [];
  const stop = installSocketTicketAuth(socket, async () => ({ ticket: `fixture-${++requests}` }));
  authenticate(socket, data => sent.push(data)); await flush();
  authenticate(socket, data => sent.push(data)); await flush();
  assert.deepEqual(sent, [{ ticket: 'fixture-1' }, { ticket: 'fixture-2' }]);
  assert.equal(typeof socket.auth, 'function'); stop(); assert.deepEqual(socket.auth, {});
});
test('logout cancels pending issuance and cannot resurrect a disconnected socket', async () => {
  const { socket } = fixture(); let resolve!: (data: { ticket: string }) => void; let signal!: AbortSignal; let callbacks = 0;
  const stop = installSocketTicketAuth(socket, input => { signal = input; return new Promise(done => { resolve = done; }); });
  authenticate(socket, () => callbacks++); stop(); resolve({ ticket: 'fixture' }); await flush();
  assert(signal.aborted); assert.equal(callbacks, 0);
});
test('transport closure aborts pending issuance and stale responses are discarded', async () => {
  const { socket, manager } = fixture(); let resolve!: (data: { ticket: string }) => void; let callbacks = 0;
  const stop = installSocketTicketAuth(socket, () => new Promise(done => { resolve = done; }));
  authenticate(socket, () => callbacks++); manager.emit('close'); resolve({ ticket: 'stale' }); await flush();
  assert.equal(callbacks, 0); stop();
});
test('expired ticket rejection retries with a fresh auth callback at most twice', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { socket, connects } = fixture(); const stop = installSocketTicketAuth(socket, async () => ({ ticket: 'fixture' }));
  for (let i = 0; i < 4; i++) {
    socket.emit('connect_error', Object.assign(new Error('redacted'), { data: { code: 'SOCKET_TICKET_INVALID' } }));
    t.mock.timers.tick(30_000);
  }
  assert.equal(connects(), 2); stop();
});
test('REST authentication rejection is terminal; rate limits wait one minute and disposal cancels retries', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const status of [401, 403, 429]) {
    const { socket, connects } = fixture();
    const stop = installSocketTicketAuth(socket, async () => { throw { response: { status } }; });
    authenticate(socket, data => assert.deepEqual(data, {})); await flush();
    socket.emit('connect_error', Object.assign(new Error('redacted'), { data: { code: 'SOCKET_TICKET_INVALID' } }));
    t.mock.timers.tick(59_999); assert.equal(connects(), 0);
    if (status === 429) { t.mock.timers.tick(1); assert.equal(connects(), 1); }
    stop(); t.mock.timers.tick(120_000); assert.equal(connects(), status === 429 ? 1 : 0);
  }
});
