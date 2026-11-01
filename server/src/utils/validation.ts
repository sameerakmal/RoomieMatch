import { HttpError } from './HttpError.js';

export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const profileTextLimits = { city: 100, occupation: 100, bio: 500, profilePhotoUrl: 2048 } as const;
type ProfileTextField = keyof typeof profileTextLimits;
export interface ProfileUpdate {
  name?: string;
  profile?: Partial<Record<ProfileTextField, string>> & { age?: number | null; moveInDate?: string | null };
}

function objectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Request body must be a JSON object.');
  return value as Record<string, unknown>;
}
function allowFields(value: Record<string, unknown>, allowed: readonly string[]): void {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new HttpError(400, 'Request contains fields that cannot be edited.');
}
function textField(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
    throw new HttpError(400, 'Please check the highlighted fields.', { [field]: `Enter ${min ? `${min}–${max}` : `up to ${max}`} characters.` });
  }
  return value.trim();
}
export function isPhotoUrl(value: string): boolean {
  if (!value) return true;
  try { const url = new URL(value); return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password; }
  catch { return false; }
}
export function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && date.getUTCFullYear() >= 1900 && date.getUTCFullYear() <= 2200;
}
export function validateCredentials(value: unknown, registration = false) {
  const body = objectBody(value);
  allowFields(body, registration ? ['name', 'email', 'password'] : ['email', 'password']);
  const name = registration ? textField(body.name, 'name', 2, 100) : undefined;
  const email = textField(body.email, 'email', 3, 254).toLowerCase();
  if (!emailPattern.test(email)) throw new HttpError(400, 'Please check the highlighted fields.', { email: 'Enter a valid email address.' });
  const password = body.password;
  if (typeof password !== 'string' || password.length < (registration ? 8 : 1) || Buffer.byteLength(password, 'utf8') > 72) {
    throw new HttpError(400, 'Please check the highlighted fields.', { password: registration ? 'Use at least 8 characters and no more than 72 UTF-8 bytes.' : 'Enter your password (up to 72 UTF-8 bytes).' });
  }
  return { name, email, password };
}
export function validateProfileUpdate(value: unknown): ProfileUpdate {
  const body = objectBody(value);
  allowFields(body, ['name', 'profile']);
  const update: ProfileUpdate = {};
  if ('name' in body) update.name = textField(body.name, 'name', 2, 100);
  if ('profile' in body) {
    const profile = objectBody(body.profile);
    allowFields(profile, [...Object.keys(profileTextLimits), 'age', 'moveInDate']);
    update.profile = {};
    for (const field of Object.keys(profileTextLimits) as ProfileTextField[]) {
      if (field in profile) update.profile[field] = textField(profile[field], field, 0, profileTextLimits[field]);
    }
    if (update.profile.profilePhotoUrl && !isPhotoUrl(update.profile.profilePhotoUrl)) {
      throw new HttpError(400, 'Please check the highlighted fields.', { profilePhotoUrl: 'Enter an HTTPS image URL without embedded credentials.' });
    }
    if ('age' in profile) {
      if (profile.age !== null && (typeof profile.age !== 'number' || !Number.isInteger(profile.age) || profile.age < 18 || profile.age > 120)) {
        throw new HttpError(400, 'Please check the highlighted fields.', { age: 'Enter a whole number between 18 and 120, or leave it blank.' });
      }
      update.profile.age = profile.age as number | null;
    }
    if ('moveInDate' in profile) {
      if (profile.moveInDate !== null && (typeof profile.moveInDate !== 'string' || !isDateOnly(profile.moveInDate))) {
        throw new HttpError(400, 'Please check the highlighted fields.', { moveInDate: 'Enter a valid calendar date between 1900 and 2200.' });
      }
      update.profile.moveInDate = profile.moveInDate as string | null;
    }
  }
  if (update.name === undefined && !Object.keys(update.profile ?? {}).length) throw new HttpError(400, 'Provide at least one editable field.');
  return update;
}
