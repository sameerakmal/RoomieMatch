import { useState, type ReactNode } from 'react';
import { ArrowLeft, Compass, House, Leaf, LogOut, SlidersHorizontal, UserRound } from 'lucide-react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { Button } from '../components/Button';
import { LoadingState } from '../components/LoadingState';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { useAuth } from '../hooks/useAuth';
import { useHealth } from '../hooks/useHealth';
import { apiError } from '../services/api';

export function DashboardLayout({ children, title = 'Your home base' }: { children: ReactNode; title?: string }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const health = useHealth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function signOut() {
    setBusy(true);
    setError('');
    try { await logout(); navigate('/login', { replace: true }); }
    catch (cause) { setError(apiError(cause).message); }
    finally { setBusy(false); }
  }
  return <div className="dashboard-layout">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="dashboard-sidebar">
      <Brand />
      <p className="eyebrow sidebar-label">Your little corner</p>
      <nav aria-label="Dashboard navigation">
        <NavLink to="/dashboard" end><House size={19} /> Overview</NavLink>
        <NavLink to="/profile"><UserRound size={19} /> Your profile</NavLink>
        <NavLink to="/preferences"><SlidersHorizontal size={19} /> Roommate preferences</NavLink>
        <Link to="/dashboard#recommendations"><Compass size={19} /> Roommate discovery</Link>
      </nav>
      <div className="sidebar-bottom"><Leaf size={27} strokeWidth={1.25} /><p>Good things take<br />a little growing.</p><Link to="/"><ArrowLeft size={15} /> Back to the website</Link></div>
    </aside>
    <main id="main-content" className="dashboard-main">
      <header className="dashboard-topbar"><span>{title}</span><div className="dashboard-account"><Link to="/profile" aria-label="View your profile"><ProfileAvatar name={user!.name} url={user!.profile.profilePhotoUrl} /></Link><Button variant="text" className="logout-button" onClick={signOut} disabled={busy}>{busy ? <LoadingState label="Signing out…" /> : <>Log out <LogOut size={15} /></>}</Button></div></header>
      {error && <p className="form-message form-message-error" role="alert">{error}</p>}
      {children}
      <footer className="dashboard-footer"><span>RoomieMatch · A little more like home.</span>{health === 'loading' ? <LoadingState label="Checking connection" /> : <span className="service-status"><span className={health === 'available' ? 'olive-dot' : 'muted-dot'} />{health === 'available' ? 'Service available' : 'Service currently unavailable'}</span>}</footer>
    </main>
  </div>;
}
