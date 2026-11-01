import { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LoadingState } from './LoadingState';
import { Button, ButtonLink } from './Button';
import { Brand } from './Brand';

export function AuthRoute({ guestOnly = false }: { guestOnly?: boolean }) {
  const { status, error, refresh } = useAuth();
  const location = useLocation();
  const [retrying, setRetrying] = useState(false);
  if (status === 'loading') return <main className="session-screen"><Brand /><LoadingState label="Making yourself at home…" /></main>;
  if (status === 'error') return <main className="session-screen"><Brand /><h1>A moment to reconnect.</h1><p role="alert">{error}</p><Button disabled={retrying} onClick={async () => { setRetrying(true); await refresh(); setRetrying(false); }}>{retrying ? <LoadingState label="Reconnecting…" /> : 'Try again'}</Button><ButtonLink to="/" variant="text">Back to home</ButtonLink></main>;
  if (guestOnly && status === 'authenticated') return <Navigate to="/dashboard" replace />;
  if (!guestOnly && status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
