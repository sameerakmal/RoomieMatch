import type {
  Cleanliness,
  Guests,
  Noise,
  SleepSchedule,
} from '../../models/RoommatePreferences.js';
import type { MatchingPreferencesInput } from './matchingTypes.js';

export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function circularTimeDifferenceMinutes(timeA: string, timeB: string): number {
  const mA = parseTimeToMinutes(timeA);
  const mB = parseTimeToMinutes(timeB);
  const diff = Math.abs(mA - mB);
  return Math.min(diff, 1440 - diff);
}

interface TimeInterval {
  start: number;
  end: number;
}

export function normalizeDayIntervals(startStr: string, endStr: string): TimeInterval[] {
  const start = parseTimeToMinutes(startStr);
  const end = parseTimeToMinutes(endStr);

  if (start === end) {
    // Zero length or all-day
    return [{ start: 0, end: 1440 }];
  }

  if (start < end) {
    return [{ start, end }];
  }

  // Crosses midnight, e.g. 22:00 (1320) to 08:00 (480)
  return [
    { start, end: 1440 },
    { start: 0, end },
  ];
}

export function calculateQuietHoursOverlapMinutes(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): { overlapMinutes: number; maxDuration: number; ratio: number } {
  const intervalsA = normalizeDayIntervals(startA, endA);
  const intervalsB = normalizeDayIntervals(startB, endB);

  const durationA = intervalsA.reduce((sum, int) => sum + (int.end - int.start), 0);
  const durationB = intervalsB.reduce((sum, int) => sum + (int.end - int.start), 0);
  const maxDuration = Math.max(durationA, durationB, 1);

  let overlapMinutes = 0;
  for (const a of intervalsA) {
    for (const b of intervalsB) {
      const overlapStart = Math.max(a.start, b.start);
      const overlapEnd = Math.min(a.end, b.end);
      if (overlapStart < overlapEnd) {
        overlapMinutes += (overlapEnd - overlapStart);
      }
    }
  }

  const ratio = Math.min(1, overlapMinutes / maxDuration);
  return { overlapMinutes, maxDuration, ratio };
}

// ---------------------------------------------------------------------------
// A. SLEEP AND DAILY ROUTINE SCORER
// ---------------------------------------------------------------------------

export function scoreSleepSchedule(
  sleepA?: SleepSchedule | null,
  sleepB?: SleepSchedule | null,
): number | null {
  if (!sleepA || !sleepB) return null;

  // 1. Bedtime circular difference
  const bedtimeDiff = circularTimeDifferenceMinutes(sleepA.bedtime, sleepB.bedtime);
  let bedtimeScore = 10;
  if (bedtimeDiff <= 30) bedtimeScore = 100;
  else if (bedtimeDiff <= 60) bedtimeScore = 90;
  else if (bedtimeDiff <= 90) bedtimeScore = 80;
  else if (bedtimeDiff <= 120) bedtimeScore = 70;
  else if (bedtimeDiff <= 180) bedtimeScore = 50;
  else if (bedtimeDiff <= 240) bedtimeScore = 35;
  else bedtimeScore = Math.max(10, Math.round(35 * (1 - (bedtimeDiff - 240) / 480)));

  // 2. Wake-up time circular difference
  const wakeDiff = circularTimeDifferenceMinutes(sleepA.wakeUpTime, sleepB.wakeUpTime);
  let wakeScore = 10;
  if (wakeDiff <= 30) wakeScore = 100;
  else if (wakeDiff <= 60) wakeScore = 90;
  else if (wakeDiff <= 90) wakeScore = 80;
  else if (wakeDiff <= 120) wakeScore = 70;
  else if (wakeDiff <= 180) wakeScore = 50;
  else if (wakeDiff <= 240) wakeScore = 35;
  else wakeScore = Math.max(10, Math.round(35 * (1 - (wakeDiff - 240) / 480)));

  // 3. Consistency
  const consistencyOrder: Record<SleepSchedule['consistency'], number> = {
    'very-consistent': 3,
    'somewhat-consistent': 2,
    irregular: 1,
  };
  const cDiff = Math.abs(consistencyOrder[sleepA.consistency] - consistencyOrder[sleepB.consistency]);
  const consistencyScore = cDiff === 0 ? 100 : cDiff === 1 ? 75 : 40;

  // 4. Waking environment
  let wakingEnvScore = 100;
  if (sleepA.wakingEnvironment !== sleepB.wakingEnvironment) {
    // If one wakes up much earlier and needs normal activity while the other is still sleeping, greater penalty
    wakingEnvScore = wakeDiff > 60 ? 55 : 70;
  }

  // 5. Daily routine
  let routineScore = 75;
  if (sleepA.dailyRoutine === sleepB.dailyRoutine) {
    routineScore = 100;
  } else {
    const pair = [sleepA.dailyRoutine, sleepB.dailyRoutine].sort().join(':');
    if (pair === 'remote-worker:working-professional') routineScore = 85;
    else if (pair === 'student:working-professional') routineScore = 75;
    else if (pair === 'remote-worker:student') routineScore = 70;
  }

  // 6. Time at home
  const timeOrder: Record<SleepSchedule['timeAtHome'], number> = {
    'mostly-at-home': 3,
    'partially-at-home': 2,
    'rarely-at-home': 1,
  };
  const tDiff = Math.abs(timeOrder[sleepA.timeAtHome] - timeOrder[sleepB.timeAtHome]);
  const timeScore = tDiff === 0 ? 100 : tDiff === 1 ? 80 : 60;

  const total =
    bedtimeScore * 0.30 +
    wakeScore * 0.30 +
    consistencyScore * 0.15 +
    wakingEnvScore * 0.10 +
    routineScore * 0.10 +
    timeScore * 0.05;

  return Math.min(100, Math.max(0, Math.round(total)));
}

// ---------------------------------------------------------------------------
// B. CLEANLINESS SCORER
// ---------------------------------------------------------------------------

export function scoreCleanliness(
  cleanA?: Cleanliness | null,
  cleanB?: Cleanliness | null,
): number | null {
  if (!cleanA || !cleanB) return null;

  // 1. Cleanliness level (ordinal)
  const levelOrder: Record<Cleanliness['cleanlinessLevel'], number> = {
    'very-organized': 3,
    'moderately-organized': 2,
    relaxed: 1,
  };
  const lDiff = Math.abs(levelOrder[cleanA.cleanlinessLevel] - levelOrder[cleanB.cleanlinessLevel]);
  const levelScore = lDiff === 0 ? 100 : lDiff === 1 ? 75 : 30;

  // 2. Cleaning frequency (ordinal)
  const freqOrder: Record<Cleanliness['cleaningFrequency'], number> = {
    daily: 4,
    'several-times-a-week': 3,
    weekly: 2,
    'as-needed': 1,
  };
  const fDiff = Math.abs(freqOrder[cleanA.cleaningFrequency] - freqOrder[cleanB.cleaningFrequency]);
  const freqScore = fDiff === 0 ? 100 : fDiff === 1 ? 85 : fDiff === 2 ? 55 : 20;

  // 3. Kitchen cleanliness (ordinal)
  const kitchenOrder: Record<Cleanliness['kitchenCleanliness'], number> = {
    'clean-immediately': 3,
    'clean-same-day': 2,
    flexible: 1,
  };
  const kDiff = Math.abs(kitchenOrder[cleanA.kitchenCleanliness] - kitchenOrder[cleanB.kitchenCleanliness]);
  const kitchenScore = kDiff === 0 ? 100 : kDiff === 1 ? 70 : 25;

  // 4. Bathroom cleaning
  let bathScore = 50;
  if (cleanA.bathroomCleaning === cleanB.bathroomCleaning) {
    bathScore = 100;
  } else {
    const pair = [cleanA.bathroomCleaning, cleanB.bathroomCleaning].sort().join(':');
    if (pair === 'alternate-responsibilities:shared-schedule') bathScore = 85;
    else if (pair === 'alternate-responsibilities:individual-responsibility') bathScore = 50;
    else if (pair === 'individual-responsibility:shared-schedule') bathScore = 45;
  }

  // 5. Shared space organization
  const spaceOrder: Record<Cleanliness['sharedSpaceOrganization'], number> = {
    'very-tidy': 3,
    'moderately-tidy': 2,
    relaxed: 1,
  };
  const sDiff = Math.abs(spaceOrder[cleanA.sharedSpaceOrganization] - spaceOrder[cleanB.sharedSpaceOrganization]);
  const spaceScore = sDiff === 0 ? 100 : sDiff === 1 ? 80 : 35;

  const total =
    levelScore * 0.25 +
    freqScore * 0.20 +
    kitchenScore * 0.25 +
    bathScore * 0.15 +
    spaceScore * 0.15;

  return Math.min(100, Math.max(0, Math.round(total)));
}

// ---------------------------------------------------------------------------
// C. NOISE SCORER
// ---------------------------------------------------------------------------

export function scoreNoise(
  noiseA?: Noise | null,
  noiseB?: Noise | null,
): number | null {
  if (!noiseA || !noiseB) return null;

  // 1. Quiet hours overlap
  const { ratio } = calculateQuietHoursOverlapMinutes(
    noiseA.quietHoursStart,
    noiseA.quietHoursEnd,
    noiseB.quietHoursStart,
    noiseB.quietHoursEnd,
  );
  let quietHoursScore = 0;
  if (ratio >= 0.85) quietHoursScore = 100;
  else if (ratio >= 0.65) quietHoursScore = Math.round(75 + 25 * ((ratio - 0.65) / 0.20));
  else if (ratio >= 0.40) quietHoursScore = Math.round(50 + 25 * ((ratio - 0.40) / 0.25));
  else quietHoursScore = Math.round(50 * (ratio / 0.40));

  // 2. Noise tolerance
  const tolOrder: Record<Noise['noiseTolerance'], number> = {
    'very-low': 1,
    moderate: 2,
    high: 3,
  };
  const tolDiff = Math.abs(tolOrder[noiseA.noiseTolerance] - tolOrder[noiseB.noiseTolerance]);
  const tolScore = tolDiff === 0 ? 100 : tolDiff === 1 ? 75 : 40;

  // 3. Music habits
  const musicOrder: Record<Noise['musicHabits'], number> = {
    rarely: 1,
    occasionally: 2,
    frequently: 3,
  };
  const mDiff = Math.abs(musicOrder[noiseA.musicHabits] - musicOrder[noiseB.musicHabits]);
  const musicScore = mDiff === 0 ? 100 : mDiff === 1 ? 75 : 45;

  // 4. Study/Work environment
  let envScore = 70;
  if (noiseA.studyWorkEnvironment === noiseB.studyWorkEnvironment) {
    envScore = 100;
  } else if (noiseA.studyWorkEnvironment === 'doesnt-matter' || noiseB.studyWorkEnvironment === 'doesnt-matter') {
    envScore = 95;
  } else {
    // 'silent' vs 'low-background-noise'
    envScore = 70;
  }

  // 5. Headphone usage
  const headOrder: Record<Noise['headphoneUsage'], number> = {
    always: 4,
    usually: 3,
    sometimes: 2,
    rarely: 1,
  };
  const hDiff = Math.abs(headOrder[noiseA.headphoneUsage] - headOrder[noiseB.headphoneUsage]);
  let headScore = hDiff === 0 ? 100 : hDiff === 1 ? 80 : hDiff === 2 ? 60 : 35;
  // If both are diligent headphone users ('always' or 'usually')
  if (headOrder[noiseA.headphoneUsage] >= 3 && headOrder[noiseB.headphoneUsage] >= 3) {
    headScore = 100;
  }

  const total =
    quietHoursScore * 0.35 +
    tolScore * 0.20 +
    musicScore * 0.15 +
    envScore * 0.15 +
    headScore * 0.15;

  return Math.min(100, Math.max(0, Math.round(total)));
}

// ---------------------------------------------------------------------------
// D. GUESTS AND SOCIAL SCORER
// ---------------------------------------------------------------------------

export function scoreGuests(
  guestsA?: Guests | null,
  guestsB?: Guests | null,
): number | null {
  if (!guestsA || !guestsB) return null;

  // 1. Social lifestyle (complementary scoring)
  let socialScore = 90;
  if (guestsA.socialLifestyle === guestsB.socialLifestyle) {
    socialScore = 95;
  } else if (
    (guestsA.socialLifestyle === 'introverted' && guestsB.socialLifestyle === 'extroverted') ||
    (guestsA.socialLifestyle === 'extroverted' && guestsB.socialLifestyle === 'introverted')
  ) {
    // Introverted and extroverted can coexist well if advance notice & boundaries align
    socialScore = 80;
  }

  // 2. Guest frequency
  const freqOrder: Record<Guests['guestFrequency'], number> = {
    rarely: 1,
    occasionally: 2,
    frequently: 3,
  };
  const gDiff = Math.abs(freqOrder[guestsA.guestFrequency] - freqOrder[guestsB.guestFrequency]);
  const freqScore = gDiff === 0 ? 100 : gDiff === 1 ? 75 : 35;

  // 3. Overnight guests
  const overOrder: Record<Guests['overnightGuests'], number> = {
    'not-comfortable': 1,
    occasionally: 2,
    comfortable: 3,
  };
  const oDiff = Math.abs(overOrder[guestsA.overnightGuests] - overOrder[guestsB.overnightGuests]);
  const overScore = oDiff === 0 ? 100 : oDiff === 1 ? 65 : 25;

  // 4. Advance notice
  const noticeOrder: Record<Guests['advanceNotice'], number> = {
    required: 3,
    preferred: 2,
    'not-necessary': 1,
  };
  const nDiff = Math.abs(noticeOrder[guestsA.advanceNotice] - noticeOrder[guestsB.advanceNotice]);
  const noticeScore = nDiff === 0 ? 100 : nDiff === 1 ? (guestsA.advanceNotice !== 'not-necessary' && guestsB.advanceNotice !== 'not-necessary' ? 90 : 70) : 35;

  // 5. Shared activities
  const actOrder: Record<Guests['sharedActivities'], number> = {
    frequently: 3,
    sometimes: 2,
    'prefer-personal-space': 1,
  };
  const aDiff = Math.abs(actOrder[guestsA.sharedActivities] - actOrder[guestsB.sharedActivities]);
  const actScore = aDiff === 0 ? 100 : aDiff === 1 ? 80 : 50;

  const total =
    freqScore * 0.25 +
    overScore * 0.25 +
    noticeScore * 0.20 +
    socialScore * 0.15 +
    actScore * 0.15;

  return Math.min(100, Math.max(0, Math.round(total)));
}

// ---------------------------------------------------------------------------
// E. OTHER LIFESTYLE PREFERENCES SCORER
// ---------------------------------------------------------------------------

export function scoreLifestyle(
  prefA?: MatchingPreferencesInput | null,
  prefB?: MatchingPreferencesInput | null,
): number | null {
  const budgetA = prefA?.budget;
  const budgetB = prefB?.budget;
  if (!budgetA || !budgetB) return null;

  // 1. Smoking
  let smokeScore = 100;
  if (budgetA.smoking === budgetB.smoking) {
    smokeScore = 100;
  } else if (
    (budgetA.smoking === 'smoke-free-required' && budgetB.smoking === 'non-smokers-only') ||
    (budgetA.smoking === 'non-smokers-only' && budgetB.smoking === 'smoke-free-required')
  ) {
    smokeScore = 100;
  } else if (
    budgetA.smoking === 'comfortable-with-smokers' ||
    budgetB.smoking === 'comfortable-with-smokers'
  ) {
    smokeScore = 80;
  }

  // 2. Alcohol
  let alcoholScore = 100;
  if (budgetA.alcohol === budgetB.alcohol) {
    alcoholScore = 100;
  } else {
    const pair = [budgetA.alcohol, budgetB.alcohol].sort().join(':');
    if (pair === 'no-preference:occasional-acceptable') alcoholScore = 95;
    else if (pair === 'alcohol-free-preferred:occasional-acceptable') alcoholScore = 65;
    else if (pair === 'alcohol-free-preferred:no-preference') alcoholScore = 60;
  }

  // 3. Pets
  let petScore = 100;
  if (budgetA.pets === budgetB.pets) {
    petScore = 100;
  } else {
    const pair = [budgetA.pets, budgetB.pets].sort().join(':');
    if (pair === 'allergic-pet-free:prefer-no-pets') petScore = 95;
    else if (pair === 'comfortable-with-pets:prefer-no-pets') petScore = 70;
    else if (pair === 'allergic-pet-free:comfortable-with-pets') petScore = 55;
  }

  // 4. Food preference
  let foodScore = 100;
  if (budgetA.foodPreference === budgetB.foodPreference || budgetA.foodPreference === 'no-preference' || budgetB.foodPreference === 'no-preference') {
    foodScore = 100;
  } else {
    const pair = [budgetA.foodPreference, budgetB.foodPreference].sort().join(':');
    if (pair === 'vegan:vegetarian') foodScore = 90;
    else if (pair === 'non-vegetarian:vegetarian') foodScore = 65;
    else if (pair === 'non-vegetarian:vegan') foodScore = 55;
  }

  // 5. Food sharing
  let foodShareScore = 100;
  if (budgetA.foodSharing === budgetB.foodSharing || budgetA.foodSharing === 'flexible' || budgetB.foodSharing === 'flexible') {
    foodShareScore = 100;
  } else {
    foodShareScore = 60;
  }

  const dietaryScore = foodScore * 0.6 + foodShareScore * 0.4;

  const total =
    smokeScore * 0.30 +
    alcoholScore * 0.20 +
    petScore * 0.25 +
    dietaryScore * 0.25;

  return Math.min(100, Math.max(0, Math.round(total)));
}
