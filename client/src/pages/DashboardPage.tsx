import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  House,
  Moon,
  Sparkles,
  UserRound,
  Users,
  Volume2,
  Wallet,
} from 'lucide-react';
import { ButtonLink } from '../components/Button';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useAuth } from '../hooks/useAuth';
import { profileCompletion } from '../utils/profile';
import { preferencesService } from '../services/preferences';
import { getLabel } from '../utils/preferences';
import type { PreferencesStatus, RoommatePreferences } from '../types';
import quietCorner from '../assets/quiet-corner.jpg';

export function DashboardPage() {
  const { user } = useAuth();
  const currentUser = user!;
  const progress = profileCompletion(currentUser);
  const { profile } = currentUser;

  const [preferences, setPreferences] = useState<RoommatePreferences | null>(null);
  const [prefStatus, setPrefStatus] = useState<PreferencesStatus | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      preferencesService.get(controller.signal),
      preferencesService.getStatus(controller.signal),
    ])
      .then(([prefData, statusData]) => {
        if (controller.signal.aborted) return;
        setPreferences(prefData);
        setPrefStatus(statusData);
      })
      .catch(() => {
        // Silently catch to avoid crashing dashboard if offline
      });

    return () => controller.abort();
  }, []);

  const prefPercent = prefStatus?.percent ?? 0;
  const isPrefComplete = prefStatus?.isCompleted ?? false;

  return (
    <DashboardLayout>
      <section className="dashboard-welcome">
        <p className="eyebrow">A fresh start, a familiar feeling</p>
        <h1>
          Make yourself at home,<br />
          <em>{currentUser.name.split(/\s+/)[0]}.</em>
        </h1>
        <p>Here’s where your next chapter will come together.</p>
      </section>

      {/* Section 01: Profile */}
      <section id="profile" className="profile-section">
        <div>
          <p className="eyebrow">01 — Start with you</p>
          <h2>A little introduction <br />goes a long way.</h2>
          <p>
            {progress.percent === 100
              ? 'Your introduction is complete. Keep it feeling like you.'
              : 'Help your future roommates get to know the everyday you.'}
          </p>
          <ButtonLink to="/profile" variant="text">
            {progress.percent === 100 ? 'Edit your profile' : 'Complete your profile'} <ArrowUpRight size={16} />
          </ButtonLink>
        </div>
        <div className="profile-progress">
          <div className="progress-heading">
            <span>Your profile</span>
            <strong>{progress.percent}%</strong>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Profile completion"
            aria-valuenow={progress.percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: `${progress.percent}%` }} />
          </div>
          <p className="completion-detail">{progress.completed} of {progress.total} details added</p>
          <ul>
            <li>
              <UserRound size={16} />
              <span>Your everyday</span>
              <span>{profile.city && profile.occupation && profile.age ? 'Added' : 'Add your details'}</span>
            </li>
            <li>
              <CalendarDays size={16} />
              <span>Move-in date</span>
              <span>{profile.moveInDate ? 'Added' : 'When you’re ready'}</span>
            </li>
            <li>
              <Check size={16} />
              <span>A personal touch</span>
              <span>{profile.bio && profile.profilePhotoUrl ? 'Added' : 'Add a bio & photo'}</span>
            </li>
          </ul>
        </div>
      </section>

      {/* Section 02: Preferences & Lifestyle */}
      <section id="preferences" className="profile-section dashboard-pref-section">
        <div>
          <p className="eyebrow">02 — How you live</p>
          <h2>Roommate preferences <br />&amp; everyday rhythms.</h2>
          <p>
            {isPrefComplete
              ? 'Your preferences are saved and ready for compatibility matching in Phase 4.'
              : prefPercent > 0
              ? `You’ve completed ${prefStatus?.completedSections ?? 0} of 5 sections. Finish up to enable accurate matching.`
              : 'Share your sleep schedule, cleanliness expectations, sound preferences, and budget.'}
          </p>
          <ButtonLink to="/preferences" variant="text">
            {isPrefComplete ? 'Edit your preferences' : prefPercent > 0 ? 'Continue questionnaire' : 'Set your preferences'} <ArrowUpRight size={16} />
          </ButtonLink>
        </div>
        <div className="profile-progress">
          <div className="progress-heading">
            <span>Roommate questionnaire</span>
            <strong>{prefPercent}%</strong>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Preferences completion"
            aria-valuenow={prefPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: `${prefPercent}%` }} />
          </div>
          <p className="completion-detail">
            {isPrefComplete ? 'Questionnaire completed' : `${prefStatus?.completedSections ?? 0} of 5 sections completed`}
          </p>
          <ul>
            <li>
              <Moon size={16} />
              <span>Sleep &amp; routine</span>
              <span>{prefStatus?.sections.sleepSchedule ? 'Completed' : 'Not set'}</span>
            </li>
            <li>
              <Sparkles size={16} />
              <span>Cleanliness</span>
              <span>{prefStatus?.sections.cleanliness ? 'Completed' : 'Not set'}</span>
            </li>
            <li>
              <Volume2 size={16} />
              <span>Noise &amp; focus</span>
              <span>{prefStatus?.sections.noise ? 'Completed' : 'Not set'}</span>
            </li>
            <li>
              <Users size={16} />
              <span>Guests &amp; social</span>
              <span>{prefStatus?.sections.guests ? 'Completed' : 'Not set'}</span>
            </li>
            <li>
              <Wallet size={16} />
              <span>Budget &amp; living</span>
              <span>{prefStatus?.sections.budget ? 'Completed' : 'Not set'}</span>
            </li>
          </ul>
        </div>
      </section>

      {/* Lifestyle Snapshot (if preferences exist) */}
      {preferences && (prefStatus?.completedSections ?? 0) > 0 && (
        <section className="dashboard-summary-section">
          <div className="dashboard-summary-heading">
            <div>
              <p className="eyebrow">Your living snapshot</p>
              <h3>Everyday preferences summary</h3>
            </div>
            <ButtonLink to="/preferences" variant="secondary" className="dashboard-summary-edit-btn">
              Manage responses
            </ButtonLink>
          </div>
          <div className="dashboard-summary-grid">
            {preferences.sleepSchedule && (
              <div className="dashboard-summary-card">
                <div className="dashboard-summary-card-head">
                  <Moon size={16} />
                  <span>Sleep &amp; Routine</span>
                </div>
                <p className="dashboard-summary-main">
                  {preferences.sleepSchedule.bedtime} – {preferences.sleepSchedule.wakeUpTime}
                </p>
                <p className="dashboard-summary-sub">
                  {getLabel(preferences.sleepSchedule.dailyRoutine)} · {getLabel(preferences.sleepSchedule.consistency)}
                </p>
              </div>
            )}

            {preferences.cleanliness && (
              <div className="dashboard-summary-card">
                <div className="dashboard-summary-card-head">
                  <Sparkles size={16} />
                  <span>Cleanliness</span>
                </div>
                <p className="dashboard-summary-main">
                  {getLabel(preferences.cleanliness.cleanlinessLevel)}
                </p>
                <p className="dashboard-summary-sub">
                  {getLabel(preferences.cleanliness.cleaningFrequency)} · Kitchen: {getLabel(preferences.cleanliness.kitchenCleanliness)}
                </p>
              </div>
            )}

            {preferences.noise && (
              <div className="dashboard-summary-card">
                <div className="dashboard-summary-card-head">
                  <Volume2 size={16} />
                  <span>Noise &amp; Focus</span>
                </div>
                <p className="dashboard-summary-main">
                  {getLabel(preferences.noise.noiseTolerance)}
                </p>
                <p className="dashboard-summary-sub">
                  Quiet: {preferences.noise.quietHoursStart}–{preferences.noise.quietHoursEnd} · {getLabel(preferences.noise.headphoneUsage)}
                </p>
              </div>
            )}

            {preferences.guests && (
              <div className="dashboard-summary-card">
                <div className="dashboard-summary-card-head">
                  <Users size={16} />
                  <span>Social &amp; Guests</span>
                </div>
                <p className="dashboard-summary-main">
                  {getLabel(preferences.guests.socialLifestyle)}
                </p>
                <p className="dashboard-summary-sub">
                  Guests: {getLabel(preferences.guests.guestFrequency)} · Overnight: {getLabel(preferences.guests.overnightGuests)}
                </p>
              </div>
            )}

            {preferences.budget && (
              <div className="dashboard-summary-card">
                <div className="dashboard-summary-card-head">
                  <Wallet size={16} />
                  <span>Budget &amp; Housing</span>
                </div>
                <p className="dashboard-summary-main">
                  ₹{preferences.budget.minRent.toLocaleString()} – ₹{preferences.budget.maxRent.toLocaleString()}
                </p>
                <p className="dashboard-summary-sub">
                  {getLabel(preferences.budget.accommodationType)} · {getLabel(preferences.budget.foodPreference)}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Discovery teaser */}
      <section id="recommendations" className="recommendations-section">
        <div className="recommendations-heading">
          <h2>Your kind of people</h2>
          <span>Roommate discovery</span>
        </div>
        <div className="recommendations-empty">
          <div className="empty-icon">
            <House size={36} strokeWidth={1.1} />
          </div>
          <h3>Room for a great connection.</h3>
          <p>
            Roommate discovery and compatibility matching are coming in the next phase. Complete your
            profile and lifestyle questionnaire so our algorithm can pair you with like-minded home companions.
          </p>
          <span className="coming-soon">Phase 4 Compatibility Algorithm coming soon</span>
        </div>
      </section>

      {/* Editorial banner */}
      <section className="dashboard-editorial">
        <img src={quietCorner} alt="A calm, inviting home interior" />
        <div>
          <p className="eyebrow">The RoomieMatch approach</p>
          <h2>Compatibility starts<br />with the everyday.</h2>
          <ButtonLink variant="text" to="/#why-roomiematch">
            Get to know our approach <ArrowUpRight size={17} />
          </ButtonLink>
        </div>
      </section>
    </DashboardLayout>
  );
}
