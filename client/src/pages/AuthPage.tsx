import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { AuthLayout } from '../layouts/AuthLayout';
import { FormInput } from '../components/FormInput';
import { Button } from '../components/Button';
import { LoadingState } from '../components/LoadingState';
import { useAuth } from '../hooks/useAuth';
import { apiError } from '../services/api';
import { validateAuth } from '../utils/validation';
import type { AuthErrors, AuthValues } from '../types';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  return <AuthForm key={mode} mode={mode} />;
}
function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const registering = mode === 'register';
  const auth = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState<AuthValues>({ name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<AuthErrors>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function update(field: keyof AuthValues, value: string) {
    setValues(previous => ({ ...previous, [field]: value }));
    setErrors(previous => ({ ...previous, [field]: undefined, ...(field === 'password' ? { confirmPassword: undefined } : {}) }));
    setError('');
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const nextErrors = validateAuth(values, mode);
    setErrors(nextErrors);
    setError('');
    if (Object.keys(nextErrors).length) {
      document.getElementById(`auth-${Object.keys(nextErrors)[0]}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      const credentials = { email: values.email.trim().toLowerCase(), password: values.password };
      if (registering) await auth.register({ ...credentials, name: values.name.trim() });
      else await auth.login(credentials);
      navigate('/dashboard', { replace: true });
    } catch (cause) {
      const failure = apiError(cause);
      setError(failure.message);
      setErrors(failure.fields ?? {});
    } finally { setBusy(false); }
  }

  return <AuthLayout>
    <p className="eyebrow">{registering ? 'Your next chapter starts here' : 'Your space is waiting'}</p>
    <h1>{registering ? <>Make room for<br /><em>something good.</em></> : <>Welcome<br /><em>back home.</em></>}</h1>
    <p className="auth-description">{registering ? 'A home that feels right starts with people who get you.' : 'A familiar space. A fresh beginning. Good to see you again.'}</p>
    <form className="auth-form" noValidate onSubmit={submit} aria-busy={busy}>
      {error && <p className="form-message form-message-error" role="alert">{error}</p>}
      <fieldset disabled={busy}>
        {registering && <FormInput id="auth-name" label="Your name" name="name" placeholder="First and last name" autoComplete="name" value={values.name} onChange={event => update('name', event.target.value)} error={errors.name} maxLength={100} required />}
        <FormInput id="auth-email" label="Email address" name="email" type="email" placeholder="you@example.com" autoComplete="email" value={values.email} onChange={event => update('email', event.target.value)} error={errors.email} maxLength={254} required />
        <FormInput id="auth-password" label="Password" name="password" type="password" placeholder={registering ? 'At least 8 characters' : 'Enter your password'} autoComplete={registering ? 'new-password' : 'current-password'} value={values.password} onChange={event => update('password', event.target.value)} error={errors.password} hint={registering ? 'At least 8 characters; up to 72 UTF-8 bytes.' : undefined} required />
        {registering && <FormInput id="auth-confirmPassword" label="Confirm password" name="confirmPassword" type="password" placeholder="Enter your password again" autoComplete="new-password" value={values.confirmPassword} onChange={event => update('confirmPassword', event.target.value)} error={errors.confirmPassword} required />}
        <Button type="submit" className="w-full justify-between" disabled={busy}>{busy ? <LoadingState label={registering ? 'Creating your account…' : 'Logging in…'} /> : <>{registering ? 'Create account' : 'Log in'} <ArrowRight size={18} /></>}</Button>
      </fieldset>
    </form>
    <p className="auth-switch">{registering ? 'Already feel at home?' : 'New around here?'} <Link to={registering ? '/login' : '/register'}>{registering ? 'Log in' : 'Create an account'}</Link></p>
  </AuthLayout>;
}
