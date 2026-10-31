import type { AuthErrors, AuthValues } from '../types';

export function validateAuth(values: AuthValues, mode: 'login' | 'register'): AuthErrors {
  const errors: AuthErrors = {};
  if (mode === 'register' && values.name.trim().length < 2) errors.name = 'Please enter your name (at least 2 characters).';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Please enter a valid email address.';
  if (!values.password) errors.password = 'Please enter your password.';
  else if (mode === 'register' && values.password.length < 8) errors.password = 'Choose a password with at least 8 characters.';
  return errors;
}
