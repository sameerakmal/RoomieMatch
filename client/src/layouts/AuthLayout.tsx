import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Brand } from '../components/Brand';
import livingRoom from '../assets/living-room.jpg';

export function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="auth-layout"><div className="auth-panel"><Brand /><div className="auth-content">{children}</div><Link to="/" className="back-link"><ArrowLeft size={16} /> Back to RoomieMatch</Link></div><aside className="auth-visual"><img src={livingRoom} alt="A warm, light-filled shared living space" /><div className="auth-quote"><p className="eyebrow">A little more like home</p><h2>Good spaces.<br /><em>Even better company.</em></h2><p>Find the people who make a place feel like yours.</p></div></aside></main>;
}
