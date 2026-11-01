import type { AuthErrors, AuthValues, ProfileErrors, ProfileValues } from '../types';

export function validateAuth(values: AuthValues, mode: 'login' | 'register'): AuthErrors {
  const errors: AuthErrors = {};
  if (mode === 'register' && (values.name.trim().length < 2 || values.name.trim().length > 100)) errors.name = 'Please enter your name (2–100 characters).';
  if (values.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Please enter a valid email address.';
  if (!values.password) errors.password = 'Please enter your password.';
  else if (mode === 'register' && values.password.length < 8) errors.password = 'Choose a password with at least 8 characters.';
  if (new TextEncoder().encode(values.password).length > 72) errors.password = 'Use no more than 72 UTF-8 bytes (some characters use more than one byte).';
  if (mode === 'register' && (!values.confirmPassword || values.password !== values.confirmPassword)) errors.confirmPassword = 'Your passwords must match.';
  return errors;
}

export function validateProfile(values: ProfileValues): ProfileErrors {
  const errors: ProfileErrors = {};
  if (values.name.trim().length < 2 || values.name.trim().length > 100) errors.name = 'Enter your name (2–100 characters).';
  if (values.city.trim().length > 100) errors.city = 'Use up to 100 characters.';
  if (values.occupation.trim().length > 100) errors.occupation = 'Use up to 100 characters.';
  if (values.bio.trim().length > 500) errors.bio = 'Keep your introduction to 500 characters.';
  if (values.age && (!Number.isInteger(Number(values.age)) || Number(values.age) < 18 || Number(values.age) > 120)) errors.age = 'Enter a whole number between 18 and 120.';
  if (values.moveInDate) {
    const date = new Date(`${values.moveInDate}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.moveInDate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== values.moveInDate || date.getUTCFullYear() < 1900 || date.getUTCFullYear() > 2200) errors.moveInDate = 'Enter a valid calendar date between 1900 and 2200.';
  }
  if (values.profilePhotoUrl.trim()) {
    try {
      const url = new URL(values.profilePhotoUrl.trim());
      if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || values.profilePhotoUrl.trim().length > 2048) throw new Error();
    } catch { errors.profilePhotoUrl = 'Enter an HTTPS image URL without embedded credentials.'; }
  }
  return errors;
}
