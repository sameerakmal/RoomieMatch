import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { Brand } from './Brand';
import { ButtonLink } from './Button';
import { useAuth } from '../hooks/useAuth';

export function Navbar() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  return <header className="site-header"><div className="shell nav-inner">
    <Brand />
    <nav className="desktop-nav" aria-label="Main navigation"><Link to="/#how-it-works">How it works</Link><Link to="/#why-roomiematch">Why RoomieMatch</Link></nav>
    <div className="nav-actions">{!user && <Link to="/login" className="login-link">Log in</Link>}<ButtonLink to={user ? '/dashboard' : '/register'} className="nav-cta">{user ? 'Your home base' : 'Get started'} <ArrowUpRight size={16} /></ButtonLink></div>
    <button className="mobile-menu-toggle" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
  </div>{open && <nav id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation" onClick={() => setOpen(false)}><Link to="/#how-it-works">How it works</Link><Link to="/#why-roomiematch">Why RoomieMatch</Link>{!user && <Link to="/login">Log in</Link>}<Link to={user ? '/dashboard' : '/register'}>{user ? 'Your home base' : 'Get started'} <ArrowUpRight size={16} /></Link></nav>}</header>;
}
