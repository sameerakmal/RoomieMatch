import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import axios from 'axios';
import { AuthContext, type AuthState } from '../hooks/useAuth';
import { api, apiError } from '../services/api';
import { authService } from '../services/auth';
import type { LoginInput, RegisterInput, User } from '../types';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [error, setError] = useState('');
  const revision = useRef(0);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const requestRevision = ++revision.current;
    try {
      const currentUser = await authService.me(signal);
      if (signal?.aborted || requestRevision !== revision.current) return;
      setUser(currentUser);
      setStatus('authenticated');
      setError('');
    } catch (cause) {
      if (signal?.aborted || requestRevision !== revision.current) return;
      setUser(null);
      if (axios.isAxiosError(cause) && cause.response?.status === 401) {
        setStatus('anonymous');
        setError('');
      } else {
        setStatus('error');
        setError(apiError(cause).message);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const interceptor = api.interceptors.response.use(response => response, (cause: unknown) => {
      if (axios.isAxiosError(cause) && cause.response?.status === 401 && cause.config?.url?.startsWith('/profile')) {
        revision.current++;
        setUser(null);
        setStatus('anonymous');
      }
      return Promise.reject(cause);
    });
    return () => { controller.abort(); api.interceptors.response.eject(interceptor); };
  }, [refresh]);

  async function login(input: LoginInput) {
    const currentUser = await authService.login(input);
    revision.current++;
    setUser(currentUser);
    setStatus('authenticated');
    setError('');
  }
  async function register(input: RegisterInput) {
    const currentUser = await authService.register(input);
    revision.current++;
    setUser(currentUser);
    setStatus('authenticated');
    setError('');
  }
  async function logout() {
    // Keep the local session if the request fails: do not pretend logout worked.
    await authService.logout();
    revision.current++;
    setUser(null);
    setStatus('anonymous');
    setError('');
  }
  const updateUser = useCallback((nextUser: User) => {
    setUser(current => current?.id === nextUser.id ? nextUser : current);
  }, []);

  return <AuthContext.Provider value={{ user, status, error, login, register, logout, refresh, updateUser }}>{children}</AuthContext.Provider>;
}
