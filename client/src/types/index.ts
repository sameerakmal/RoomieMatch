export interface AuthValues { name: string; email: string; password: string }
export type AuthErrors = Partial<Record<keyof AuthValues, string>>;
export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  database: 'connected' | 'disconnected' | 'connecting' | 'disconnecting' | 'unconfigured';
  timestamp: string;
}
