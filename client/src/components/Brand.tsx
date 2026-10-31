import { Link } from 'react-router-dom';
import { House } from 'lucide-react';

export function Brand({ light = false }: { light?: boolean }) {
  return <Link to="/" aria-label="RoomieMatch home" className={`brand ${light ? 'brand-light' : ''}`}><House size={27} strokeWidth={1.5} /><span>roomie<span className="brand-match">match</span><span className="brand-dot">.</span></span></Link>;
}
