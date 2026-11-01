import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import axios from 'axios';
import { AuthContext, type AuthState } from '../hooks/useAuth';
import { api, apiError } from '../services/api';
import { authService } from '../services/auth';
import type { LoginInput, RegisterInput, User } from '../types';
import { disconnectSocket } from '../services/socket';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [error, setError] = useState('');
  const revision = useRef(0);
  const sessionChannel = useRef<BroadcastChannel | null>(null);

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
      disconnectSocket();
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
      if (axios.isAxiosError(cause) && cause.response?.status === 401) {
        const url = cause.config?.url;
        if (!url?.startsWith('/auth/login') && !url?.startsWith('/auth/register')) {
          revision.current++;
          disconnectSocket();
          setUser(null);
          setStatus('anonymous');
        }
      }
      return Promise.reject(cause);
    });
    return () => { controller.abort(); api.interceptors.response.eject(interceptor); };
  }, [refresh]);

  useEffect(() => {
    const restoreSession = () => {
      disconnectSocket();
      setStatus('loading');
      void refresh();
    };
    window.addEventListener('roomiematch:session-ended', restoreSession);
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('roomiematch-session') : null;
    sessionChannel.current = channel;
    if (channel) channel.onmessage = event => { if (event.data === 'logout') restoreSession(); };
    return () => {
      window.removeEventListener('roomiematch:session-ended', restoreSession);
      channel?.close();
      sessionChannel.current = null;
    };
  }, [refresh]);

  async function login(input: LoginInput) {
    const currentUser = await authService.login(input);
    disconnectSocket();
    revision.current++;
    setUser(currentUser);
    setStatus('authenticated');
    setError('');
  }
  async function register(input: RegisterInput) {
    const currentUser = await authService.register(input);
    disconnectSocket();
    revision.current++;
    setUser(currentUser);
    setStatus('authenticated');
    setError('');
  }
  async function logout() {
    // Keep the local session if the request fails: do not pretend logout worked.
    await authService.logout();
    disconnectSocket();
    sessionChannel.current?.postMessage('logout');
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
