import { api } from './api';
import type { LoginInput, RegisterInput, UserResponse } from '../types';

export const authService = {
  async me(signal?: AbortSignal) { return (await api.get<UserResponse>('/auth/me', { signal })).data.user; },
  async register(input: RegisterInput) { return (await api.post<UserResponse>('/auth/register', input)).data.user; },
  async login(input: LoginInput) { return (await api.post<UserResponse>('/auth/login', input)).data.user; },
  async logout() { await api.post('/auth/logout'); },
};
