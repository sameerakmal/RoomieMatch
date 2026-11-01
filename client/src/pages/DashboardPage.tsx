import { useEffect, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock,
  Compass,
  House,
  Inbox,
  Moon,
  Send,
  Sparkles,
  UserCheck,
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
import { connectionsService } from '../services/connections';
import { getLabel } from '../utils/preferences';
import type { ConnectionSummary, PreferencesStatus, RoommatePreferences } from '../types';
import quietCorner from '../assets/quiet-corner.jpg';

export function DashboardPage() {
  const { user } = useAuth();
  const currentUser = user!;
  const progress = profileCompletion(currentUser);
  const { profile } = currentUser;

  const [preferences, setPreferences] = useState<RoommatePreferences | null>(null);
  const [prefStatus, setPrefStatus] = useState<PreferencesStatus | null>(null);
  const [connSummary, setConnSummary] = useState<ConnectionSummary | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      preferencesService.get(controller.signal),
      preferencesService.getStatus(controller.signal),
      connectionsService.getSummary(controller.signal),
    ])
      .then(([prefData, statusData, summaryData]) => {
        if (controller.signal.aborted) return;
        setPreferences(prefData);
        setPrefStatus(statusData);
        setConnSummary(summaryData);
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

      {/* Section 03: Roommate Networking & Connections */}
      <section id="connections" className="dashboard-networking-section">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">03 — Your roommate network</p>
            <h2>Connections &amp; networking</h2>
          </div>
          <div className="section-nav-links">
            <ButtonLink to="/requests" variant="secondary" className="dashboard-summary-edit-btn">
              Incoming requests ({connSummary?.incomingPendingCount ?? 0})
            </ButtonLink>
            <ButtonLink to="/connections" variant="secondary" className="dashboard-summary-edit-btn">
              All connections ({connSummary?.acceptedCount ?? 0})
            </ButtonLink>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="dashboard-networking-grid">
          <div className="dashboard-stat-card">
            <div className="stat-head">
              <Inbox size={18} className="olive" />
              <span>Incoming requests</span>
            </div>
            <strong className="stat-value">{connSummary?.incomingPendingCount ?? 0}</strong>
            <p className="stat-sub">
              {connSummary?.incomingPendingCount === 1
                ? '1 candidate waiting for your reply'
                : `${connSummary?.incomingPendingCount ?? 0} candidates waiting for your reply`}
            </p>
            <ButtonLink to="/requests" variant="text" className="stat-link">
              Review received requests <ArrowUpRight size={15} />
            </ButtonLink>
          </div>

          <div className="dashboard-stat-card">
            <div className="stat-head">
              <Send size={18} className="olive" />
              <span>Sent requests</span>
            </div>
            <strong className="stat-value">{connSummary?.outgoingPendingCount ?? 0}</strong>
            <p className="stat-sub">
              {connSummary?.outgoingPendingCount === 1
                ? '1 pending request awaiting candidate response'
                : `${connSummary?.outgoingPendingCount ?? 0} pending requests awaiting responses`}
            </p>
            <ButtonLink to="/requests/sent" variant="text" className="stat-link">
              View sent requests <ArrowUpRight size={15} />
            </ButtonLink>
          </div>

          <div className="dashboard-stat-card">
            <div className="stat-head">
              <UserCheck size={18} className="olive" />
              <span>Accepted connections</span>
            </div>
            <strong className="stat-value">{connSummary?.acceptedCount ?? 0}</strong>
            <p className="stat-sub">
              {connSummary?.acceptedCount === 1
                ? '1 mutual roommate connection'
                : `${connSummary?.acceptedCount ?? 0} mutual roommate connections`}
            </p>
            <ButtonLink to="/connections" variant="text" className="stat-link">
              View my connections <ArrowUpRight size={15} />
            </ButtonLink>
          </div>
        </div>

        {/* Recent Connection Activity */}
        <div className="dashboard-activity-block">
          <div className="activity-heading">
            <Clock size={16} />
            <h3>Recent networking activity</h3>
          </div>
          {connSummary?.recentActivity && connSummary.recentActivity.length > 0 ? (
            <ul className="dashboard-activity-list">
              {connSummary.recentActivity.map((act) => (
                <li key={act.id} className="activity-item">
                  <div className="activity-icon-bubble">
                    {act.status === 'accepted' ? (
                      <UserCheck size={15} className="olive" />
                    ) : act.direction === 'sent' ? (
                      <Send size={15} className="terracotta" />
                    ) : (
                      <Inbox size={15} className="olive" />
                    )}
                  </div>
                  <div className="activity-info">
                    <p className="activity-title">
                      {act.status === 'accepted' ? (
                        <>Connected with <strong>{act.otherUser?.name || 'Candidate'}</strong></>
                      ) : act.status === 'rejected' ? (
                        <>Declined request with <strong>{act.otherUser?.name || 'Candidate'}</strong></>
                      ) : act.status === 'cancelled' ? (
                        <>Cancelled request to <strong>{act.otherUser?.name || 'Candidate'}</strong></>
                      ) : act.direction === 'sent' ? (
                        <>Sent connection request to <strong>{act.otherUser?.name || 'Candidate'}</strong></>
                      ) : (
                        <>Received connection request from <strong>{act.otherUser?.name || 'Candidate'}</strong></>
                      )}
                    </p>
                    {act.message && <p className="activity-message">“{act.message}”</p>}
                    <span className="activity-time">
                      {new Date(act.timestamp).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="activity-action">
                    {act.status === 'accepted' ? (
                      <ButtonLink to={`/connections/${act.id}`} variant="text">
                        View <ArrowRight size={14} />
                      </ButtonLink>
                    ) : act.direction === 'received' && act.status === 'pending' ? (
                      <ButtonLink to="/requests" variant="text">
                        Respond <ArrowRight size={14} />
                      </ButtonLink>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="activity-empty">No connection activity yet. Send requests from Roommate Discovery to get started.</p>
          )}
        </div>
      </section>

      {/* Discovery entry point */}
      <section id="recommendations" className="recommendations-section">
        <div className="recommendations-heading">
          <h2>Your kind of people</h2>
          <span>Roommate discovery</span>
        </div>
        {isPrefComplete ? (
          <div className="recommendations-active">
            <div className="active-icon">
              <Compass size={36} strokeWidth={1.2} />
            </div>
            <h3>Your questionnaire is complete and ready.</h3>
            <p>
              Our compatibility matching engine is active. Explore roommates who match your daily rhythms, cleanliness expectations, sound boundaries, and budget.
            </p>
            <ButtonLink to="/discover" variant="primary">
              Explore compatible roommates <ArrowUpRight size={16} />
            </ButtonLink>
          </div>
        ) : (
          <div className="recommendations-empty">
            <div className="empty-icon">
              <House size={36} strokeWidth={1.1} />
            </div>
            <h3>Room for a great connection.</h3>
            <p>
              Roommate discovery requires your lifestyle questionnaire. Complete all five sections
              so our matching algorithm can recommend candidates with compatible daily habits and mutual living requirements.
            </p>
            <ButtonLink to="/preferences" variant="secondary">
              Complete questionnaire <ArrowUpRight size={16} />
            </ButtonLink>
          </div>
        )}
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
