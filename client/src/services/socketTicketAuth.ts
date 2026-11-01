import type { Socket } from 'socket.io-client';

type TicketRequest = (signal: AbortSignal) => Promise<{ ticket: string }>;

// The auth callback runs for every namespace connection, including transport
// reconnects. Never cache tickets: the server may have consumed an earlier one.
export function installSocketTicketAuth(socket: Socket, requestTicket: TicketRequest): () => void {
  let disposed = false;
  let generation = 0;
  let pending: AbortController | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let failures = 0;
  let issuanceStatus: number | undefined;

  const cancelRequest = () => { generation++; pending?.abort(); pending = undefined; };
  socket.auth = callback => {
    cancelRequest();
    const requestGeneration = generation;
    const engine = socket.io.engine;
    pending = new AbortController();
    issuanceStatus = undefined;
    void requestTicket(pending.signal).then(({ ticket }) => {
      if (!disposed && generation === requestGeneration && engine === socket.io.engine && engine.readyState === 'open') {
        pending = undefined;
        callback({ ticket });
      }
    }).catch((error: unknown) => {
      if (disposed || generation !== requestGeneration) return;
      pending = undefined;
      issuanceStatus = (error as { response?: { status?: number } })?.response?.status ?? 0;
      // Complete this namespace attempt without credentials. The server rejects it
      // and the normal connect_error/UI path runs; raw HTTP errors are never logged.
      callback({});
    });
  };
  const onError = (error: Error & { data?: { code?: string } }) => {
    if (disposed || socket.active || retryTimer) return; // Manager owns transport retries.
    if (issuanceStatus === 401 || issuanceStatus === 403) return;
    const code = error.data?.code;
    if (code !== 'SOCKET_TICKET_INVALID' && code !== 'SOCKET_AUTH_UNAVAILABLE') return;
    const limit = issuanceStatus !== undefined || code === 'SOCKET_AUTH_UNAVAILABLE' ? 10 : 2;
    if (++failures > limit) return;
    const delay = issuanceStatus === 429 ? 60_000 : Math.min(1000 * 2 ** (failures - 1), 30_000);
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      if (!disposed) socket.connect();
    }, delay);
  };
  const onConnect = () => { failures = 0; issuanceStatus = undefined; };
  socket.on('connect_error', onError);
  socket.on('connect', onConnect);
  socket.io.on('close', cancelRequest);
  return () => {
    disposed = true;
    cancelRequest();
    clearTimeout(retryTimer);
    socket.off('connect_error', onError);
    socket.off('connect', onConnect);
    socket.io.off('close', cancelRequest);
    socket.auth = {};
  };
}
