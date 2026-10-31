import axios from 'axios';
import type { HealthResponse } from '../types';

export const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || '/api', timeout: 8000, headers: { Accept: 'application/json' } });
export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await api.get<HealthResponse>('/health', { signal });
  return response.data;
}
