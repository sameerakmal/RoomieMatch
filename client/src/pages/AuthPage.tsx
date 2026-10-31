import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Info } from 'lucide-react';
import { AuthLayout } from '../layouts/AuthLayout';
import { FormInput } from '../components/FormInput';
import { Button } from '../components/Button';
import { validateAuth } from '../utils/validation';
import type { AuthErrors, AuthValues } from '../types';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  // A keyed child keeps form values and errors isolated when switching routes.
  return <AuthForm key={mode} mode={mode} />;
}
function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const register = mode === 'register';
  const [values, setValues] = useState<AuthValues>({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState<AuthErrors>({});
  const [submitted, setSubmitted] = useState(false);
  function update(field: keyof AuthValues, value: string) {
    setValues(previous => ({ ...previous, [field]: value }));
    setErrors(previous => ({ ...previous, [field]: undefined }));
    setSubmitted(false);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateAuth(values, mode);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      const firstField = Object.keys(nextErrors)[0];
      document.getElementById(`auth-${firstField}`)?.focus();
      return;
    }
    setSubmitted(true);
  }
  return <AuthLayout><p className="eyebrow">{register ? 'Your next chapter starts here' : 'Your space is waiting'}</p><h1>{register ? <>Make room for<br /><em>something good.</em></> : <>Welcome<br /><em>back home.</em></>}</h1><p className="auth-description">{register ? 'A home that feels right starts with people who get you.' : 'A familiar space. A fresh beginning. Good to see you again.'}</p><div className="phase-note"><Info size={17} /><p>We’re getting things ready. {register ? 'Account creation' : 'Sign-in'} opens in a future release. You can explore the dashboard preview today.</p></div><form noValidate onSubmit={submit}>
    {register && <FormInput id="auth-name" label="Your name" name="name" placeholder="First and last name" autoComplete="name" value={values.name} onChange={event => update('name', event.target.value)} error={errors.name} maxLength={100} required />}
    <FormInput id="auth-email" label="Email address" name="email" type="email" placeholder="you@example.com" autoComplete="email" value={values.email} onChange={event => update('email', event.target.value)} error={errors.email} maxLength={254} required />
    <FormInput id="auth-password" label="Password" name="password" type="password" placeholder={register ? 'At least 8 characters' : 'Enter your password'} autoComplete={register ? 'new-password' : 'current-password'} value={values.password} onChange={event => update('password', event.target.value)} error={errors.password} required />
    <Button type="submit" className="w-full justify-between">{register ? 'Create account' : 'Log in'} <ArrowRight size={18} /></Button>
    {submitted && <div className="submission-note" role="status">Your form looks good. {register ? 'Account creation' : 'Sign-in'} isn’t available yet; no details were sent or saved. <Link to="/dashboard">Explore the dashboard preview <ArrowUpRight size={14} /></Link></div>}
  </form><p className="auth-switch">{register ? 'Already feel at home?' : 'New around here?'} <Link to={register ? '/login' : '/register'}>{register ? 'Log in' : 'Create an account'}</Link></p><Link to="/dashboard" className="preview-link">Take a look around first <ArrowUpRight size={15} /></Link></AuthLayout>;
}
