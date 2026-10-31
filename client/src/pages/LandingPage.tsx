import { ArrowDown, ArrowRight, ArrowUpRight, Check, CircleDollarSign, Coffee, House, Moon, Sparkles, Users, Volume2 } from 'lucide-react';
import { SiteLayout } from '../layouts/SiteLayout';
import { ButtonLink } from '../components/Button';
import livingRoom from '../assets/living-room.jpg';
import quietCorner from '../assets/quiet-corner.jpg';

const categories = [
  { icon: Moon, title: 'Daily rhythms', text: 'Early bird or night owl? Find someone on your wavelength.' },
  { icon: Sparkles, title: 'A sense of clean', text: 'A shared understanding of what “tidy enough” looks like.' },
  { icon: Volume2, title: 'Volume of life', text: 'Quiet evenings, a little background music, or somewhere in between.' },
  { icon: Users, title: 'An open door', text: 'Get on the same page about guests and time to yourself.' },
  { icon: CircleDollarSign, title: 'Room in your budget', text: 'Comfortable living starts with comfortable expectations.' },
];

export function LandingPage() {
  return <SiteLayout>
    <section className="hero shell" aria-labelledby="hero-heading">
      <div className="hero-copy"><p className="eyebrow"><span className="little-line" /> A better way to live together</p><h1 id="hero-heading">Your space.<br />Your people.<br /><em>Your kind of home.</em></h1><p className="hero-description">A shared address is just the beginning. Find a roommate who fits your lifestyle, your rhythms, and the way you like to live.</p><div className="hero-actions"><ButtonLink to="/register">Find your roommate <ArrowUpRight size={18} /></ButtonLink><a className="text-link" href="#how-it-works">How it works <ArrowDown size={16} /></a></div><div className="hero-note"><span className="small-icon"><House size={17} strokeWidth={1.5} /></span><span>Built around people.<br /><strong>Because home is a feeling.</strong></span></div></div>
      <div className="hero-visual"><div className="photo-frame"><img src={livingRoom} alt="An inviting living room with a linen sofa, warm wood furniture, and natural light" fetchPriority="high" /><span className="photo-index">01 / THE ART OF LIVING TOGETHER</span></div><div className="photo-note"><span className="photo-note-icon"><Coffee size={23} strokeWidth={1.3} /></span><div><span className="eyebrow">The little things matter</span><p>Same space. Shared rhythm.</p></div><span className="olive-dot" /></div><p className="photo-caption"><span>A place to belong, together.</span><span>ROOMIEMATCH JOURNAL — 01</span></p></div>
    </section>
    <div className="intro-strip"><div className="shell"><span>More than splitting the rent.</span><p>Sharing a home should feel <em>natural.</em></p><House size={30} strokeWidth={1} /></div></div>
    <section id="how-it-works" className="section shell"><div className="section-heading"><div><p className="eyebrow">01 — A thoughtful beginning</p><h2>A little about you.<br />A better way to find your people.</h2></div><p>No endless scrolling. No guesswork. <br />Just a more intentional way to share a home.</p></div><div className="steps">{[
      ['01', 'Make yourself at home', 'Start with a profile that feels like you. A little introduction goes a long way.'],
      ['02', 'Share your everyday', 'From your morning routine to your ideal weekend, tell us how you like to live.'],
      ['03', 'Find your kind of people', 'Discover roommates with compatible lifestyles, so you can start on common ground.'],
    ].map(([number, title, text]) => <article className="step" key={number}><div className="step-number"><span>{number}</span><ArrowUpRight size={21} strokeWidth={1} /></div><h3>{title}</h3><p>{text}</p></article>)}</div><p className="section-footnote">A look at what’s ahead. We’re building a thoughtful matching experience, one step at a time.</p></section>
    <section className="compatibility-section"><div className="shell"><div className="section-heading"><div><p className="eyebrow">02 — The details of daily life</p><h2>It’s the little things<br />you live with.</h2></div><p>The best fit goes beyond a postcode. <br />Five everyday things make all the difference.</p></div><div className="categories">{categories.map(({ icon: Icon, title, text }, index) => <article className="category" key={title}><div className="category-top"><Icon size={26} strokeWidth={1.25} /><span>0{index + 1}</span></div><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>
    <section id="why-roomiematch" className="why-section shell"><div className="why-image"><img src={quietCorner} alt="A thoughtfully arranged home with natural materials, soft textiles, and warm neutral tones" loading="lazy" /><span>SPACE TO BE YOURSELF.</span></div><div className="why-copy"><p className="eyebrow">03 — A home, not just an address</p><h2>The right people<br />change <em>everything.</em></h2><p>You shouldn’t have to tiptoe around your own home. Or wonder if your idea of a quiet Tuesday looks anything like theirs.</p><p>RoomieMatch starts with the way you live. Because when the everyday things fall into place, there’s more room for the good stuff.</p><ul className="why-list"><li><Check size={17} /> Less friction in the little moments</li><li><Check size={17} /> Expectations that feel comfortable</li><li><Check size={17} /> More space to feel like yourself</li></ul><ButtonLink to="/register" variant="text">Find a better fit <ArrowRight size={18} /></ButtonLink></div></section>
    <section className="final-cta"><div className="shell final-cta-inner"><div><p className="eyebrow">Good things begin with good company</p><h2>Your next chapter.<br /><em>A little more like home.</em></h2></div><div><ButtonLink to="/register" variant="light">Find your roommate <ArrowUpRight size={19} /></ButtonLink><p>Make room for the right people.</p></div></div></section>
  </SiteLayout>;
}
