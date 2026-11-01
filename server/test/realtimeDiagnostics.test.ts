import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import type { Socket } from 'socket.io-client';
import { realtimeDebug } from '../src/realtime/diagnostics.js';
import { attachEngineDiagnostics, attachSocketDiagnostics } from '../../client/src/services/socketDiagnostics.js';

test('realtime diagnostics are opt-in and exclude secrets and message bodies', () => {
  const original = console.info;
  const oldFlag = process.env.REALTIME_DEBUG;
  const logs: unknown[][] = [];
  console.info = (...args) => logs.push(args);
  try {
    process.env.REALTIME_DEBUG = 'false';
    realtimeDebug('test', { cookie: 'SECRET' });
    assert.equal(logs.length, 0);
    process.env.REALTIME_DEBUG = 'true';
    realtimeDebug('test', { socketId: 'socket', cookie: 'SECRET', token: 'SECRET', content: 'SECRET', user: { email: 'SECRET' } });
    assert.equal(logs.length, 1);
    assert.equal(JSON.stringify(logs).includes('SECRET'), false);
    assert.match(JSON.stringify(logs), /socket/);
  } finally {
    console.info = original;
    if (oldFlag === undefined) delete process.env.REALTIME_DEBUG;
    else process.env.REALTIME_DEBUG = oldFlag;
  }
});

test('client diagnostics distinguish Engine.IO and namespace packets without logging payloads', () => {
  const original = console.info;
  const logs: unknown[][] = [];
  console.info = (...args) => logs.push(args);
  const engine = Object.assign(new EventEmitter(), { id: 'engine', transport: { name: 'websocket' } });
  const manager = Object.assign(new EventEmitter(), { engine });
  let incoming: (event: string, payload: unknown) => void = () => {};
  let outgoing: (event: string, payload: unknown) => void = () => {};
  const socket = Object.assign(new EventEmitter(), { io: manager, id: 'socket', active: false,
    onAny: (fn: typeof incoming) => { incoming = fn; },
    onAnyOutgoing: (fn: typeof outgoing) => { outgoing = fn; },
  }) as unknown as Socket;
  try {
    attachSocketDiagnostics(socket, false);
    attachEngineDiagnostics(socket, false);
    assert.equal(logs.length, 0);
    attachSocketDiagnostics(socket, true);
    attachEngineDiagnostics(socket, true);
    engine.emit('packet', { type: 'open', data: 'SECRET' });
    engine.emit('packetCreate', { type: 'message', data: '0{"token":"SECRET"}' });
    engine.emit('packet', { type: 'message', data: '4{"message":"SECRET"}' });
    socket.emit('connect_error', new Error('SECRET'));
    incoming('message:new', { conversationId: 'a'.repeat(24), id: 'b'.repeat(24), content: 'SECRET' });
    outgoing('message:send', { conversationId: 'a'.repeat(24), content: 'SECRET', idempotencyKey: 'SECRET' });
    const text = JSON.stringify(logs);
    assert.equal(text.includes('SECRET'), false);
    assert.match(text, /"namespaceType":"0"/);
    assert.match(text, /"namespaceType":"4"/);
    assert.match(text, /"willRetry":false/);
    assert.match(text, /message:new/);
  } finally { console.info = original; }
});
