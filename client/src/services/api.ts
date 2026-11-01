import axios from 'axios';
import type { ApiErrorBody, HealthResponse } from '../types';

// Axios's withCredentials is the equivalent of fetch's credentials: 'include'.
// The JWT stays in an HttpOnly cookie and is never read or stored by JavaScript.
const rawApiUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
const normalizedBaseUrl = rawApiUrl
  ? (rawApiUrl.endsWith('/api') ? rawApiUrl.replace(/\/+$/, '') : `${rawApiUrl.replace(/\/+$/, '')}/api`)
  : '/api';

export const api = axios.create({
  baseURL: normalizedBaseUrl,
  timeout: 10000,
  withCredentials: true,
  headers: { Accept: 'application/json', 'X-RoomieMatch-Request': 'web' },
});
export function apiError(error: unknown): { message: string; fields?: Record<string, string> } {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    if (error.response?.data?.error?.message) return error.response.data.error;
    if (!error.response) return { message: 'We couldn’t reach RoomieMatch. Check your connection and try again.' };
  }
  return { message: 'Something went wrong. Please try again.' };
}
export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await api.get<HealthResponse>('/health', { signal });
  return response.data;
}
