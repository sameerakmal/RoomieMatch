import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Button } from '../components/Button';
import { FormInput } from '../components/FormInput';
import { LoadingState } from '../components/LoadingState';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { useAuth } from '../hooks/useAuth';
import { apiError } from '../services/api';
import { profileService } from '../services/profile';
import { validateProfile } from '../utils/validation';
import type { ProfileErrors, ProfileValues, User } from '../types';

function formValues(user: User): ProfileValues {
  return { name: user.name, ...user.profile, age: user.profile.age?.toString() ?? '', moveInDate: user.profile.moveInDate ?? '' };
}
export function ProfilePage() {
  const { updateUser } = useAuth();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    profileService.get(controller.signal).then(user => {
      if (controller.signal.aborted) return;
      setProfileUser(user);
      updateUser(user);
    }).catch(cause => { if (!controller.signal.aborted) setError(apiError(cause).message); });
    return () => controller.abort();
  }, [attempt, updateUser]);
  return <DashboardLayout title="Your profile">
    <section className="dashboard-welcome profile-welcome"><p className="eyebrow">A home starts with the people in it</p><h1>A little more<br /><em>like you.</em></h1><p>Introduce yourself, in your own words. The little details make a difference.</p></section>
    {!profileUser ? <div className="profile-loading">{error ? <><p className="form-message form-message-error" role="alert">{error}</p><Button onClick={() => { setError(''); setAttempt(value => value + 1); }}>Try again</Button></> : <LoadingState label="Getting your profile…" />}</div> : <ProfileForm initialUser={profileUser} />}
  </DashboardLayout>;
}

function ProfileForm({ initialUser }: { initialUser: User }) {
  const { updateUser } = useAuth();
  const [values, setValues] = useState(() => formValues(initialUser));
  const [savedValues, setSavedValues] = useState(() => formValues(initialUser));
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(values) !== JSON.stringify(savedValues);

  function update(field: keyof ProfileValues, value: string) {
    setValues(previous => ({ ...previous, [field]: value }));
    setErrors(previous => ({ ...previous, [field]: undefined }));
    setSaved(false);
    setError('');
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !dirty) return;
    const nextErrors = validateProfile(values);
    setErrors(nextErrors);
    setError('');
    setSaved(false);
    if (Object.keys(nextErrors).length) {
      document.getElementById(`profile-${Object.keys(nextErrors)[0]}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      const user = await profileService.update({
        name: values.name.trim(),
        profile: {
          city: values.city.trim(), occupation: values.occupation.trim(), bio: values.bio.trim(),
          profilePhotoUrl: values.profilePhotoUrl.trim(), age: values.age ? Number(values.age) : null,
          moveInDate: values.moveInDate || null,
        },
      });
      updateUser(user);
      const nextValues = formValues(user);
      setValues(nextValues);
      setSavedValues(nextValues);
      setSaved(true);
    } catch (cause) {
      const failure = apiError(cause);
      setError(failure.message);
      setErrors(failure.fields ?? {});
    } finally { setBusy(false); }
  }

  return <form className="profile-form" noValidate onSubmit={save} aria-busy={busy}>
    <div className="profile-identity"><ProfileAvatar large name={savedValues.name} url={savedValues.profilePhotoUrl} /><div><h2>{savedValues.name}</h2><p>{initialUser.email}</p></div><span className="profile-identity-note">Your introduction</span></div>
    <fieldset disabled={busy}>
      <section className="profile-form-section"><div className="profile-section-intro"><p className="eyebrow">01 — The basics</p><h2>Start with the everyday.</h2><p>What should a future roommate know about you?</p></div><div className="profile-fields">
        <FormInput id="profile-name" name="name" label="Your name" autoComplete="name" value={values.name} onChange={event => update('name', event.target.value)} error={errors.name} required maxLength={100} />
        <FormInput id="profile-email" label="Email address" type="email" value={initialUser.email} readOnly hint="Your account email cannot be changed here." />
        <FormInput id="profile-city" name="city" label="City" placeholder="Where are you looking to live?" autoComplete="address-level2" value={values.city} onChange={event => update('city', event.target.value)} error={errors.city} maxLength={100} />
        <FormInput id="profile-occupation" name="occupation" label="Occupation" placeholder="What keeps you busy?" autoComplete="organization-title" value={values.occupation} onChange={event => update('occupation', event.target.value)} error={errors.occupation} maxLength={100} />
        <FormInput id="profile-age" name="age" label="Age" type="number" min={18} max={120} step={1} placeholder="Your age" value={values.age} onChange={event => update('age', event.target.value)} error={errors.age} />
        <FormInput id="profile-moveInDate" name="moveInDate" label="Ideal move-in date" type="date" min="1900-01-01" max="2200-12-31" value={values.moveInDate} onChange={event => update('moveInDate', event.target.value)} error={errors.moveInDate} />
      </div></section>
      <section className="profile-form-section"><div className="profile-section-intro"><p className="eyebrow">02 — A personal touch</p><h2>Let a little you in.</h2><p>A familiar face. A few words. Something beyond an address.</p></div><div>
        <div className="form-field"><label htmlFor="profile-bio">A little about you</label><textarea id="profile-bio" name="bio" rows={5} maxLength={500} placeholder="Your interests, your everyday, and what makes a place feel like home…" value={values.bio} onChange={event => update('bio', event.target.value)} aria-invalid={!!errors.bio} aria-describedby="profile-bio-description" /><p id="profile-bio-description" className={errors.bio ? 'field-error' : 'field-hint'}>{errors.bio || `${values.bio.length} / 500 characters · A short introduction, in your own words.`}</p></div>
        <FormInput id="profile-profilePhotoUrl" name="profilePhotoUrl" label="Profile photo URL" type="url" placeholder="https://example.com/your-photo.jpg" value={values.profilePhotoUrl} onChange={event => update('profilePhotoUrl', event.target.value)} error={errors.profilePhotoUrl} maxLength={2048} hint="Use a public HTTPS image link. Your photo will appear after saving; unavailable images use a profile icon." />
      </div></section>
      <div className="profile-save"><p>Optional details can be left blank.<br />Share what feels like you.</p><Button disabled={busy || !dirty} type="submit">{busy ? <LoadingState label="Saving your profile…" /> : <>Save changes <ArrowRight size={17} /></>}</Button></div>
    </fieldset>
    {error && <p className="form-message form-message-error" role="alert">{error}</p>}
    {saved && <p className="form-message form-message-success" role="status"><Check size={17} /> Your profile is saved. A little more like you.</p>}
  </form>;
}
