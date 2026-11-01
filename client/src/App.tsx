import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProfilePage } from './pages/ProfilePage';
import { PreferencesPage } from './pages/PreferencesPage';
import { DiscoverPage } from './pages/DiscoverPage';
import { MatchDetailPage } from './pages/MatchDetailPage';
import { IncomingRequestsPage } from './pages/IncomingRequestsPage';
import { SentRequestsPage } from './pages/SentRequestsPage';
import { ConnectionsPage } from './pages/ConnectionsPage';
import { ConnectionDetailPage } from './pages/ConnectionDetailPage';
import { MessagesPage } from './pages/MessagesPage';
import { AuthRoute } from './components/AuthRoute';

export function App() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
    else window.scrollTo(0, 0);
    const titles: Record<string, string> = {
      '/': 'Find your kind of home',
      '/login': 'Welcome back',
      '/register': 'Make room for something good',
      '/dashboard': 'Your home base',
      '/profile': 'A little about you',
      '/preferences': 'Roommate preferences',
      '/discover': 'Roommate discovery',
      '/requests': 'Incoming requests',
      '/requests/sent': 'Sent requests',
      '/connections': 'My connections',
      '/messages': 'Roommate messages',
    };
    const resolvedTitle = pathname.startsWith('/discover/')
      ? 'Compatibility breakdown'
      : pathname.startsWith('/connections/')
      ? 'Connection details'
      : pathname.startsWith('/messages/')
      ? 'Conversation'
      : (titles[pathname] ?? 'Page not found');
    document.title = `RoomieMatch — ${resolvedTitle}`;
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
      <Route path="/preferences" element={<PreferencesPage />} />
      <Route path="/discover" element={<DiscoverPage />} />
      <Route path="/discover/:userId" element={<MatchDetailPage />} />
      <Route path="/requests" element={<IncomingRequestsPage />} />
      <Route path="/requests/sent" element={<SentRequestsPage />} />
      <Route path="/connections" element={<ConnectionsPage />} />
      <Route path="/connections/:id" element={<ConnectionDetailPage />} />
      <Route path="/messages" element={<MessagesPage />} />
      <Route path="/messages/:conversationId" element={<MessagesPage />} />
    </Route>
    <Route path="*" element={<NotFoundPage />} />
  </Routes>;
}
