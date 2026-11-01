import { io, type Socket } from 'socket.io-client';
import { attachEngineDiagnostics, attachSocketDiagnostics } from './socketDiagnostics';
import { api } from './api';
import { installSocketTicketAuth } from './socketTicketAuth';

let socketInstance: Socket | null = null;
let stopTicketAuth: (() => void) | undefined;

export function getSocket(): Socket {
  if (!socketInstance) {
    const rawApiUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || '';
    const explicitSocketUrl = (import.meta.env.VITE_SOCKET_URL as string | undefined)?.trim();
    const socketUrl = explicitSocketUrl || (rawApiUrl.startsWith('http')
      ? rawApiUrl.replace(/\/api\/?$/, '')
      : window.location.origin);

    socketInstance = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    stopTicketAuth = installSocketTicketAuth(socketInstance, async signal => {
      const { data } = await api.post<{ ticket: string }>('/auth/socket-ticket', {}, { signal });
      return data;
    });
    const endSession = () => {
      disconnectSocket();
      window.dispatchEvent(new Event('roomiematch:session-ended'));
    };
    socketInstance.on('session:ended', endSession);
    socketInstance.on('disconnect', reason => {
      if (reason === 'io server disconnect') endSession();
    });
    const debug = import.meta.env.VITE_REALTIME_DEBUG === 'true';
    if (debug) console.info('[realtime]', { event: 'socket:configuration', origin: new URL(socketUrl, window.location.origin).origin,
      path: '/socket.io', transports: ['websocket', 'polling'], withCredentials: true });
    attachSocketDiagnostics(socketInstance, debug);
    // Install diagnostics before starting the asynchronous handshake.
    socketInstance.connect();
    attachEngineDiagnostics(socketInstance, debug);
    const socket = socketInstance;
    if (debug) socket.io.on('reconnect_attempt', () => {
      // A reconnect creates a new engine after this event returns.
      queueMicrotask(() => {
        attachEngineDiagnostics(socket, debug);
      });
    });
  }
  return socketInstance;
}

export function disconnectSocket(): void {
  if (socketInstance) {
    const socket = socketInstance;
    socketInstance = null;
    stopTicketAuth?.();
    stopTicketAuth = undefined;
    socket.sendBuffer.length = 0;
    socket.disconnect();
  }
}

