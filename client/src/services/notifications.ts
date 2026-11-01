import { api } from './api';
import type { NotificationsResponse } from '../types';

export const notificationsService = {
  async getNotifications(page = 1, limit = 15, signal?: AbortSignal): Promise<NotificationsResponse> {
    const response = await api.get<NotificationsResponse>('/notifications', {
      params: { page, limit },
      signal,
    });
    return response.data;
  },

  async markAsRead(id: string, signal?: AbortSignal): Promise<{ success: boolean; unreadCount: number }> {
    const response = await api.patch<{ success: boolean; unreadCount: number }>(
      `/notifications/${id}/read`,
      {},
      { signal },
    );
    return response.data;
  },

  async markAllAsRead(signal?: AbortSignal): Promise<{ success: boolean; unreadCount: number }> {
    const response = await api.patch<{ success: boolean; unreadCount: number }>(
      '/notifications/read-all',
      {},
      { signal },
    );
    return response.data;
  },
};

