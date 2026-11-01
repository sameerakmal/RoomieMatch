import type { MessageItem } from '../types';

/**
 * Creates an optimistic message object to be displayed immediately in the sender's UI
 * while the real-time send event is in flight to the server.
 */
export function createOptimisticMessage({
  conversationId,
  senderId,
  content,
  idempotencyKey,
}: {
  conversationId: string;
  senderId: string;
  content: string;
  idempotencyKey?: string;
}): { message: MessageItem; idempotencyKey: string } {
  const key =
    idempotencyKey ||
    `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const message: MessageItem = {
    id: key,
    conversationId,
    senderId,
    content,
    messageType: 'text',
    readBy: [senderId],
    createdAt: new Date().toISOString(),
    idempotencyKey: key,
    pending: true,
  };

  return { message, idempotencyKey: key };
}

/**
 * Reconciles an incoming or acknowledged message with existing chat messages.
 *
 * Guarantees:
 * 1. Canonical ID deduplication: If a message with incoming.id is already in state,
 *    it is updated (pending cleared, readBy merged) and never duplicated.
 * 2. Optimistic replacement: If an optimistic placeholder matching targetKey exists,
 *    it is replaced in-place by the canonical message, preserving chronological order.
 * 3. Ghost placeholder cleanup: Any distinct optimistic placeholder matching targetKey
 *    is discarded once the canonical message is present.
 * 4. Distinct messages preserved: Legitimate distinct messages (including identical content)
 *    have unique IDs/keys and are preserved accurately.
 * 5. Incoming recipient messages: Messages from another user or session without matching
 *    optimistic placeholders are appended cleanly.
 */
export function reconcileMessage(
  prev: MessageItem[],
  incoming: MessageItem,
  fallbackIdempotencyKey?: string,
): MessageItem[] {
  const targetKey = incoming.idempotencyKey || fallbackIdempotencyKey;
  const canonicalId = incoming.id;

  // 1. Check if canonical server ID already exists in the message list
  const hasCanonical = prev.some((m) => m.id === canonicalId);

  if (hasCanonical) {
    return prev
      .filter((m) => {
        // Drop any separate optimistic placeholder with the same idempotency key
        if (
          targetKey &&
          m.id !== canonicalId &&
          (m.idempotencyKey === targetKey || m.id === targetKey)
        ) {
          return false;
        }
        return true;
      })
      .map((m) => {
        if (m.id === canonicalId) {
          return {
            ...m,
            ...incoming,
            idempotencyKey: incoming.idempotencyKey || m.idempotencyKey || targetKey,
            pending: false,
            failed: false,
          };
        }
        return m;
      });
  }

  // 2. Check if an optimistic placeholder matching targetKey exists
  const hasOptimisticMatch = Boolean(
    targetKey &&
      prev.some(
        (m) =>
          (m.idempotencyKey && m.idempotencyKey === targetKey) ||
          m.id === targetKey,
      ),
  );

  if (hasOptimisticMatch) {
    let replaced = false;
    const result: MessageItem[] = [];

    for (const m of prev) {
      const isMatch =
        targetKey &&
        ((m.idempotencyKey && m.idempotencyKey === targetKey) ||
          m.id === targetKey);

      if (isMatch) {
        if (!replaced) {
          result.push({
            ...m,
            ...incoming,
            id: canonicalId,
            idempotencyKey: incoming.idempotencyKey || targetKey,
            pending: false,
            failed: false,
          });
          replaced = true;
        }
      } else {
        result.push(m);
      }
    }

    return result;
  }

  // 3. New message (from other participant, another tab/device, or newly received)
  return [
    ...prev,
    {
      ...incoming,
      idempotencyKey: incoming.idempotencyKey || targetKey,
      pending: false,
      failed: false,
    },
  ];
}

/**
 * Marks an optimistic message as failed when a send error occurs.
 */
export function reconcileFailedMessage(
  prev: MessageItem[],
  idempotencyKey: string,
): MessageItem[] {
  return prev.map((m) => {
    if (m.idempotencyKey === idempotencyKey || m.id === idempotencyKey) {
      return { ...m, pending: false, failed: true };
    }
    return m;
  });
}

/**
 * Merges newly loaded older historical messages with current messages,
 * ensuring no overlap or duplicates.
 */
export function mergeOlderMessages(
  currentMessages: MessageItem[],
  olderMessages: MessageItem[],
): MessageItem[] {
  const existingIds = new Set(currentMessages.map((m) => m.id));
  const newOlder = olderMessages.filter((m) => !existingIds.has(m.id));
  return [...newOlder, ...currentMessages];
}

