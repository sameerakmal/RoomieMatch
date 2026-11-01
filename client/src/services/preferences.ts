import { api } from './api';
import type {
  PreferencesResponse,
  PreferencesStatus,
  PreferencesStatusResponse,
  RoommatePreferences,
} from '../types';

export const preferencesService = {
  async get(signal?: AbortSignal): Promise<RoommatePreferences | null> {
    const response = await api.get<PreferencesResponse>('/preferences', { signal });
    return response.data.preferences;
  },

  async update(data: unknown): Promise<RoommatePreferences> {
    const response = await api.put<PreferencesResponse>('/preferences', data);
    return response.data.preferences!;
  },

  async patch(data: unknown): Promise<RoommatePreferences> {
    const response = await api.patch<PreferencesResponse>('/preferences', data);
    return response.data.preferences!;
  },

  async getStatus(signal?: AbortSignal): Promise<PreferencesStatus> {
    const response = await api.get<PreferencesStatusResponse>('/preferences/status', { signal });
    return response.data.status;
  },
};

