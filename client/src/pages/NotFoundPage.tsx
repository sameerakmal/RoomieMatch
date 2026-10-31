import { ArrowLeft } from 'lucide-react';
import { SiteLayout } from '../layouts/SiteLayout';
import { ButtonLink } from '../components/Button';

export function NotFoundPage() {
  return <SiteLayout><section className="not-found shell"><p className="eyebrow">404 — A little off the beaten path</p><h1>Let’s get you<br /><em>back home.</em></h1><p>This page doesn’t live here. A fresh start is just a click away.</p><ButtonLink to="/"><ArrowLeft size={17} /> Back to home</ButtonLink></section></SiteLayout>;
}
