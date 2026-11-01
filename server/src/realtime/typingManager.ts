/**
 * TypingManager
 * Tracks active typing sockets per conversation and user.
 * Structure: Map<conversationId, Map<userId, Set<socketId>>>
 */
export class TypingManager {
  private typingState = new Map<string, Map<string, Set<string>>>();

  /**
   * Register that a socket began typing in a conversation.
   * Returns true if the user transitioned from NOT typing to TYPING in this conversation.
   */
  public startTyping(conversationId: string, userId: string, socketId: string): boolean {
    let userMap = this.typingState.get(conversationId);
    if (!userMap) {
      userMap = new Map();
      this.typingState.set(conversationId, userMap);
    }

    let socketSet = userMap.get(userId);
    let transitioned = false;

    if (!socketSet) {
      socketSet = new Set();
      userMap.set(userId, socketSet);
      transitioned = true;
    } else if (socketSet.size === 0) {
      transitioned = true;
    }

    socketSet.add(socketId);
    return transitioned;
  }

  /**
   * Register that a socket stopped typing in a conversation.
   * Returns true if the user transitioned from TYPING to NOT TYPING (no other tabs typing).
   */
  public stopTyping(conversationId: string, userId: string, socketId: string): boolean {
    const userMap = this.typingState.get(conversationId);
    if (!userMap) return false;

    const socketSet = userMap.get(userId);
    if (!socketSet) return false;

    socketSet.delete(socketId);
    if (socketSet.size === 0) {
      userMap.delete(userId);
      if (userMap.size === 0) {
        this.typingState.delete(conversationId);
      }
      return true;
    }

    return false;
  }

  /**
   * Check if a user has any active typing socket in a conversation.
   */
  public isTyping(conversationId: string, userId: string): boolean {
    const userMap = this.typingState.get(conversationId);
    if (!userMap) return false;
    const socketSet = userMap.get(userId);
    return Boolean(socketSet && socketSet.size > 0);
  }

  /**
   * When a socket disconnects, remove it from any conversations where it was actively typing.
   * Returns a list of conversationIds where the user transitioned from TYPING to NOT TYPING.
   */
  public handleSocketDisconnect(userId: string, socketId: string): string[] {
    const ceasedConversations: string[] = [];

    for (const [conversationId, userMap] of this.typingState.entries()) {
      const socketSet = userMap.get(userId);
      if (socketSet && socketSet.has(socketId)) {
        socketSet.delete(socketId);
        if (socketSet.size === 0) {
          userMap.delete(userId);
          if (userMap.size === 0) {
            this.typingState.delete(conversationId);
          }
          ceasedConversations.push(conversationId);
        }
      }
    }

    return ceasedConversations;
  }

  /**
   * Clear all typing state for a conversation (e.g. on revocation or room cleanup).
   */
  public clearConversation(conversationId: string): void {
    this.typingState.delete(conversationId);
  }

  /**
   * Clear all typing state (for test teardowns).
   */
  public clear(): void {
    this.typingState.clear();
  }
}

export const typingManager = new TypingManager();

