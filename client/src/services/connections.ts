import { api } from './api';
import type {
  ConnectionDetail,
  ConnectionSummary,
  ConnectionsResponse,
  ReceivedRequestsResponse,
  SentRequestsResponse,
} from '../types';

export const connectionsService = {
  async sendRequest(
    userId: string,
    message?: string,
    signal?: AbortSignal,
  ): Promise<{ connection: { id: string; status: string } }> {
    const response = await api.post<{ connection: { id: string; status: string } }>(
      `/connections/request/${userId}`,
      { message: message || '' },
      { signal },
    );
    return response.data;
  },

  async getReceivedRequests(
    page = 1,
    limit = 10,
    signal?: AbortSignal,
  ): Promise<ReceivedRequestsResponse> {
    const response = await api.get<ReceivedRequestsResponse>('/connections/received', {
      params: { page, limit },
      signal,
    });
    return response.data;
  },

  async getSentRequests(
    page = 1,
    limit = 10,
    status?: string,
    signal?: AbortSignal,
  ): Promise<SentRequestsResponse> {
    const response = await api.get<SentRequestsResponse>('/connections/sent', {
      params: { page, limit, ...(status ? { status } : {}) },
      signal,
    });
    return response.data;
  },

  async acceptRequest(id: string, signal?: AbortSignal): Promise<{ message: string }> {
    const response = await api.patch<{ message: string }>(
      `/connections/${id}/accept`,
      {},
      { signal },
    );
    return response.data;
  },

  async rejectRequest(id: string, signal?: AbortSignal): Promise<{ message: string }> {
    const response = await api.patch<{ message: string }>(
      `/connections/${id}/reject`,
      {},
      { signal },
    );
    return response.data;
  },

  async cancelRequest(id: string, signal?: AbortSignal): Promise<{ message: string }> {
    const response = await api.patch<{ message: string }>(
      `/connections/${id}/cancel`,
      {},
      { signal },
    );
    return response.data;
  },

  async getConnections(
    page = 1,
    limit = 10,
    signal?: AbortSignal,
  ): Promise<ConnectionsResponse> {
    const response = await api.get<ConnectionsResponse>('/connections', {
      params: { page, limit },
      signal,
    });
    return response.data;
  },

  async getConnectionById(id: string, signal?: AbortSignal): Promise<{ connection: ConnectionDetail }> {
    const response = await api.get<{ connection: ConnectionDetail }>(`/connections/${id}`, { signal });
    return response.data;
  },

  async getSummary(signal?: AbortSignal): Promise<ConnectionSummary> {
    const response = await api.get<ConnectionSummary>('/connections/summary', { signal });
    return response.data;
  },
};

