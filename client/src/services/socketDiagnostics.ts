import type { Socket } from 'socket.io-client';

const tracedEngines = new WeakSet<object>();

// Never log packet bodies: they may contain authentication or message content.
export function attachSocketDiagnostics(socket: Socket, enabled: boolean): void {
  if (!enabled) return;
  const log = (event: string, details: Record<string, unknown> = {}) => {
    console.info('[realtime]', { event, at: new Date().toISOString(), socketId: socket.id, ...details });
  };
  log('socket:create');
  socket.io.on('open', () => log('manager:open'));
  socket.io.on('reconnect_attempt', attempt => log('reconnect:attempt', { attempt }));
  socket.io.on('reconnect_failed', () => log('reconnect:failed'));
  // Manager emits "open" only after the Engine.IO open packet is received.
  // Engine is created synchronously by connect(), before network packets arrive.
  socket.io.on('open', () => log('engine:open', { engineId: socket.io.engine.id, transport: socket.io.engine.transport.name }));
  socket.on('connect', () => log('namespace:connected'));
  socket.on('connect_error', () => log('namespace:connect_error', { willRetry: socket.active }));
  socket.on('disconnect', reason => log('socket:disconnect', { reason }));

  const events = new Set(['conversation:join', 'conversation:leave', 'conversation:joined', 'conversation:error',
    'message:send', 'message:new', 'message:sent', 'message:failed', 'message:read', 'conversation:updated']);
  const trace = (direction: string, event: string, payload: unknown) => {
    if (!events.has(event)) return;
    const data = payload as { conversationId?: unknown; id?: unknown; message?: { id?: unknown; conversationId?: unknown } } | null;
    const id = (value: unknown) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value) ? value : undefined;
    log(event, { direction, conversationId: id(data?.conversationId ?? data?.message?.conversationId),
      messageId: id(data?.id ?? data?.message?.id) });
  };
  socket.onAny((event, payload) => trace('in', event, payload));
  socket.onAnyOutgoing((event, payload) => trace('out', event, payload));
}

export function attachEngineDiagnostics(socket: Socket, enabled: boolean): void {
  if (!enabled) return;
  const engine = socket.io.engine;
  if (tracedEngines.has(engine)) return;
  tracedEngines.add(engine);
  const trace = (direction: string, packet: { type: string; data?: unknown }) => {
    const namespaceType = packet.type === 'message' && typeof packet.data === 'string'
      ? packet.data.charAt(0) : undefined;
    // Engine "message" + namespace 0 = wire 40; namespace 4 = wire 44.
    console.info('[realtime]', { event: 'engine:packet', at: new Date().toISOString(),
      direction, engineId: engine.id, type: packet.type, namespaceType });
  };
  engine.on('packet', packet => trace('in', packet));
  engine.on('packetCreate', packet => trace('out', packet));
}
