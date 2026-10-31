import { Link } from 'react-router-dom';
import { Brand } from './Brand';
import { ArrowUpRight } from 'lucide-react';

export function Footer() {
  return <footer className="site-footer shell"><div className="footer-main"><div><Brand /><p>Good people. Shared spaces. Better living.</p></div><nav aria-label="Footer navigation"><Link to="/#how-it-works">How it works</Link><Link to="/#why-roomiematch">Our approach</Link><Link to="/register">Find your roommate <ArrowUpRight size={14} /></Link></nav></div><div className="footer-bottom"><span>© {new Date().getFullYear()} RoomieMatch</span><span>A little more compatible. A lot more home.</span></div></footer>;
}
