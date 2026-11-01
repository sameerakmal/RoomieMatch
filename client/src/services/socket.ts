import { io, type Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

export function getSocket(): Socket {
  if (!socketInstance) {
    const rawApiUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '';
    const explicitSocketUrl = (import.meta.env.VITE_SOCKET_URL as string | undefined)?.trim();
    const socketUrl = explicitSocketUrl || (rawApiUrl.startsWith('http')
      ? rawApiUrl.replace(/\/api\/?$/, '')
      : window.location.origin);

    socketInstance = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }
  return socketInstance;
}

export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

