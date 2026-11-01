import { createContext, useContext } from 'react';
import type { LoginInput, RegisterInput, User } from '../types';

export interface AuthState {
  user: User | null;
  status: 'loading' | 'authenticated' | 'anonymous' | 'error';
  error: string;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refresh: (signal?: AbortSignal) => Promise<void>;
  updateUser: (user: User) => void;
}
export const AuthContext = createContext<AuthState | null>(null);
export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
