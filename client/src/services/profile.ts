import { api } from './api';
import type { ProfileInput, UserResponse } from '../types';

export const profileService = {
  async get(signal?: AbortSignal) { return (await api.get<UserResponse>('/profile', { signal })).data.user; },
  async update(input: ProfileInput) { return (await api.patch<UserResponse>('/profile', input)).data.user; },
};
