import { api } from './api';
import type {
  ConversationItem,
  ConversationsResponse,
  MessagesResponse,
} from '../types';

export const conversationsService = {
  async getConversations(signal?: AbortSignal): Promise<ConversationsResponse> {
    const response = await api.get<ConversationsResponse>('/conversations', { signal });
    return response.data;
  },

  async getOrCreateConversation(
    connectionId: string,
    signal?: AbortSignal,
  ): Promise<{ conversation: ConversationItem }> {
    const response = await api.post<{ conversation: ConversationItem }>(
      `/conversations/${connectionId}`,
      {},
      { signal },
    );
    return response.data;
  },

  async getConversationById(
    id: string,
    signal?: AbortSignal,
  ): Promise<{ conversation: ConversationItem }> {
    const response = await api.get<{ conversation: ConversationItem }>(
      `/conversations/${id}`,
      { signal },
    );
    return response.data;
  },

  async getMessages(
    id: string,
    before?: string | null,
    limit = 30,
    signal?: AbortSignal,
  ): Promise<MessagesResponse> {
    const response = await api.get<MessagesResponse>(`/conversations/${id}/messages`, {
      params: {
        ...(before ? { before } : {}),
        limit,
      },
      signal,
    });
    return response.data;
  },

  async markAsRead(
    id: string,
    signal?: AbortSignal,
  ): Promise<{ success: boolean; conversationId: string; markedCount: number }> {
    const response = await api.patch<{ success: boolean; conversationId: string; markedCount: number }>(
      `/conversations/${id}/read`,
      {},
      { signal },
    );
    return response.data;
  },

  async getUnreadCount(signal?: AbortSignal): Promise<{ unreadCount: number }> {
    const response = await api.get<{ unreadCount: number }>('/conversations/unread-count', {
      signal,
    });
    return response.data;
  },
};

