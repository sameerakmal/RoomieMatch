export interface AuthValues { name: string; email: string; password: string; confirmPassword: string }
export type AuthErrors = Partial<Record<keyof AuthValues, string>>;
export interface UserProfile {
  city: string;
  occupation: string;
  bio: string;
  profilePhotoUrl: string;
  age: number | null;
  moveInDate: string | null;
}
export interface User {
  id: string;
  name: string;
  email: string;
  profile: UserProfile;
  createdAt: string;
  updatedAt: string;
}
export interface UserResponse { user: User }
export interface LoginInput { email: string; password: string }
export interface RegisterInput extends LoginInput { name: string }
export interface ProfileInput { name?: string; profile?: Partial<UserProfile> }
export interface ProfileValues {
  name: string;
  city: string;
  occupation: string;
  bio: string;
  profilePhotoUrl: string;
  age: string;
  moveInDate: string;
}
export type ProfileErrors = Partial<Record<keyof ProfileValues, string>>;
export interface ApiErrorBody { error: { message: string; status: number; fields?: Record<string, string> } }
export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  database: 'connected' | 'disconnected' | 'connecting' | 'disconnecting' | 'unconfigured';
  timestamp: string;
}
