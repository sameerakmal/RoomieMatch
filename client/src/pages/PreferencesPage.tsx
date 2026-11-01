import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BookmarkCheck,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  Moon,
  Save,
  ShieldAlert,
  Sparkles,
  Users,
  Volume2,
  Wallet,
} from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Button } from '../components/Button';
import { LoadingState } from '../components/LoadingState';
import {
  ChoiceGroup,
  ImportanceToggle,
  PrefSectionCard,
  TimeSelect,
} from '../components/PreferenceControls';
import { apiError } from '../services/api';
import { preferencesService } from '../services/preferences';
import type { QuestionnaireFormValues, RoommatePreferences } from '../types';
import {
  calculateSleepWindow,
  formValuesToPayload,
  formValuesToSectionPayload,
  getLabel,
  initialQuestionnaireValues,
  preferencesToFormValues,
  validateSection,
} from '../utils/preferences';

const SECTIONS = [
  { id: 'sleep', title: 'Sleep & Routine', icon: Moon, desc: 'Your natural rhythms and home hours' },
  { id: 'cleanliness', title: 'Cleanliness', icon: Sparkles, desc: 'Everyday upkeep and shared spaces' },
  { id: 'noise', title: 'Noise & Focus', icon: Volume2, desc: 'Sound, quiet hours, and study style' },
  { id: 'guests', title: 'Social & Guests', icon: Users, desc: 'Hosting, social battery, and boundaries' },
  { id: 'budget', title: 'Budget & Lifestyle', icon: Wallet, desc: 'Rent range, food, smoking, and pets' },
  { id: 'review', title: 'Review & Submit', icon: BookmarkCheck, desc: 'Confirm your answers before saving' },
];

export function PreferencesPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [values, setValues] = useState<QuestionnaireFormValues>(initialQuestionnaireValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [savedPreferences, setSavedPreferences] = useState<RoommatePreferences | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    preferencesService
      .get(controller.signal)
      .then(pref => {
        if (controller.signal.aborted) return;
        if (pref) {
          setSavedPreferences(pref);
          setValues(preferencesToFormValues(pref));
          // If already completed, start at Review step; otherwise at first step
          if (pref.isCompleted) {
            setCurrentStep(5);
          }
        }
      })
      .catch(cause => {
        if (!controller.signal.aborted) setServerError(apiError(cause).message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  function updateValue<K extends keyof QuestionnaireFormValues>(field: K, value: QuestionnaireFormValues[K]) {
    setValues(prev => ({ ...prev, [field]: value }));
    setErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setSuccessMessage('');
    setServerError('');
  }

  const sleepCalc = calculateSleepWindow(values.bedtime, values.wakeUpTime);

  async function handleNext() {
    if (currentStep === 5) {
      await handleFinalSubmit();
      return;
    }

    const stepErrors = validateSection(currentStep, values);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      const firstKey = Object.keys(stepErrors)[0];
      document.getElementById(firstKey)?.focus();
      return;
    }

    setErrors({});
    setSaving(true);
    setServerError('');

    try {
      // Save progress to backend via PATCH
      const sectionPayload = formValuesToSectionPayload(currentStep, values);
      const updated = await preferencesService.patch(sectionPayload);
      setSavedPreferences(updated);
      setSuccessMessage('Progress saved.');
      setCurrentStep(s => Math.min(s + 1, 5));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (cause) {
      setServerError(apiError(cause).message);
    } finally {
      setSaving(false);
    }
  }

  function handlePrev() {
    setErrors({});
    setServerError('');
    setSuccessMessage('');
    setCurrentStep(s => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSaveAndExit() {
    setSaving(true);
    setServerError('');
    try {
      const sectionPayload = formValuesToSectionPayload(currentStep, values);
      await preferencesService.patch(sectionPayload);
      navigate('/dashboard');
    } catch (cause) {
      setServerError(apiError(cause).message);
      setSaving(false);
    }
  }

  async function handleFinalSubmit() {
    setSaving(true);
    setServerError('');
    setSuccessMessage('');

    try {
      const payload = formValuesToPayload(values);
      const updated = await preferencesService.update(payload);
      setSavedPreferences(updated);
      setSuccessMessage('Your roommate preferences are complete and saved!');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (cause) {
      setServerError(apiError(cause).message);
    } finally {
      setSaving(false);
    }
  }

  const completionPercent = Math.round((Math.min(currentStep, 5) / 5) * 100);

  if (loading) {
    return (
      <DashboardLayout title="Roommate preferences">
        <div className="pref-loading-wrap">
          <LoadingState label="Loading your questionnaire…" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Roommate preferences">
      <div className="pref-shell">
        <header className="pref-header">
          <div className="pref-header-top">
            <span className="eyebrow">Phase 3 · Lifestyle & Roommate Preferences</span>
            <span className="pref-progress-tag">
              {currentStep < 5 ? `Step ${currentStep + 1} of 5` : 'Final Review'} · {completionPercent}%
            </span>
          </div>
          <h1>
            {currentStep === 0 && <>Sleep schedule &amp; <em>daily routine.</em></>}
            {currentStep === 1 && <>Cleanliness &amp; <em>shared spaces.</em></>}
            {currentStep === 2 && <>Noise, music &amp; <em>quiet hours.</em></>}
            {currentStep === 3 && <>Guests &amp; <em>social preferences.</em></>}
            {currentStep === 4 && <>Budget &amp; <em>living style.</em></>}
            {currentStep === 5 && <>Review your <em>roommate preferences.</em></>}
          </h1>
          <p className="pref-header-desc">
            {SECTIONS[currentStep].desc}. Be honest about what you love and what you need;
            great roommate matches start with transparent expectations.
          </p>

          {/* Stepper indicator */}
          <nav className="pref-stepper" aria-label="Questionnaire sections">
            {SECTIONS.slice(0, 5).map((section, idx) => {
              const Icon = section.icon;
              const isPast = idx < currentStep;
              const isCurrent = idx === currentStep;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => {
                    if (idx < currentStep || savedPreferences) {
                      setErrors({});
                      setCurrentStep(idx);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                  className={`pref-step-node ${isCurrent ? 'pref-step-current' : ''} ${isPast ? 'pref-step-done' : ''}`}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  <span className="pref-step-node-icon">
                    {isPast ? <Check size={14} /> : <Icon size={14} />}
                  </span>
                  <span className="pref-step-node-label">{section.title}</span>
                </button>
              );
            })}
          </nav>
        </header>

        {serverError && <p className="form-message form-message-error" role="alert">{serverError}</p>}
        {successMessage && (
          <p className="form-message form-message-success" role="status">
            <Check size={16} /> {successMessage}
          </p>
        )}

        <main className="pref-content">
          {/* STEP 0: Sleep Schedule */}
          {currentStep === 0 && (
            <div className="pref-step-pane">
              <PrefSectionCard
                title="Rest & Hours"
                subtitle="When you sleep, how consistent you are, and the morning atmosphere you thrive in"
                badge={
                  <span className={`pref-badge ${sleepCalc.crossesMidnight ? 'pref-badge-olive' : 'pref-badge-terracotta'}`}>
                    <Clock size={12} /> {sleepCalc.description}
                  </span>
                }
              >
                <div className="pref-grid-2">
                  <TimeSelect
                    id="bedtime"
                    label="Typical bedtime"
                    value={values.bedtime}
                    onChange={v => updateValue('bedtime', v)}
                    error={errors.bedtime}
                    hint="24-hour time when you usually wind down"
                  />
                  <TimeSelect
                    id="wakeUpTime"
                    label="Typical wake-up time"
                    value={values.wakeUpTime}
                    onChange={v => updateValue('wakeUpTime', v)}
                    error={errors.wakeUpTime}
                    hint="24-hour time when you typically wake up"
                  />
                </div>

                <ChoiceGroup
                  id="consistency"
                  label="Sleep schedule consistency"
                  name="consistency"
                  value={values.consistency}
                  onChange={v => updateValue('consistency', v)}
                  error={errors.consistency}
                  options={[
                    { value: 'very-consistent', label: 'Very consistent', hint: 'Same bedtime almost every night' },
                    { value: 'somewhat-consistent', label: 'Somewhat consistent', hint: 'Differs by 1–2 hours on weekends' },
                    { value: 'irregular', label: 'Irregular / Shift work', hint: 'Changes frequently or night owl' },
                  ]}
                  columns={3}
                />

                <ChoiceGroup
                  id="wakingEnvironment"
                  label="Preferred waking environment"
                  name="wakingEnvironment"
                  value={values.wakingEnvironment}
                  onChange={v => updateValue('wakingEnvironment', v)}
                  error={errors.wakingEnvironment}
                  options={[
                    { value: 'quiet', label: 'Quiet & gentle', hint: 'I wake easily or need morning calm' },
                    { value: 'normal-activity', label: 'Normal activity is fine', hint: 'Kitchen noise or morning routines don’t bother me' },
                  ]}
                />
              </PrefSectionCard>

              <PrefSectionCard
                title="Daily Occupation & Home Presence"
                subtitle="Helps prospective roommates understand when you share the apartment"
              >
                <ChoiceGroup
                  id="dailyRoutine"
                  label="Your primary daily routine"
                  name="dailyRoutine"
                  value={values.dailyRoutine}
                  onChange={v => updateValue('dailyRoutine', v)}
                  error={errors.dailyRoutine}
                  options={[
                    { value: 'student', label: 'Student', hint: 'College / university schedule' },
                    { value: 'working-professional', label: 'Working professional', hint: 'Standard daytime office hours' },
                    { value: 'remote-worker', label: 'Remote worker (WFH)', hint: 'Primarily working from home during the day' },
                    { value: 'mixed-other', label: 'Mixed / Flexible / Other', hint: 'Freelance, hybrid, or varying days' },
                  ]}
                />

                <ChoiceGroup
                  id="timeAtHome"
                  label="Typical time spent at home"
                  name="timeAtHome"
                  value={values.timeAtHome}
                  onChange={v => updateValue('timeAtHome', v)}
                  error={errors.timeAtHome}
                  options={[
                    { value: 'mostly-at-home', label: 'Mostly at home', hint: 'Spends most evenings & weekends in' },
                    { value: 'partially-at-home', label: 'Partially at home', hint: 'Balanced between home and outside' },
                    { value: 'rarely-at-home', label: 'Rarely at home', hint: 'Out often for work, study, or social life' },
                  ]}
                  columns={3}
                />
              </PrefSectionCard>
            </div>
          )}

          {/* STEP 1: Cleanliness & Organization */}
          {currentStep === 1 && (
            <div className="pref-step-pane">
              <PrefSectionCard
                title="Personal Organization & Cleaning Routine"
                subtitle="How you keep your personal space and approach household chores"
              >
                <ChoiceGroup
                  id="cleanlinessLevel"
                  label="Personal cleanliness level"
                  name="cleanlinessLevel"
                  value={values.cleanlinessLevel}
                  onChange={v => updateValue('cleanlinessLevel', v)}
                  error={errors.cleanlinessLevel}
                  options={[
                    { value: 'very-organized', label: 'Very organized', hint: 'Thorough, neat, everything in its place' },
                    { value: 'moderately-organized', label: 'Moderately organized', hint: 'Generally tidy with occasional lived-in mess' },
                    { value: 'relaxed', label: 'Relaxed / Easygoing', hint: 'Comfortable with everyday clutter' },
                  ]}
                  columns={3}
                />

                <ImportanceToggle
                  label="Is this cleanliness level a strict requirement for your roommate?"
                  value={values.cleanlinessRequirement}
                  onChange={v => updateValue('cleanlinessRequirement', v)}
                  hint="Marking as 'Strict requirement' ensures Phase 4 treats this as a hard boundary."
                />

                <ChoiceGroup
                  id="cleaningFrequency"
                  label="Preferred cleaning frequency"
                  name="cleaningFrequency"
                  value={values.cleaningFrequency}
                  onChange={v => updateValue('cleaningFrequency', v)}
                  error={errors.cleaningFrequency}
                  options={[
                    { value: 'daily', label: 'Daily', hint: 'Quick sweep, wipe downs every day' },
                    { value: 'several-times-a-week', label: 'Several times a week', hint: 'Frequent touch-ups throughout the week' },
                    { value: 'weekly', label: 'Weekly', hint: 'Dedicated cleaning day once a week' },
                    { value: 'as-needed', label: 'As needed', hint: 'Whenever it looks like it needs attention' },
                  ]}
                />
              </PrefSectionCard>

              <PrefSectionCard
                title="Shared Space Expectations"
                subtitle="Kitchen, bathroom, and living room harmony"
              >
                <ChoiceGroup
                  id="kitchenCleanliness"
                  label="Kitchen cleanliness expectations"
                  name="kitchenCleanliness"
                  value={values.kitchenCleanliness}
                  onChange={v => updateValue('kitchenCleanliness', v)}
                  error={errors.kitchenCleanliness}
                  options={[
                    { value: 'clean-immediately', label: 'Clean immediately', hint: 'Dishes washed and counters wiped right after cooking' },
                    { value: 'clean-same-day', label: 'Clean the same day', hint: 'Before going to bed or before morning' },
                    { value: 'flexible', label: 'Flexible', hint: 'Within 24–48 hours is acceptable' },
                  ]}
                  columns={3}
                />

                <ChoiceGroup
                  id="bathroomCleaning"
                  label="Bathroom cleaning expectations"
                  name="bathroomCleaning"
                  value={values.bathroomCleaning}
                  onChange={v => updateValue('bathroomCleaning', v)}
                  error={errors.bathroomCleaning}
                  options={[
                    { value: 'shared-schedule', label: 'Shared schedule', hint: 'Rotated chores on an agreed calendar' },
                    { value: 'alternate-responsibilities', label: 'Alternate responsibilities', hint: 'You clean this week, I clean next week' },
                    { value: 'individual-responsibility', label: 'Individual responsibility', hint: 'Everyone cleans up after themselves' },
                  ]}
                  columns={3}
                />

                <ChoiceGroup
                  id="sharedSpaceOrganization"
                  label="Preferred shared-space organization (living / dining)"
                  name="sharedSpaceOrganization"
                  value={values.sharedSpaceOrganization}
                  onChange={v => updateValue('sharedSpaceOrganization', v)}
                  error={errors.sharedSpaceOrganization}
                  options={[
                    { value: 'very-tidy', label: 'Very tidy', hint: 'No personal items left behind in common rooms' },
                    { value: 'moderately-tidy', label: 'Moderately tidy', hint: 'Some items fine as long as pathways stay clear' },
                    { value: 'relaxed', label: 'Relaxed', hint: 'A lived-in, cozy atmosphere' },
                  ]}
                  columns={3}
                />
              </PrefSectionCard>
            </div>
          )}

          {/* STEP 2: Noise & Environment */}
          {currentStep === 2 && (
            <div className="pref-step-pane">
              <PrefSectionCard
                title="Acoustic Atmosphere & Quiet Hours"
                subtitle="Setting expectations around sound, calls, and study environment"
              >
                <ChoiceGroup
                  id="noiseTolerance"
                  label="General noise tolerance"
                  name="noiseTolerance"
                  value={values.noiseTolerance}
                  onChange={v => updateValue('noiseTolerance', v)}
                  error={errors.noiseTolerance}
                  options={[
                    { value: 'very-low', label: 'Very low', hint: 'Need silence for focus, sensitive to sound' },
                    { value: 'moderate', label: 'Moderate', hint: 'Comfortable with everyday apartment chatter and TV' },
                    { value: 'high', label: 'High', hint: 'Lively atmosphere, music, and gatherings welcome' },
                  ]}
                  columns={3}
                />

                <ImportanceToggle
                  label="Is a quiet living environment a strict requirement?"
                  value={values.quietEnvironmentRequirement}
                  onChange={v => updateValue('quietEnvironmentRequirement', v)}
                  hint="Choose 'Strict requirement' if loud music or late-night chatter is a dealbreaker."
                />

                <div className="pref-grid-2">
                  <TimeSelect
                    id="quietHoursStart"
                    label="Quiet hours start"
                    value={values.quietHoursStart}
                    onChange={v => updateValue('quietHoursStart', v)}
                    error={errors.quietHoursStart}
                    hint="Time after which loud noise should cease"
                  />
                  <TimeSelect
                    id="quietHoursEnd"
                    label="Quiet hours end"
                    value={values.quietHoursEnd}
                    onChange={v => updateValue('quietHoursEnd', v)}
                    error={errors.quietHoursEnd}
                    hint="Morning time when regular activities may resume"
                  />
                </div>
              </PrefSectionCard>

              <PrefSectionCard
                title="Media, Music & Work Habits"
                subtitle="How sound fits into your day"
              >
                <ChoiceGroup
                  id="musicHabits"
                  label="Music habits at home"
                  name="musicHabits"
                  value={values.musicHabits}
                  onChange={v => updateValue('musicHabits', v)}
                  error={errors.musicHabits}
                  options={[
                    { value: 'rarely', label: 'Rarely', hint: 'Almost never play music out loud' },
                    { value: 'occasionally', label: 'Occasionally', hint: 'While cooking or relaxing on weekends' },
                    { value: 'frequently', label: 'Frequently', hint: 'Music is part of my daily routine' },
                  ]}
                  columns={3}
                />

                <ChoiceGroup
                  id="headphoneUsage"
                  label="Headphone usage when listening to audio or calls"
                  name="headphoneUsage"
                  value={values.headphoneUsage}
                  onChange={v => updateValue('headphoneUsage', v)}
                  error={errors.headphoneUsage}
                  options={[
                    { value: 'always', label: 'Always', hint: 'Headphones for all music, videos, and calls' },
                    { value: 'usually', label: 'Usually', hint: 'Headphones for work/calls, low volume speakers occasionally' },
                    { value: 'sometimes', label: 'Sometimes', hint: 'Mix of speakers and headphones' },
                    { value: 'rarely', label: 'Rarely', hint: 'Prefer speakers when inside my room' },
                  ]}
                />

                <ChoiceGroup
                  id="studyWorkEnvironment"
                  label="Preferred study / work environment"
                  name="studyWorkEnvironment"
                  value={values.studyWorkEnvironment}
                  onChange={v => updateValue('studyWorkEnvironment', v)}
                  error={errors.studyWorkEnvironment}
                  options={[
                    { value: 'silent', label: 'Silent', hint: 'Require library-like stillness' },
                    { value: 'low-background-noise', label: 'Low background noise', hint: 'Gentle ambient sound is acceptable' },
                    { value: 'doesnt-matter', label: "Doesn't matter", hint: 'Can focus in active spaces' },
                  ]}
                  columns={3}
                />
              </PrefSectionCard>
            </div>
          )}

          {/* STEP 3: Guests & Social Preferences */}
          {currentStep === 3 && (
            <div className="pref-step-pane">
              <PrefSectionCard
                title="Hosting & Visitors"
                subtitle="Setting clear, comfortable boundaries for visitors"
              >
                <ChoiceGroup
                  id="guestFrequency"
                  label="How frequently do you expect to host guests?"
                  name="guestFrequency"
                  value={values.guestFrequency}
                  onChange={v => updateValue('guestFrequency', v)}
                  error={errors.guestFrequency}
                  options={[
                    { value: 'rarely', label: 'Rarely', hint: 'Few times a year or almost never' },
                    { value: 'occasionally', label: 'Occasionally', hint: 'A couple of times a month' },
                    { value: 'frequently', label: 'Frequently', hint: 'Weekly or regular social gatherings' },
                  ]}
                  columns={3}
                />

                <ChoiceGroup
                  id="overnightGuests"
                  label="Comfort with overnight guests"
                  name="overnightGuests"
                  value={values.overnightGuests}
                  onChange={v => updateValue('overnightGuests', v)}
                  error={errors.overnightGuests}
                  options={[
                    { value: 'not-comfortable', label: 'Not comfortable', hint: 'Prefer no overnight guests in the apartment' },
                    { value: 'occasionally', label: 'Occasionally', hint: 'Acceptable with prior coordination' },
                    { value: 'comfortable', label: 'Comfortable', hint: 'Friends or partners welcome frequently' },
                  ]}
                  columns={3}
                />

                <ImportanceToggle
                  label="Is this overnight guest policy a strict requirement?"
                  value={values.overnightGuestRequirement}
                  onChange={v => updateValue('overnightGuestRequirement', v)}
                  hint="Marking as 'Strict requirement' will prevent matches with roommates who have conflicting visitor habits."
                />

                {/* Conditional helper message if not comfortable */}
                {values.overnightGuests === 'not-comfortable' && (
                  <div className="pref-conditional-note">
                    <ShieldAlert size={16} />
                    <p>
                      <strong>Overnight guests disabled:</strong> You indicated you are not comfortable
                      with overnight guests. Advance notice will apply strictly to daytime and evening visitors.
                    </p>
                  </div>
                )}

                <ChoiceGroup
                  id="advanceNotice"
                  label="Preference for advance notice before guests visit"
                  name="advanceNotice"
                  value={values.advanceNotice}
                  onChange={v => updateValue('advanceNotice', v)}
                  error={errors.advanceNotice}
                  options={[
                    { value: 'required', label: 'Required', hint: 'Always give a heads-up beforehand' },
                    { value: 'preferred', label: 'Preferred', hint: 'A quick text is appreciated' },
                    { value: 'not-necessary', label: 'Not necessary', hint: 'Spontaneous drop-ins are fine' },
                  ]}
                  columns={3}
                />
              </PrefSectionCard>

              <PrefSectionCard
                title="Social Style & Roommate Bonding"
                subtitle="Finding someone with compatible interpersonal energy"
              >
                <ChoiceGroup
                  id="socialLifestyle"
                  label="Your social lifestyle"
                  name="socialLifestyle"
                  value={values.socialLifestyle}
                  onChange={v => updateValue('socialLifestyle', v)}
                  error={errors.socialLifestyle}
                  options={[
                    { value: 'introverted', label: 'Introverted', hint: 'Home is a sanctuary for quiet recovery' },
                    { value: 'balanced', label: 'Balanced', hint: 'Enjoy hanging out, also cherish independent downtime' },
                    { value: 'extroverted', label: 'Extroverted', hint: 'Love lively interactions and being around others' },
                  ]}
                  columns={3}
                />

                <ChoiceGroup
                  id="sharedActivities"
                  label="Preference for shared roommate activities"
                  name="sharedActivities"
                  value={values.sharedActivities}
                  onChange={v => updateValue('sharedActivities', v)}
                  error={errors.sharedActivities}
                  options={[
                    { value: 'frequently', label: 'Frequently', hint: 'Cook together, watch movies, explore the city' },
                    { value: 'sometimes', label: 'Sometimes', hint: 'Casual chat, occasional joint dinners' },
                    { value: 'prefer-personal-space', label: 'Prefer personal space', hint: 'Polite co-existence with privacy' },
                  ]}
                  columns={3}
                />
              </PrefSectionCard>
            </div>
          )}

          {/* STEP 4: Budget & Living Preferences */}
          {currentStep === 4 && (
            <div className="pref-step-pane">
              <PrefSectionCard
                title="Rent Budget & Housing Structure"
                subtitle="Financial boundaries and accommodation formats"
              >
                <div className="pref-grid-2">
                  <div className="form-field">
                    <label htmlFor="minRent">Minimum monthly rent (₹)</label>
                    <input
                      type="number"
                      id="minRent"
                      min={0}
                      max={10000000}
                      step={500}
                      value={values.minRent}
                      onChange={e => updateValue('minRent', e.target.value)}
                      placeholder="e.g. 10000"
                      aria-invalid={!!errors.minRent}
                    />
                    {errors.minRent && <p className="field-error">{errors.minRent}</p>}
                  </div>
                  <div className="form-field">
                    <label htmlFor="maxRent">Maximum monthly rent (₹)</label>
                    <input
                      type="number"
                      id="maxRent"
                      min={0}
                      max={10000000}
                      step={500}
                      value={values.maxRent}
                      onChange={e => updateValue('maxRent', e.target.value)}
                      placeholder="e.g. 25000"
                      aria-invalid={!!errors.maxRent}
                    />
                    {errors.maxRent && <p className="field-error">{errors.maxRent}</p>}
                  </div>
                </div>

                <ChoiceGroup
                  id="accommodationType"
                  label="Preferred accommodation type"
                  name="accommodationType"
                  value={values.accommodationType}
                  onChange={v => updateValue('accommodationType', v)}
                  error={errors.accommodationType}
                  options={[
                    { value: 'apartment', label: 'Apartment / Flat' },
                    { value: 'pg', label: 'Paying Guest (PG)' },
                    { value: 'hostel', label: 'Hostel' },
                    { value: 'shared-house', label: 'Shared House / Villa' },
                    { value: 'no-preference', label: 'No preference' },
                  ]}
                />

                <ChoiceGroup
                  id="roomArrangement"
                  label="Preferred room arrangement"
                  name="roomArrangement"
                  value={values.roomArrangement}
                  onChange={v => updateValue('roomArrangement', v)}
                  error={errors.roomArrangement}
                  options={[
                    { value: 'private-room', label: 'Private room (own bedroom)' },
                    { value: 'shared-room', label: 'Shared room (twin sharing)' },
                    { value: 'no-preference', label: 'No preference' },
                  ]}
                  columns={3}
                />
              </PrefSectionCard>

              <PrefSectionCard
                title="Food & Dietary Preferences"
                subtitle="Respectful dietary coordination"
              >
                <ChoiceGroup
                  id="foodPreference"
                  label="Your food preference"
                  name="foodPreference"
                  value={values.foodPreference}
                  onChange={v => updateValue('foodPreference', v)}
                  error={errors.foodPreference}
                  options={[
                    { value: 'vegetarian', label: 'Vegetarian' },
                    { value: 'non-vegetarian', label: 'Non-vegetarian' },
                    { value: 'vegan', label: 'Vegan' },
                    { value: 'no-preference', label: 'No preference / Omnivore' },
                  ]}
                />

                <ChoiceGroup
                  id="foodSharing"
                  label="Food and grocery sharing"
                  name="foodSharing"
                  value={values.foodSharing}
                  onChange={v => updateValue('foodSharing', v)}
                  error={errors.foodSharing}
                  options={[
                    { value: 'share-groceries', label: 'Share groceries & cooking' },
                    { value: 'separate-groceries', label: 'Keep groceries & cooking separate' },
                    { value: 'flexible', label: 'Flexible / Share staples only' },
                  ]}
                  columns={3}
                />

                <ImportanceToggle
                  label="Is this dietary arrangement a strict requirement?"
                  value={values.dietarySharingRequirement}
                  onChange={v => updateValue('dietarySharingRequirement', v)}
                />
              </PrefSectionCard>

              <PrefSectionCard
                title="Smoking, Alcohol & Pets"
                subtitle="Sensitive living factors handled with care"
              >
                <ChoiceGroup
                  id="smoking"
                  label="Smoking preference"
                  name="smoking"
                  value={values.smoking}
                  onChange={v => updateValue('smoking', v)}
                  error={errors.smoking}
                  options={[
                    { value: 'smoke-free-required', label: 'Smoke-free environment required' },
                    { value: 'non-smokers-only', label: 'Comfortable with non-smokers only' },
                    { value: 'comfortable-with-smokers', label: 'Comfortable with smokers (balcony/outdoors)' },
                  ]}
                />
                <ImportanceToggle
                  label="Is a smoke-free home a strict requirement?"
                  value={values.smokeFreeRequirement}
                  onChange={v => updateValue('smokeFreeRequirement', v)}
                />

                <ChoiceGroup
                  id="alcohol"
                  label="Alcohol preference"
                  name="alcohol"
                  value={values.alcohol}
                  onChange={v => updateValue('alcohol', v)}
                  error={errors.alcohol}
                  options={[
                    { value: 'alcohol-free-preferred', label: 'Prefer alcohol-free environment' },
                    { value: 'occasional-acceptable', label: 'Occasional social use acceptable' },
                    { value: 'no-preference', label: 'No preference' },
                  ]}
                  columns={3}
                />
                <ImportanceToggle
                  label="Is an alcohol-free home a strict requirement?"
                  value={values.alcoholFreeRequirement}
                  onChange={v => updateValue('alcoholFreeRequirement', v)}
                />

                <ChoiceGroup
                  id="pets"
                  label="Pet preference"
                  name="pets"
                  value={values.pets}
                  onChange={v => updateValue('pets', v)}
                  error={errors.pets}
                  options={[
                    { value: 'comfortable-with-pets', label: 'Comfortable with pets' },
                    { value: 'prefer-no-pets', label: 'Prefer no pets' },
                    { value: 'allergic-pet-free', label: 'Allergic / require pet-free accommodation' },
                  ]}
                  columns={3}
                />
                <ImportanceToggle
                  label="Is pet-free accommodation a strict requirement?"
                  value={values.petFreeRequirement}
                  onChange={v => updateValue('petFreeRequirement', v)}
                />
              </PrefSectionCard>
            </div>
          )}

          {/* STEP 5: Review & Submit */}
          {currentStep === 5 && (
            <div className="pref-review-pane">
              <div className="pref-review-banner">
                <CheckCircle2 size={24} className="pref-review-banner-icon" />
                <div>
                  <h3>Ready for submission</h3>
                  <p>
                    Take a moment to review your answers. You can click <strong>Edit</strong> on any section
                    to make adjustments before finalizing.
                  </p>
                </div>
              </div>

              {/* Section 1 Card */}
              <div className="pref-review-card">
                <div className="pref-review-card-head">
                  <div className="pref-review-card-title">
                    <Moon size={18} />
                    <h4>1. Sleep Schedule &amp; Daily Routine</h4>
                  </div>
                  <button type="button" onClick={() => setCurrentStep(0)} className="pref-edit-btn">
                    <Edit3 size={13} /> Edit
                  </button>
                </div>
                <div className="pref-review-items">
                  <div className="pref-review-item">
                    <span>Bedtime &amp; Wake-up</span>
                    <strong>{values.bedtime} – {values.wakeUpTime} ({sleepCalc.description})</strong>
                  </div>
                  <div className="pref-review-item">
                    <span>Consistency</span>
                    <strong>{getLabel(values.consistency)}</strong>
                  </div>
                  <div className="pref-review-item">
                    <span>Waking Environment</span>
                    <strong>{getLabel(values.wakingEnvironment)}</strong>
                  </div>
                  <div className="pref-review-item">
                    <span>Daily Routine</span>
                    <strong>{getLabel(values.dailyRoutine)}</strong>
                  </div>
                  <div className="pref-review-item">
                    <span>Time at Home</span>
                    <strong>{getLabel(values.timeAtHome)}</strong>
                  </div>
                </div>
              </div>

              {/* Section 2 Card */}
              <div className="pref-review-card">
                <div className="pref-review-card-head">
                  <div className="pref-review-card-title">
                    <Sparkles size={18} />
                    <h4>2. Cleanliness &amp; Organization</h4>
                  </div>
                  <button type="button" onClick={() => setCurrentStep(1)} className="pref-edit-btn">
                    <Edit3 size={13} /> Edit
                  </button>
                </div>
                <div className="pref-review-items">
                  <div className="pref-review-item">
                    <span>Cleanliness Level</span>
                    <strong>
                      {getLabel(values.cleanlinessLevel)}
                      {values.cleanlinessRequirement === 'required' && (
                        <span className="pref-req-tag"><ShieldAlert size={10} /> Strict requirement</span>
                      )}
                    </strong>
                  </div>
                  <div className="pref-review-item">
                    <span>Cleaning Frequency</span>
                    <strong>{getLabel(values.cleaningFrequency)}</strong>
                  </div>
                  <div className="pref-review-item">
                    <span>Kitchen Expectation</span>
                    <strong>{getLabel(values.kitchenCleanliness)}</strong>
                  </div>
                  <div className="pref-review-item">
                    <span>Bathroom Routine</span>
                    <strong>{getLabel(values.bathroomCleaning)}</strong>
                  </div>
                  <div className="pref-review-item">
                    <span>Common Spaces</span>
                    <strong>{getLabel(values.sharedSpaceOrganization)}</strong>
                  </div>
                </div>
              </div>

              {/* Section 3 Card */}
              <div className="pref-review-card">
                <div className="pref-review-card-head">
                  <div className="pref-review-card-title">
                    <Volume2 size={18} />
                    <h4>3. Noise &amp; Focus</h4>
                  </div>
                  <button type="button" onClick={() => setCurrentStep(2)} className="pref-edit-btn">
                    <Edit3 size={13} /> Edit
                  </button>
                </div>
                <div className="pref-review-items">
                  <div className="pref-review-item">
                    <span>Noise Tolerance</span>
                    <strong>
                      {getLabel(values.noiseTolerance)}
                      {values.quietEnvironmentRequirement === 'required' && (
                        <span className="pref-req-tag"><ShieldAlert size={10} /> Strict requirement</span>
                      )}
                    </strong>
                  </div>
                  <div className="pref-review-item">
                    <span>Quiet Hours</span>
                    <strong>{values.quietHoursStart} – {values.quietHoursEnd}</strong>
                  </div>
                  <div className="pref-review-item">
                    <span>Music Habits</span>
                    <strong>{getLabel(values.musicHabits)}</strong>
                  </div>
                  <div className="pref-review-item">
                    <span>Headphones Usage</span>
                    <strong>{getLabel(values.headphoneUsage)}</strong>
                  </div>
                  <div className="pref-review-item">
                    <span>Study/Work Space</span>
                    <strong>{getLabel(values.studyWorkEnvironment)}</strong>
                  </div>
                </div>
              </div>

              {/* Section 4 Card */}
              <div className="pref-review-card">
                <div className="pref-review-card-head">
                  <div className="pref-review-card-title">
                    <Users size={18} />
                    <h4>4. Guests &amp; Social Preferences</h4>
                  </div>
                  <button type="button" onClick={() => setCurrentStep(3)} className="pref-edit-btn">
                    <Edit3 size={13} /> Edit
                  </button>
                </div>
                <div className="pref-review-items">
                  <div className="pref-review-item">
                    <span>Guest Frequency</span>
                    <strong>{getLabel(values.guestFrequency)}</strong>
                  </div>
                  <div className="pref-review-item">
                    <span>Overnight Guests</span>
                    <strong>
                      {getLabel(values.overnightGuests)}
                      {values.overnightGuestRequirement === 'required' && (
                        <span className="pref-req-tag"><ShieldAlert size={10} /> Strict requirement</span>
                      )}
                    </strong>
                  </div>
                  <div className="pref-review-item">
                    <span>Advance Notice</span>
                    <strong>{getLabel(values.advanceNotice)}</strong>
                  </div>
                  <div className="pref-review-item">
                    <span>Social Lifestyle</span>
                    <strong>{getLabel(values.socialLifestyle)}</strong>
                  </div>
                  <div className="pref-review-item">
                    <span>Shared Activities</span>
                    <strong>{getLabel(values.sharedActivities)}</strong>
                  </div>
                </div>
              </div>

              {/* Section 5 Card */}
              <div className="pref-review-card">
                <div className="pref-review-card-head">
                  <div className="pref-review-card-title">
                    <Wallet size={18} />
                    <h4>5. Budget &amp; Living Preferences</h4>
                  </div>
                  <button type="button" onClick={() => setCurrentStep(4)} className="pref-edit-btn">
                    <Edit3 size={13} /> Edit
                  </button>
                </div>
                <div className="pref-review-items">
                  <div className="pref-review-item">
                    <span>Rent Budget</span>
                    <strong>₹{Number(values.minRent).toLocaleString()} – ₹{Number(values.maxRent).toLocaleString()} / month</strong>
                  </div>
                  <div className="pref-review-item">
                    <span>Accommodation Type</span>
                    <strong>{getLabel(values.accommodationType)}</strong>
                  </div>
                  <div className="pref-review-item">
                    <span>Room Arrangement</span>
                    <strong>{getLabel(values.roomArrangement)}</strong>
                  </div>
                  <div className="pref-review-item">
                    <span>Food Preference</span>
                    <strong>{getLabel(values.foodPreference)}</strong>
                  </div>
                  <div className="pref-review-item">
                    <span>Food Sharing</span>
                    <strong>{getLabel(values.foodSharing)}</strong>
                  </div>
                  <div className="pref-review-item">
                    <span>Smoking</span>
                    <strong>
                      {getLabel(values.smoking)}
                      {values.smokeFreeRequirement === 'required' && (
                        <span className="pref-req-tag"><ShieldAlert size={10} /> Strict requirement</span>
                      )}
                    </strong>
                  </div>
                  <div className="pref-review-item">
                    <span>Alcohol</span>
                    <strong>{getLabel(values.alcohol)}</strong>
                  </div>
                  <div className="pref-review-item">
                    <span>Pets</span>
                    <strong>
                      {getLabel(values.pets)}
                      {values.petFreeRequirement === 'required' && (
                        <span className="pref-req-tag"><ShieldAlert size={10} /> Strict requirement</span>
                      )}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Footer controls */}
        <footer className="pref-footer">
          <div className="pref-footer-left">
            {currentStep > 0 && (
              <Button variant="secondary" onClick={handlePrev} disabled={saving}>
                <ArrowLeft size={16} /> Previous
              </Button>
            )}
            <Button variant="text" onClick={handleSaveAndExit} disabled={saving} className="pref-exit-btn">
              <Save size={14} /> Save draft &amp; exit
            </Button>
          </div>

          <div className="pref-footer-right">
            {currentStep < 5 ? (
              <Button onClick={handleNext} disabled={saving}>
                {saving ? (
                  <LoadingState label="Saving step…" />
                ) : (
                  <>
                    Save &amp; Continue <ArrowRight size={16} />
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={handleFinalSubmit} disabled={saving}>
                {saving ? (
                  <LoadingState label="Submitting preferences…" />
                ) : (
                  <>
                    Submit &amp; Save Preferences <Check size={16} />
                  </>
                )}
              </Button>
            )}
          </div>
        </footer>
      </div>
    </DashboardLayout>
  );
}
