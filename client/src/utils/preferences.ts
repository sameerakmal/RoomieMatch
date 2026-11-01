import type {
  BudgetData,
  CleanlinessData,
  GuestsData,
  NoiseData,
  QuestionnaireFormValues,
  RequirementsData,
  RoommatePreferences,
  SleepScheduleData,
} from '../types';

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const initialQuestionnaireValues: QuestionnaireFormValues = {
  // Sleep
  bedtime: '23:00',
  wakeUpTime: '07:00',
  consistency: 'very-consistent',
  wakingEnvironment: 'quiet',
  dailyRoutine: 'working-professional',
  timeAtHome: 'partially-at-home',
  // Cleanliness
  cleanlinessLevel: 'very-organized',
  cleaningFrequency: 'weekly',
  kitchenCleanliness: 'clean-same-day',
  bathroomCleaning: 'shared-schedule',
  sharedSpaceOrganization: 'moderately-tidy',
  // Noise
  noiseTolerance: 'moderate',
  musicHabits: 'occasionally',
  studyWorkEnvironment: 'low-background-noise',
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  headphoneUsage: 'usually',
  // Guests
  guestFrequency: 'occasionally',
  overnightGuests: 'occasionally',
  advanceNotice: 'preferred',
  socialLifestyle: 'balanced',
  sharedActivities: 'sometimes',
  // Budget
  minRent: '10000',
  maxRent: '25000',
  accommodationType: 'apartment',
  foodPreference: 'no-preference',
  foodSharing: 'flexible',
  smoking: 'smoke-free-required',
  alcohol: 'occasional-acceptable',
  pets: 'comfortable-with-pets',
  roomArrangement: 'private-room',
  // Requirements
  quietEnvironmentRequirement: 'preferred',
  smokeFreeRequirement: 'required',
  petFreeRequirement: 'preferred',
  alcoholFreeRequirement: 'preferred',
  cleanlinessRequirement: 'preferred',
  overnightGuestRequirement: 'preferred',
  dietarySharingRequirement: 'preferred',
};

export function preferencesToFormValues(pref: RoommatePreferences | null): QuestionnaireFormValues {
  if (!pref) return { ...initialQuestionnaireValues };

  return {
    // Sleep
    bedtime: pref.sleepSchedule?.bedtime ?? initialQuestionnaireValues.bedtime,
    wakeUpTime: pref.sleepSchedule?.wakeUpTime ?? initialQuestionnaireValues.wakeUpTime,
    consistency: pref.sleepSchedule?.consistency ?? initialQuestionnaireValues.consistency,
    wakingEnvironment: pref.sleepSchedule?.wakingEnvironment ?? initialQuestionnaireValues.wakingEnvironment,
    dailyRoutine: pref.sleepSchedule?.dailyRoutine ?? initialQuestionnaireValues.dailyRoutine,
    timeAtHome: pref.sleepSchedule?.timeAtHome ?? initialQuestionnaireValues.timeAtHome,
    // Cleanliness
    cleanlinessLevel: pref.cleanliness?.cleanlinessLevel ?? initialQuestionnaireValues.cleanlinessLevel,
    cleaningFrequency: pref.cleanliness?.cleaningFrequency ?? initialQuestionnaireValues.cleaningFrequency,
    kitchenCleanliness: pref.cleanliness?.kitchenCleanliness ?? initialQuestionnaireValues.kitchenCleanliness,
    bathroomCleaning: pref.cleanliness?.bathroomCleaning ?? initialQuestionnaireValues.bathroomCleaning,
    sharedSpaceOrganization: pref.cleanliness?.sharedSpaceOrganization ?? initialQuestionnaireValues.sharedSpaceOrganization,
    // Noise
    noiseTolerance: pref.noise?.noiseTolerance ?? initialQuestionnaireValues.noiseTolerance,
    musicHabits: pref.noise?.musicHabits ?? initialQuestionnaireValues.musicHabits,
    studyWorkEnvironment: pref.noise?.studyWorkEnvironment ?? initialQuestionnaireValues.studyWorkEnvironment,
    quietHoursStart: pref.noise?.quietHoursStart ?? initialQuestionnaireValues.quietHoursStart,
    quietHoursEnd: pref.noise?.quietHoursEnd ?? initialQuestionnaireValues.quietHoursEnd,
    headphoneUsage: pref.noise?.headphoneUsage ?? initialQuestionnaireValues.headphoneUsage,
    // Guests
    guestFrequency: pref.guests?.guestFrequency ?? initialQuestionnaireValues.guestFrequency,
    overnightGuests: pref.guests?.overnightGuests ?? initialQuestionnaireValues.overnightGuests,
    advanceNotice: pref.guests?.advanceNotice ?? initialQuestionnaireValues.advanceNotice,
    socialLifestyle: pref.guests?.socialLifestyle ?? initialQuestionnaireValues.socialLifestyle,
    sharedActivities: pref.guests?.sharedActivities ?? initialQuestionnaireValues.sharedActivities,
    // Budget
    minRent: pref.budget?.minRent?.toString() ?? initialQuestionnaireValues.minRent,
    maxRent: pref.budget?.maxRent?.toString() ?? initialQuestionnaireValues.maxRent,
    accommodationType: pref.budget?.accommodationType ?? initialQuestionnaireValues.accommodationType,
    foodPreference: pref.budget?.foodPreference ?? initialQuestionnaireValues.foodPreference,
    foodSharing: pref.budget?.foodSharing ?? initialQuestionnaireValues.foodSharing,
    smoking: pref.budget?.smoking ?? initialQuestionnaireValues.smoking,
    alcohol: pref.budget?.alcohol ?? initialQuestionnaireValues.alcohol,
    pets: pref.budget?.pets ?? initialQuestionnaireValues.pets,
    roomArrangement: pref.budget?.roomArrangement ?? initialQuestionnaireValues.roomArrangement,
    // Requirements
    quietEnvironmentRequirement: pref.requirements?.quietEnvironment ?? 'preferred',
    smokeFreeRequirement: pref.requirements?.smokeFree ?? 'required',
    petFreeRequirement: pref.requirements?.petFree ?? 'preferred',
    alcoholFreeRequirement: pref.requirements?.alcoholFree ?? 'preferred',
    cleanlinessRequirement: pref.requirements?.cleanlinessLevel ?? 'preferred',
    overnightGuestRequirement: pref.requirements?.overnightGuestPolicy ?? 'preferred',
    dietarySharingRequirement: pref.requirements?.dietarySharing ?? 'preferred',
  };
}

export function formValuesToPayload(values: QuestionnaireFormValues) {
  const sleepSchedule: SleepScheduleData = {
    bedtime: values.bedtime,
    wakeUpTime: values.wakeUpTime,
    consistency: values.consistency as SleepScheduleData['consistency'],
    wakingEnvironment: values.wakingEnvironment as SleepScheduleData['wakingEnvironment'],
    dailyRoutine: values.dailyRoutine as SleepScheduleData['dailyRoutine'],
    timeAtHome: values.timeAtHome as SleepScheduleData['timeAtHome'],
  };

  const cleanliness: CleanlinessData = {
    cleanlinessLevel: values.cleanlinessLevel as CleanlinessData['cleanlinessLevel'],
    cleaningFrequency: values.cleaningFrequency as CleanlinessData['cleaningFrequency'],
    kitchenCleanliness: values.kitchenCleanliness as CleanlinessData['kitchenCleanliness'],
    bathroomCleaning: values.bathroomCleaning as CleanlinessData['bathroomCleaning'],
    sharedSpaceOrganization: values.sharedSpaceOrganization as CleanlinessData['sharedSpaceOrganization'],
  };

  const noise: NoiseData = {
    noiseTolerance: values.noiseTolerance as NoiseData['noiseTolerance'],
    musicHabits: values.musicHabits as NoiseData['musicHabits'],
    studyWorkEnvironment: values.studyWorkEnvironment as NoiseData['studyWorkEnvironment'],
    quietHoursStart: values.quietHoursStart,
    quietHoursEnd: values.quietHoursEnd,
    headphoneUsage: values.headphoneUsage as NoiseData['headphoneUsage'],
  };

  const guests: GuestsData = {
    guestFrequency: values.guestFrequency as GuestsData['guestFrequency'],
    overnightGuests: values.overnightGuests as GuestsData['overnightGuests'],
    advanceNotice: values.advanceNotice as GuestsData['advanceNotice'],
    socialLifestyle: values.socialLifestyle as GuestsData['socialLifestyle'],
    sharedActivities: values.sharedActivities as GuestsData['sharedActivities'],
  };

  const budget: BudgetData = {
    minRent: Number(values.minRent) || 0,
    maxRent: Number(values.maxRent) || 0,
    accommodationType: values.accommodationType as BudgetData['accommodationType'],
    foodPreference: values.foodPreference as BudgetData['foodPreference'],
    foodSharing: values.foodSharing as BudgetData['foodSharing'],
    smoking: values.smoking as BudgetData['smoking'],
    alcohol: values.alcohol as BudgetData['alcohol'],
    pets: values.pets as BudgetData['pets'],
    roomArrangement: values.roomArrangement as BudgetData['roomArrangement'],
  };

  const requirements: RequirementsData = {
    quietEnvironment: values.quietEnvironmentRequirement,
    smokeFree: values.smokeFreeRequirement,
    petFree: values.petFreeRequirement,
    alcoholFree: values.alcoholFreeRequirement,
    cleanlinessLevel: values.cleanlinessRequirement,
    overnightGuestPolicy: values.overnightGuestRequirement,
    dietarySharing: values.dietarySharingRequirement,
  };

  return { sleepSchedule, cleanliness, noise, guests, budget, requirements };
}

export function formValuesToSectionPayload(step: number, values: QuestionnaireFormValues): Record<string, unknown> {
  const full = formValuesToPayload(values);
  switch (step) {
    case 0:
      return { sleepSchedule: full.sleepSchedule };
    case 1:
      return {
        cleanliness: full.cleanliness,
        requirements: { cleanlinessLevel: values.cleanlinessRequirement },
      };
    case 2:
      return {
        noise: full.noise,
        requirements: { quietEnvironment: values.quietEnvironmentRequirement },
      };
    case 3:
      return {
        guests: full.guests,
        requirements: { overnightGuestPolicy: values.overnightGuestRequirement },
      };
    case 4:
      return {
        budget: full.budget,
        requirements: {
          smokeFree: values.smokeFreeRequirement,
          petFree: values.petFreeRequirement,
          alcoholFree: values.alcoholFreeRequirement,
          dietarySharing: values.dietarySharingRequirement,
        },
      };
    default:
      return full;
  }
}

export function calculateSleepWindow(bedtime: string, wakeUpTime: string) {
  if (!TIME_PATTERN.test(bedtime) || !TIME_PATTERN.test(wakeUpTime)) {
    return { hours: 0, crossesMidnight: false, description: 'Enter valid bedtime and wake-up times' };
  }
  const [bH, bM] = bedtime.split(':').map(Number);
  const [wH, wM] = wakeUpTime.split(':').map(Number);
  const start = bH * 60 + bM;
  const end = wH * 60 + wM;
  let minutes: number;
  let crossesMidnight = false;

  if (end >= start) {
    minutes = end - start;
  } else {
    minutes = (1440 - start) + end;
    crossesMidnight = true;
  }

  const hours = Number((minutes / 60).toFixed(1));
  const description = `${hours} hr sleep window${crossesMidnight ? ' (crosses midnight)' : ''}`;
  return { hours, crossesMidnight, description };
}

export function validateSection(step: number, values: QuestionnaireFormValues): Record<string, string> {
  const errors: Record<string, string> = {};

  if (step === 0) {
    if (!TIME_PATTERN.test(values.bedtime)) errors.bedtime = 'Enter a valid 24-hr time (HH:mm)';
    if (!TIME_PATTERN.test(values.wakeUpTime)) errors.wakeUpTime = 'Enter a valid 24-hr time (HH:mm)';
    if (!values.consistency) errors.consistency = 'Please select consistency';
    if (!values.wakingEnvironment) errors.wakingEnvironment = 'Please select your waking environment';
    if (!values.dailyRoutine) errors.dailyRoutine = 'Please select your daily routine';
    if (!values.timeAtHome) errors.timeAtHome = 'Please select your typical time at home';
  } else if (step === 1) {
    if (!values.cleanlinessLevel) errors.cleanlinessLevel = 'Please select your cleanliness level';
    if (!values.cleaningFrequency) errors.cleaningFrequency = 'Please select cleaning frequency';
    if (!values.kitchenCleanliness) errors.kitchenCleanliness = 'Please select kitchen expectation';
    if (!values.bathroomCleaning) errors.bathroomCleaning = 'Please select bathroom expectation';
    if (!values.sharedSpaceOrganization) errors.sharedSpaceOrganization = 'Please select shared space expectation';
  } else if (step === 2) {
    if (!values.noiseTolerance) errors.noiseTolerance = 'Please select noise tolerance';
    if (!values.musicHabits) errors.musicHabits = 'Please select music habits';
    if (!values.studyWorkEnvironment) errors.studyWorkEnvironment = 'Please select work environment';
    if (!TIME_PATTERN.test(values.quietHoursStart)) errors.quietHoursStart = 'Enter quiet hours start (HH:mm)';
    if (!TIME_PATTERN.test(values.quietHoursEnd)) errors.quietHoursEnd = 'Enter quiet hours end (HH:mm)';
    if (!values.headphoneUsage) errors.headphoneUsage = 'Please select headphone usage';
  } else if (step === 3) {
    if (!values.guestFrequency) errors.guestFrequency = 'Please select guest frequency';
    if (!values.overnightGuests) errors.overnightGuests = 'Please select comfort with overnight guests';
    if (!values.advanceNotice) errors.advanceNotice = 'Please select advance notice preference';
    if (!values.socialLifestyle) errors.socialLifestyle = 'Please select social lifestyle';
    if (!values.sharedActivities) errors.sharedActivities = 'Please select shared activities preference';
  } else if (step === 4) {
    const min = Number(values.minRent);
    const max = Number(values.maxRent);
    if (!values.minRent || !Number.isFinite(min) || min < 0) errors.minRent = 'Enter a valid minimum budget';
    if (!values.maxRent || !Number.isFinite(max) || max < 0) errors.maxRent = 'Enter a valid maximum budget';
    if (Number.isFinite(min) && Number.isFinite(max) && min > max) {
      errors.minRent = 'Minimum cannot exceed maximum';
      errors.maxRent = 'Maximum must be greater than or equal to minimum';
    }
    if (!values.accommodationType) errors.accommodationType = 'Please select accommodation type';
    if (!values.foodPreference) errors.foodPreference = 'Please select food preference';
    if (!values.foodSharing) errors.foodSharing = 'Please select food sharing preference';
    if (!values.smoking) errors.smoking = 'Please select smoking preference';
    if (!values.alcohol) errors.alcohol = 'Please select alcohol preference';
    if (!values.pets) errors.pets = 'Please select pet preference';
    if (!values.roomArrangement) errors.roomArrangement = 'Please select room arrangement';
  }

  return errors;
}

export const LABELS: Record<string, string> = {
  // Consistency
  'very-consistent': 'Very consistent',
  'somewhat-consistent': 'Somewhat consistent',
  'irregular': 'Irregular schedule',
  // Waking environment
  'quiet': 'Quiet & gentle',
  'normal-activity': 'Normal activity is fine',
  // Daily routine
  'student': 'Student',
  'working-professional': 'Working professional',
  'remote-worker': 'Remote worker',
  'mixed-other': 'Mixed / Other',
  // Time at home
  'mostly-at-home': 'Mostly at home',
  'partially-at-home': 'Partially at home',
  'rarely-at-home': 'Rarely at home',
  // Cleanliness level
  'very-organized': 'Very organized',
  'moderately-organized': 'Moderately organized',
  'relaxed': 'Relaxed / Easygoing',
  // Cleaning frequency
  'daily': 'Daily',
  'several-times-a-week': 'Several times a week',
  'weekly': 'Weekly',
  'as-needed': 'As needed',
  // Kitchen cleanliness
  'clean-immediately': 'Clean immediately after cooking',
  'clean-same-day': 'Clean the same day',
  'flexible': 'Flexible / When convenient',
  // Bathroom cleaning
  'shared-schedule': 'Shared scheduled rotation',
  'alternate-responsibilities': 'Alternate responsibilities',
  'individual-responsibility': 'Individual responsibility',
  // Shared space
  'very-tidy': 'Very tidy & clutter-free',
  'moderately-tidy': 'Moderately tidy',
  // Noise tolerance
  'very-low': 'Very low (prefers calm & silence)',
  'moderate': 'Moderate (normal living noise is fine)',
  'high': 'High (lively spaces are welcome)',
  // Music habits
  'rarely': 'Rarely',
  'occasionally': 'Occasionally',
  'frequently': 'Frequently',
  // Study/work env
  'silent': 'Silent environment',
  'low-background-noise': 'Low background noise is fine',
  'doesnt-matter': "Doesn't matter",
  // Headphone usage
  'always': 'Always wear headphones',
  'usually': 'Usually wear headphones',
  'sometimes': 'Sometimes',
  // Guests
  'not-comfortable': 'Not comfortable with overnight guests',
  'comfortable': 'Comfortable with overnight guests',
  'required': 'Strict requirement / Required',
  'preferred': 'Preferred (ideal)',
  'not-necessary': 'Not necessary',
  // Social
  'introverted': 'Introverted (recharges in quiet)',
  'balanced': 'Balanced (enjoys company and solo time)',
  'extroverted': 'Extroverted (loves socializing & energy)',
  'prefer-personal-space': 'Prefer personal space',
  // Budget & living
  'apartment': 'Apartment / Flat',
  'pg': 'Paying Guest (PG)',
  'hostel': 'Hostel',
  'shared-house': 'Shared House',
  'no-preference': 'No preference',
  'vegetarian': 'Vegetarian',
  'non-vegetarian': 'Non-vegetarian',
  'vegan': 'Vegan',
  'share-groceries': 'Share groceries & meals',
  'separate-groceries': 'Separate groceries & cooking',
  'smoke-free-required': 'Smoke-free environment required',
  'non-smokers-only': 'Comfortable with non-smokers only',
  'comfortable-with-smokers': 'Comfortable with smokers',
  'alcohol-free-preferred': 'Prefer alcohol-free environment',
  'occasional-acceptable': 'Occasional social use acceptable',
  'comfortable-with-pets': 'Comfortable with pets',
  'prefer-no-pets': 'Prefer no pets',
  'allergic-pet-free': 'Allergic / require pet-free home',
  'private-room': 'Private room',
  'shared-room': 'Shared room',
};

export function getLabel(key: string): string {
  return LABELS[key] ?? key;
}
