import { ArrowUpRight, CalendarDays, Check, House, UserRound } from 'lucide-react';
import { ButtonLink } from '../components/Button';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useAuth } from '../hooks/useAuth';
import { profileCompletion } from '../utils/profile';
import quietCorner from '../assets/quiet-corner.jpg';

export function DashboardPage() {
  const { user } = useAuth();
  const currentUser = user!;
  const progress = profileCompletion(currentUser);
  const { profile } = currentUser;
  return <DashboardLayout>
    <section className="dashboard-welcome"><p className="eyebrow">A fresh start, a familiar feeling</p><h1>Make yourself at home,<br /><em>{currentUser.name.split(/\s+/)[0]}.</em></h1><p>Here’s where your next chapter will come together.</p></section>
    <section id="profile" className="profile-section">
      <div><p className="eyebrow">01 — Start with you</p><h2>A little introduction <br />goes a long way.</h2><p>{progress.percent === 100 ? 'Your introduction is complete. Keep it feeling like you.' : 'Help your future roommates get to know the everyday you.'}</p><ButtonLink to="/profile" variant="text">{progress.percent === 100 ? 'Edit your profile' : 'Complete your profile'} <ArrowUpRight size={16} /></ButtonLink></div>
      <div className="profile-progress">
        <div className="progress-heading"><span>Your profile</span><strong>{progress.percent}%</strong></div>
        <div className="progress-track" role="progressbar" aria-label="Profile completion" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress.percent}%` }} /></div>
        <p className="completion-detail">{progress.completed} of {progress.total} details added</p>
        <ul>
          <li><UserRound size={16} /><span>Your everyday</span><span>{profile.city && profile.occupation && profile.age ? 'Added' : 'Add your details'}</span></li>
          <li><CalendarDays size={16} /><span>Move-in date</span><span>{profile.moveInDate ? 'Added' : 'When you’re ready'}</span></li>
          <li><Check size={16} /><span>A personal touch</span><span>{profile.bio && profile.profilePhotoUrl ? 'Added' : 'Add a bio & photo'}</span></li>
        </ul>
      </div>
    </section>
    <section id="recommendations" className="recommendations-section"><div className="recommendations-heading"><h2>Your kind of people</h2><span>Roommate discovery</span></div><div className="recommendations-empty"><div className="empty-icon"><House size={36} strokeWidth={1.1} /></div><h3>Room for a great connection.</h3><p>Roommate discovery is coming in the next phase. For now, make your profile feel like you. Your people will have a place to find you.</p><span className="coming-soon">Something good is coming</span></div></section>
    <section className="dashboard-editorial"><img src={quietCorner} alt="A calm, inviting home interior" /><div><p className="eyebrow">The RoomieMatch approach</p><h2>Compatibility starts<br />with the everyday.</h2><ButtonLink variant="text" to="/#why-roomiematch">Get to know our approach <ArrowUpRight size={17} /></ButtonLink></div></section>
  </DashboardLayout>;
}
