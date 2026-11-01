// Explicit allowlist; never serialize request headers, errors, payloads or users.
const fields = ['engineTraceId', 'socketId', 'userId', 'conversationId', 'messageId', 'origin',
  'transport', 'reason', 'sessionCookiePresent', 'room', 'roomSocketCount',
  'recipientSocketCount', 'type', 'namespaceType', 'direction'] as const;

export function realtimeDebug(event: string, details: Record<string, unknown> = {}): void {
  if (process.env.REALTIME_DEBUG !== 'true') return;
  const safe: Record<string, unknown> = {};
  for (const key of fields) {
    const value = details[key];
    if (['string', 'boolean', 'number'].includes(typeof value)) safe[key] = value;
  }
  console.info('[realtime]', { event, at: new Date().toISOString(), ...safe });
}
