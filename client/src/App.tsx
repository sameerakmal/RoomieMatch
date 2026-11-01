import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProfilePage } from './pages/ProfilePage';
import { AuthRoute } from './components/AuthRoute';

export function App() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
    else window.scrollTo(0, 0);
    const titles: Record<string, string> = { '/': 'Find your kind of home', '/login': 'Welcome back', '/register': 'Make room for something good', '/dashboard': 'Your home base', '/profile': 'A little about you' };
    document.title = `RoomieMatch — ${titles[pathname] ?? 'Page not found'}`;
  }, [pathname, hash]);
  return <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route element={<AuthRoute guestOnly />}>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
    </Route>
    <Route element={<AuthRoute />}>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/profile" element={<ProfilePage />} />
    </Route>
    <Route path="*" element={<NotFoundPage />} />
  </Routes>;
}
