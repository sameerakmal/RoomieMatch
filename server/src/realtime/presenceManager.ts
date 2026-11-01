import type { Server as SocketIOServer } from 'socket.io';

/**
 * PresenceManager
 *
 * Tracks in-memory presence across multiple tabs/devices for authenticated users.
 *
 * Scaling & Architectural Note:
 * This in-memory Map structure maintains userId -> Set<socketId>.
 * If RoomieMatch is horizontally scaled to multiple backend processes behind a load balancer,
 * this manager should be swapped with a Redis-backed Presence Adapter (e.g. using Redis sets or
 * socket.io-redis adapter) so presence state is shared across cluster nodes.
 */
export class PresenceManager {
  private userSockets: Map<string, Set<string>> = new Map();

  /**
   * Register a new socket connection for a user.
   * Returns true if the user transitioned from offline to online.
   */
  public addSocket(userId: string, socketId: string): boolean {
    let sockets = this.userSockets.get(userId);
    let becameOnline = false;

    if (!sockets) {
      sockets = new Set();
      this.userSockets.set(userId, sockets);
      becameOnline = true;
    } else if (sockets.size === 0) {
      becameOnline = true;
    }

    sockets.add(socketId);
    return becameOnline;
  }

  /**
   * Unregister a socket on disconnect.
   * Returns true if the user transitioned from online to offline (last socket disconnected).
   */
  public removeSocket(userId: string, socketId: string): boolean {
    const sockets = this.userSockets.get(userId);
    if (!sockets) return false;

    sockets.delete(socketId);
    if (sockets.size === 0) {
      this.userSockets.delete(userId);
      return true;
    }
    return false;
  }

  /**
   * Check if a user currently has any active socket connections.
   */
  public isOnline(userId: string): boolean {
    const sockets = this.userSockets.get(userId);
    return Boolean(sockets && sockets.size > 0);
  }

  /**
   * Get all socket IDs for a given user.
   */
  public getSocketsForUser(userId: string): string[] {
    const sockets = this.userSockets.get(userId);
    return sockets ? Array.from(sockets) : [];
  }

  /**
   * Broadcast presence update to authorized targets (or globally as fallback).
   */
  public broadcastPresence(
    io: SocketIOServer,
    userId: string,
    isOnline: boolean,
    targetRooms?: string[],
  ): void {
    const payload = {
      userId,
      isOnline,
      timestamp: new Date().toISOString(),
    };

    if (targetRooms && targetRooms.length > 0) {
      for (const room of targetRooms) {
        io.to(room).emit('presence:update', payload);
      }
    } else {
      io.emit('presence:update', payload);
    }
  }

  /**
   * Reset all presence state (useful for test tear-downs).
   */
  public clear(): void {
    this.userSockets.clear();
  }
}

export const presenceManager = new PresenceManager();

