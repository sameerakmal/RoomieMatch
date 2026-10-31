import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { NotFoundPage } from './pages/NotFoundPage';

export function App() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
    else window.scrollTo(0, 0);
    const titles: Record<string, string> = { '/': 'Find your kind of home', '/login': 'Welcome back', '/register': 'Make room for something good', '/dashboard': 'Your home base' };
    document.title = `RoomieMatch — ${titles[pathname] ?? 'Page not found'}`;
  }, [pathname, hash]);
  return <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/register" element={<AuthPage mode="register" />} />
    <Route path="/dashboard" element={<DashboardPage />} />
    <Route path="*" element={<NotFoundPage />} />
  </Routes>;
}
