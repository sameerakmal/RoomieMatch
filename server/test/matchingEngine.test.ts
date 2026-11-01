import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RoommatePreferencesRecord } from '../src/models/RoommatePreferences.js';
import {
  circularTimeDifferenceMinutes,
  calculateQuietHoursOverlapMinutes,
  scoreSleepSchedule,
  scoreCleanliness,
  scoreNoise,
  scoreGuests,
  scoreLifestyle,
} from '../src/services/matching/categoryScorers.js';
import {
  calculateRentOverlap,
  scoreAccommodationType,
  scoreBudgetAndAccommodation,
} from '../src/services/matching/budgetScorer.js';
import {
  evaluateHardConstraints,
} from '../src/services/matching/constraintEvaluator.js';
import { calculateCompatibility } from '../src/services/matching/matchingEngine.js';

const basePrefsA: RoommatePreferencesRecord = {
  userId: '654321654321654321654321' as any,
  isCompleted: true,
  completedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  sleepSchedule: {
    bedtime: '23:00',
    wakeUpTime: '07:00',
    consistency: 'very-consistent',
    wakingEnvironment: 'quiet',
    dailyRoutine: 'working-professional',
    timeAtHome: 'partially-at-home',
  },
  cleanliness: {
    cleanlinessLevel: 'very-organized',
    cleaningFrequency: 'daily',
    kitchenCleanliness: 'clean-immediately',
    bathroomCleaning: 'shared-schedule',
    sharedSpaceOrganization: 'very-tidy',
  },
  noise: {
    noiseTolerance: 'moderate',
    musicHabits: 'rarely',
    studyWorkEnvironment: 'silent',
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    headphoneUsage: 'always',
  },
  guests: {
    guestFrequency: 'rarely',
    overnightGuests: 'not-comfortable',
    advanceNotice: 'required',
    socialLifestyle: 'introverted',
    sharedActivities: 'sometimes',
  },
  budget: {
    minRent: 12000,
    maxRent: 20000,
    accommodationType: 'apartment',
    foodPreference: 'vegetarian',
    foodSharing: 'flexible',
    smoking: 'smoke-free-required',
    alcohol: 'alcohol-free-preferred',
    pets: 'prefer-no-pets',
    roomArrangement: 'private-room',
  },
  requirements: {
    quietEnvironment: 'preferred',
    smokeFree: 'required',
    petFree: 'preferred',
    alcoholFree: 'preferred',
    cleanlinessLevel: 'preferred',
    overnightGuestPolicy: 'preferred',
    dietarySharing: 'preferred',
  },
};

const basePrefsB: RoommatePreferencesRecord = {
  userId: '123456123456123456123456' as any,
  isCompleted: true,
  completedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  sleepSchedule: {
    bedtime: '23:30',
    wakeUpTime: '07:30',
    consistency: 'very-consistent',
    wakingEnvironment: 'quiet',
    dailyRoutine: 'working-professional',
    timeAtHome: 'partially-at-home',
  },
  cleanliness: {
    cleanlinessLevel: 'very-organized',
    cleaningFrequency: 'several-times-a-week',
    kitchenCleanliness: 'clean-immediately',
    bathroomCleaning: 'shared-schedule',
    sharedSpaceOrganization: 'very-tidy',
  },
  noise: {
    noiseTolerance: 'moderate',
    musicHabits: 'rarely',
    studyWorkEnvironment: 'silent',
    quietHoursStart: '23:00',
    quietHoursEnd: '07:00',
    headphoneUsage: 'always',
  },
  guests: {
    guestFrequency: 'rarely',
    overnightGuests: 'not-comfortable',
    advanceNotice: 'required',
    socialLifestyle: 'balanced',
    sharedActivities: 'sometimes',
  },
  budget: {
    minRent: 15000,
    maxRent: 25000,
    accommodationType: 'apartment',
    foodPreference: 'vegetarian',
    foodSharing: 'flexible',
    smoking: 'smoke-free-required',
    alcohol: 'alcohol-free-preferred',
    pets: 'prefer-no-pets',
    roomArrangement: 'private-room',
  },
  requirements: {
    quietEnvironment: 'preferred',
    smokeFree: 'required',
    petFree: 'preferred',
    alcoholFree: 'preferred',
    cleanlinessLevel: 'preferred',
    overnightGuestPolicy: 'preferred',
    dietarySharing: 'preferred',
  },
};

// ---------------------------------------------------------------------------
// 1. SLEEP SCORING TESTS
// ---------------------------------------------------------------------------

test('Sleep: circular time difference handles midnight correctly', () => {
  // 23:30 (1410 min) to 00:30 (30 min) is 60 minutes apart, NOT 23.5 hours
  const diff = circularTimeDifferenceMinutes('23:30', '00:30');
  assert.equal(diff, 60);

  const diff2 = circularTimeDifferenceMinutes('00:15', '23:45');
  assert.equal(diff2, 30);
});

test('Sleep: identical schedules yield high score (>= 95)', () => {
  const score = scoreSleepSchedule(basePrefsA.sleepSchedule, basePrefsA.sleepSchedule);
  assert.ok(score !== null);
  assert.ok(score >= 98);
});

test('Sleep: small bedtime differences (30-60 mins) yield high scores', () => {
  const score = scoreSleepSchedule(basePrefsA.sleepSchedule, basePrefsB.sleepSchedule);
  assert.ok(score !== null);
  assert.ok(score >= 88);
});

test('Sleep: large schedule differences receive low score', () => {
  const nightOwl = {
    ...basePrefsA.sleepSchedule!,
    bedtime: '04:00',
    wakeUpTime: '13:00',
    consistency: 'irregular' as const,
    wakingEnvironment: 'normal-activity' as const,
  };
  const score = scoreSleepSchedule(basePrefsA.sleepSchedule, nightOwl);
  assert.ok(score !== null);
  assert.ok(score < 50);
});

test('Sleep: missing sleep data returns null', () => {
  const score = scoreSleepSchedule(null, basePrefsA.sleepSchedule);
  assert.equal(score, null);
});

// ---------------------------------------------------------------------------
// 2. CLEANLINESS SCORING TESTS
// ---------------------------------------------------------------------------

test('Cleanliness: identical expectations yield 100', () => {
  const score = scoreCleanliness(basePrefsA.cleanliness, basePrefsA.cleanliness);
  assert.equal(score, 100);
});

test('Cleanliness: daily vs several-times-a-week cleaning is highly compatible (>= 90)', () => {
  const cleanDaily = { ...basePrefsA.cleanliness!, cleaningFrequency: 'daily' as const };
  const cleanSeveral = { ...basePrefsA.cleanliness!, cleaningFrequency: 'several-times-a-week' as const };
  const score = scoreCleanliness(cleanDaily, cleanSeveral);
  assert.ok(score !== null);
  assert.ok(score >= 90);
});

test('Cleanliness: conflicting kitchen expectations (clean-immediately vs flexible) receive low score', () => {
  const cleanImmediate = { ...basePrefsA.cleanliness!, kitchenCleanliness: 'clean-immediately' as const };
  const cleanFlexible = { ...basePrefsA.cleanliness!, kitchenCleanliness: 'flexible' as const };
  const score = scoreCleanliness(cleanImmediate, cleanFlexible);
  assert.ok(score !== null);
  assert.ok(score < 85);
});

test('Cleanliness: shared bathroom responsibilities align positively', () => {
  const shared = { ...basePrefsA.cleanliness!, bathroomCleaning: 'shared-schedule' as const };
  const alternate = { ...basePrefsA.cleanliness!, bathroomCleaning: 'alternate-responsibilities' as const };
  const indiv = { ...basePrefsA.cleanliness!, bathroomCleaning: 'individual-responsibility' as const };

  const scoreSharedAlternate = scoreCleanliness(shared, alternate);
  const scoreSharedIndiv = scoreCleanliness(shared, indiv);
  assert.ok(scoreSharedAlternate! > scoreSharedIndiv!);
});

// ---------------------------------------------------------------------------
// 3. NOISE SCORING TESTS
// ---------------------------------------------------------------------------

test('Noise: overnight quiet hours overlap is correctly calculated', () => {
  // A: 22:00 to 08:00 (10 hrs = 600 min)
  // B: 23:00 to 07:00 (8 hrs = 480 min)
  // Overlap is 23:00 to 07:00 = 480 min. Ratio = 480/600 = 0.8
  const { overlapMinutes, ratio } = calculateQuietHoursOverlapMinutes('22:00', '08:00', '23:00', '07:00');
  assert.equal(overlapMinutes, 480);
  assert.equal(ratio, 0.8);

  const score = scoreNoise(basePrefsA.noise, basePrefsB.noise);
  assert.ok(score !== null);
  assert.ok(score >= 90);
});

test('Noise: non-overlapping quiet hours produce low score', () => {
  // Day sleeper vs Night sleeper
  const noiseDay = { ...basePrefsA.noise!, quietHoursStart: '10:00', quietHoursEnd: '18:00' };
  const noiseNight = { ...basePrefsA.noise!, quietHoursStart: '23:00', quietHoursEnd: '07:00' };
  const { overlapMinutes } = calculateQuietHoursOverlapMinutes(
    noiseDay.quietHoursStart,
    noiseDay.quietHoursEnd,
    noiseNight.quietHoursStart,
    noiseNight.quietHoursEnd,
  );
  assert.equal(overlapMinutes, 0);

  const score = scoreNoise(noiseDay, noiseNight);
  assert.ok(score !== null);
  assert.ok(score < 70);
});

test('Noise: missing noise data returns null', () => {
  const score = scoreNoise(null, basePrefsA.noise);
  assert.equal(score, null);
});

// ---------------------------------------------------------------------------
// 4. GUESTS SCORING TESTS
// ---------------------------------------------------------------------------

test('Guests: compatible guest expectations yield high score', () => {
  const score = scoreGuests(basePrefsA.guests, basePrefsA.guests);
  assert.ok(score !== null);
  assert.ok(score >= 95);
});

test('Guests: conflicting overnight guest preferences receive lower score', () => {
  const noGuests = { ...basePrefsA.guests!, overnightGuests: 'not-comfortable' as const };
  const comfyGuests = { ...basePrefsA.guests!, overnightGuests: 'comfortable' as const };
  const score = scoreGuests(noGuests, comfyGuests);
  assert.ok(score !== null);
  assert.ok(score < 82);
});

test('Guests: introverted and extroverted with aligned notice boundaries are compatible', () => {
  const introverted = { ...basePrefsA.guests!, socialLifestyle: 'introverted' as const, advanceNotice: 'required' as const };
  const extroverted = { ...basePrefsA.guests!, socialLifestyle: 'extroverted' as const, advanceNotice: 'required' as const };
  const score = scoreGuests(introverted, extroverted);
  assert.ok(score !== null);
  assert.ok(score >= 80);
});

// ---------------------------------------------------------------------------
// 5. BUDGET SCORING TESTS
// ---------------------------------------------------------------------------

test('Budget: prompt example ₹8,000–₹15,000 and ₹12,000–₹18,000 yields high compatibility score', () => {
  const budgetA = { ...basePrefsA.budget!, minRent: 8000, maxRent: 15000 };
  const budgetB = { ...basePrefsB.budget!, minRent: 12000, maxRent: 18000 };

  const { rentScore, overlapResult } = calculateRentOverlap(budgetA, budgetB);
  assert.equal(overlapResult.hasOverlap, true);
  assert.equal(overlapResult.min, 12000);
  assert.equal(overlapResult.max, 15000);
  assert.equal(overlapResult.overlapSpan, 3000);
  assert.ok(rentScore >= 80, `Expected rentScore >= 80, got ${rentScore}`);
});

test('Budget: identical budgets yield 100 rent score', () => {
  const { rentScore, overlapResult } = calculateRentOverlap(basePrefsA.budget!, basePrefsA.budget!);
  assert.equal(overlapResult.hasOverlap, true);
  assert.equal(rentScore, 100);
});

test('Budget: completely non-overlapping budgets with substantial gap yield low score and explain difference', () => {
  const budgetLow = { ...basePrefsA.budget!, minRent: 5000, maxRent: 10000 };
  const budgetHigh = { ...basePrefsB.budget!, minRent: 25000, maxRent: 40000 };

  const { rentScore, overlapResult } = calculateRentOverlap(budgetLow, budgetHigh);
  assert.equal(overlapResult.hasOverlap, false);
  assert.equal(overlapResult.min, null);
  assert.equal(rentScore, 0);
  assert.match(overlapResult.explanation, /No direct budget overlap/);
});

test('Budget: semantic accommodation matching works correctly', () => {
  assert.equal(scoreAccommodationType('apartment', 'apartment'), 100);
  assert.equal(scoreAccommodationType('apartment', 'no-preference'), 100);
  assert.equal(scoreAccommodationType('apartment', 'shared-house'), 80);
  assert.ok(scoreAccommodationType('apartment', 'hostel') < 50);
});

test('Budget: missing budget information returns null score', () => {
  const { score } = scoreBudgetAndAccommodation(null, basePrefsA.budget);
  assert.equal(score, null);
});

// ---------------------------------------------------------------------------
// 6. HARD CONSTRAINT EVALUATION TESTS
// ---------------------------------------------------------------------------

test('Constraints: compatible requirements pass without violations', () => {
  const { hasViolation, constraints } = evaluateHardConstraints(basePrefsA, basePrefsB);
  assert.equal(hasViolation, false);
  const smoke = constraints.find(c => c.id === 'smoke-free');
  assert.ok(smoke);
  assert.equal(smoke.status, 'passed');
});

test('Constraints: one-directional violation fails mutual eligibility', () => {
  const strictCleanUser: RoommatePreferencesRecord = {
    ...basePrefsA,
    cleanliness: { ...basePrefsA.cleanliness!, cleanlinessLevel: 'very-organized' },
    requirements: { ...basePrefsA.requirements!, cleanlinessLevel: 'required' },
  };
  const relaxedCandidate: RoommatePreferencesRecord = {
    ...basePrefsB,
    cleanliness: { ...basePrefsB.cleanliness!, cleanlinessLevel: 'relaxed' },
    requirements: { ...basePrefsB.requirements!, cleanlinessLevel: 'preferred' },
  };

  const { hasViolation, constraints } = evaluateHardConstraints(strictCleanUser, relaxedCandidate);
  assert.equal(hasViolation, true);
  const cleanFail = constraints.find(c => c.id === 'cleanliness-level' && c.status === 'failed');
  assert.ok(cleanFail);
  assert.equal(cleanFail.direction, 'user-to-candidate');
});

test('Constraints: mutual constraint violation is captured', () => {
  const userA: RoommatePreferencesRecord = {
    ...basePrefsA,
    guests: { ...basePrefsA.guests!, overnightGuests: 'not-comfortable' },
    requirements: { ...basePrefsA.requirements!, overnightGuestPolicy: 'required' },
  };
  const userB: RoommatePreferencesRecord = {
    ...basePrefsB,
    guests: { ...basePrefsB.guests!, overnightGuests: 'comfortable' },
    noise: { ...basePrefsB.noise!, musicHabits: 'frequently', headphoneUsage: 'rarely' },
    requirements: { ...basePrefsB.requirements!, quietEnvironment: 'required' },
  };

  const { hasViolation, constraints } = evaluateHardConstraints(userA, userB);
  assert.equal(hasViolation, true);
  const failedConstraints = constraints.filter(c => c.status === 'failed');
  assert.ok(failedConstraints.length >= 1);
});

test('Constraints: unknown status when questionnaire lacks direct habit info (comfortable-with-smokers)', () => {
  const smokeRequiredUser: RoommatePreferencesRecord = {
    ...basePrefsA,
    requirements: { ...basePrefsA.requirements!, smokeFree: 'required' },
  };
  const relaxedSmokingCandidate: RoommatePreferencesRecord = {
    ...basePrefsB,
    budget: { ...basePrefsB.budget!, smoking: 'comfortable-with-smokers' },
  };

  const { hasViolation, constraints } = evaluateHardConstraints(smokeRequiredUser, relaxedSmokingCandidate);
  // Relaxed smoking preference does not prove candidate smokes, so not an automatic fail, but marked unknown
  assert.equal(hasViolation, false);
  const smokeConstraint = constraints.find(c => c.id === 'smoke-free');
  assert.ok(smokeConstraint);
  assert.equal(smokeConstraint.status, 'unknown');
  assert.match(smokeConstraint.explanation, /personal smoking habits are not recorded/i);
});

test('Constraints: preferred conditions do not act as hard exclusions', () => {
  const preferredOnlyUser: RoommatePreferencesRecord = {
    ...basePrefsA,
    cleanliness: { ...basePrefsA.cleanliness!, cleanlinessLevel: 'very-organized' },
    requirements: {
      quietEnvironment: 'preferred',
      smokeFree: 'preferred',
      petFree: 'preferred',
      alcoholFree: 'preferred',
      cleanlinessLevel: 'preferred',
      overnightGuestPolicy: 'preferred',
      dietarySharing: 'preferred',
    },
  };
  const relaxedCandidate: RoommatePreferencesRecord = {
    ...basePrefsB,
    cleanliness: { ...basePrefsB.cleanliness!, cleanlinessLevel: 'relaxed' },
    budget: { ...basePrefsB.budget!, smoking: 'comfortable-with-smokers', pets: 'comfortable-with-pets' },
  };

  const { hasViolation } = evaluateHardConstraints(preferredOnlyUser, relaxedCandidate);
  assert.equal(hasViolation, false);
});

// ---------------------------------------------------------------------------
// 7. OVERALL MATCHING ENGINE TESTS
// ---------------------------------------------------------------------------

test('Engine: identical preferences produce high overall score (>= 95) and 100% coverage', () => {
  const result = calculateCompatibility(basePrefsA, basePrefsA);
  assert.equal(result.dataCoverage, 100);
  assert.equal(result.isEligible, true);
  assert.ok(result.overallScore !== null);
  assert.ok(result.overallScore >= 95, `Expected score >= 95, got ${result.overallScore}`);
  assert.ok(result.strengths.length > 0);
  assert.equal(result.differences.length, 0);
});

test('Engine: missing-data weight renormalization works correctly', () => {
  // Pref B has no sleep schedule (weight 20)
  const prefBNoSleep: RoommatePreferencesRecord = {
    ...basePrefsB,
    sleepSchedule: undefined,
  };

  const result = calculateCompatibility(basePrefsA, prefBNoSleep);
  // Available weights: Cleanliness(20) + Noise(15) + Guests(15) + Budget(20) + Lifestyle(10) = 80
  assert.equal(result.dataCoverage, 80);
  assert.equal(result.categories.sleep.isAvailable, false);
  assert.ok(result.overallScore !== null);
  assert.ok(result.overallScore >= 80);
});

test('Engine: insufficient data (< 50% coverage) yields null overall score', () => {
  // Only lifestyle (10%) and noise (15%) present -> total 25% coverage
  const sparseUser: RoommatePreferencesRecord = {
    ...basePrefsA,
    sleepSchedule: undefined,
    cleanliness: undefined,
    budget: undefined,
    guests: undefined,
  };

  const result = calculateCompatibility(sparseUser, basePrefsB);
  assert.ok(result.dataCoverage < 50);
  assert.equal(result.overallScore, null);
  assert.equal(result.isEligible, false);
  assert.match(result.summary, /Insufficient questionnaire data/);
});

test('Engine: deterministic scoring yields exact same output for identical inputs', () => {
  const result1 = calculateCompatibility(basePrefsA, basePrefsB);
  const result2 = calculateCompatibility(basePrefsA, basePrefsB);
  assert.deepEqual(result1, result2);
});

