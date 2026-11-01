import { HttpError } from './HttpError.js';
import {
  TIME_REGEX,
  type Budget,
  type Cleanliness,
  type Guests,
  type Noise,
  type Requirements,
  type RoommatePreferencesRecord,
  type SleepSchedule,
} from '../models/RoommatePreferences.js';

function objectBody(value: unknown, fieldName = 'Request body'): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, `${fieldName} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

function allowFields(value: Record<string, unknown>, allowed: readonly string[], context = 'Request'): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      throw new HttpError(400, `${context} contains unrecognized or disallowed field: "${key}".`, { [key]: 'Unrecognized field.' });
    }
  }
}

function validateEnum<T extends string>(value: unknown, allowed: readonly T[], fieldName: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new HttpError(400, `Invalid value for ${fieldName}. Allowed options: ${allowed.join(', ')}.`, {
      [fieldName]: `Select one of: ${allowed.join(', ')}.`,
    });
  }
  return value as T;
}

function validateTime(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !TIME_REGEX.test(value)) {
    throw new HttpError(400, `Invalid time format for ${fieldName}. Must be HH:mm (24-hour).`, {
      [fieldName]: 'Enter time in HH:mm format (e.g. 23:00).',
    });
  }
  return value;
}

export function validateSleepSchedule(value: unknown, isPartial = false): SleepSchedule {
  const body = objectBody(value, 'sleepSchedule');
  const allowed = ['bedtime', 'wakeUpTime', 'consistency', 'wakingEnvironment', 'dailyRoutine', 'timeAtHome'] as const;
  allowFields(body, allowed, 'sleepSchedule');

  if (!isPartial) {
    for (const key of allowed) {
      if (!(key in body) || body[key] === undefined || body[key] === null) {
        throw new HttpError(400, `Missing required sleep schedule field: "${key}".`, { [key]: 'This field is required.' });
      }
    }
  }

  const result: Partial<SleepSchedule> = {};
  if ('bedtime' in body) result.bedtime = validateTime(body.bedtime, 'bedtime');
  if ('wakeUpTime' in body) result.wakeUpTime = validateTime(body.wakeUpTime, 'wakeUpTime');
  if ('consistency' in body) {
    result.consistency = validateEnum(body.consistency, ['very-consistent', 'somewhat-consistent', 'irregular'] as const, 'consistency');
  }
  if ('wakingEnvironment' in body) {
    result.wakingEnvironment = validateEnum(body.wakingEnvironment, ['quiet', 'normal-activity'] as const, 'wakingEnvironment');
  }
  if ('dailyRoutine' in body) {
    result.dailyRoutine = validateEnum(body.dailyRoutine, ['student', 'working-professional', 'remote-worker', 'mixed-other'] as const, 'dailyRoutine');
  }
  if ('timeAtHome' in body) {
    result.timeAtHome = validateEnum(body.timeAtHome, ['mostly-at-home', 'partially-at-home', 'rarely-at-home'] as const, 'timeAtHome');
  }

  return result as SleepSchedule;
}

export function validateCleanliness(value: unknown, isPartial = false): Cleanliness {
  const body = objectBody(value, 'cleanliness');
  const allowed = ['cleanlinessLevel', 'cleaningFrequency', 'kitchenCleanliness', 'bathroomCleaning', 'sharedSpaceOrganization'] as const;
  allowFields(body, allowed, 'cleanliness');

  if (!isPartial) {
    for (const key of allowed) {
      if (!(key in body) || body[key] === undefined || body[key] === null) {
        throw new HttpError(400, `Missing required cleanliness field: "${key}".`, { [key]: 'This field is required.' });
      }
    }
  }

  const result: Partial<Cleanliness> = {};
  if ('cleanlinessLevel' in body) {
    result.cleanlinessLevel = validateEnum(body.cleanlinessLevel, ['very-organized', 'moderately-organized', 'relaxed'] as const, 'cleanlinessLevel');
  }
  if ('cleaningFrequency' in body) {
    result.cleaningFrequency = validateEnum(body.cleaningFrequency, ['daily', 'several-times-a-week', 'weekly', 'as-needed'] as const, 'cleaningFrequency');
  }
  if ('kitchenCleanliness' in body) {
    result.kitchenCleanliness = validateEnum(body.kitchenCleanliness, ['clean-immediately', 'clean-same-day', 'flexible'] as const, 'kitchenCleanliness');
  }
  if ('bathroomCleaning' in body) {
    result.bathroomCleaning = validateEnum(body.bathroomCleaning, ['shared-schedule', 'alternate-responsibilities', 'individual-responsibility'] as const, 'bathroomCleaning');
  }
  if ('sharedSpaceOrganization' in body) {
    result.sharedSpaceOrganization = validateEnum(body.sharedSpaceOrganization, ['very-tidy', 'moderately-tidy', 'relaxed'] as const, 'sharedSpaceOrganization');
  }

  return result as Cleanliness;
}

export function validateNoise(value: unknown, isPartial = false): Noise {
  const body = objectBody(value, 'noise');
  const allowed = ['noiseTolerance', 'musicHabits', 'studyWorkEnvironment', 'quietHoursStart', 'quietHoursEnd', 'headphoneUsage'] as const;
  allowFields(body, allowed, 'noise');

  if (!isPartial) {
    for (const key of allowed) {
      if (!(key in body) || body[key] === undefined || body[key] === null) {
        throw new HttpError(400, `Missing required noise field: "${key}".`, { [key]: 'This field is required.' });
      }
    }
  }

  const result: Partial<Noise> = {};
  if ('noiseTolerance' in body) {
    result.noiseTolerance = validateEnum(body.noiseTolerance, ['very-low', 'moderate', 'high'] as const, 'noiseTolerance');
  }
  if ('musicHabits' in body) {
    result.musicHabits = validateEnum(body.musicHabits, ['rarely', 'occasionally', 'frequently'] as const, 'musicHabits');
  }
  if ('studyWorkEnvironment' in body) {
    result.studyWorkEnvironment = validateEnum(body.studyWorkEnvironment, ['silent', 'low-background-noise', 'doesnt-matter'] as const, 'studyWorkEnvironment');
  }
  if ('quietHoursStart' in body) result.quietHoursStart = validateTime(body.quietHoursStart, 'quietHoursStart');
  if ('quietHoursEnd' in body) result.quietHoursEnd = validateTime(body.quietHoursEnd, 'quietHoursEnd');
  if ('headphoneUsage' in body) {
    result.headphoneUsage = validateEnum(body.headphoneUsage, ['always', 'usually', 'sometimes', 'rarely'] as const, 'headphoneUsage');
  }

  return result as Noise;
}

export function validateGuests(value: unknown, isPartial = false): Guests {
  const body = objectBody(value, 'guests');
  const allowed = ['guestFrequency', 'overnightGuests', 'advanceNotice', 'socialLifestyle', 'sharedActivities'] as const;
  allowFields(body, allowed, 'guests');

  if (!isPartial) {
    for (const key of allowed) {
      if (!(key in body) || body[key] === undefined || body[key] === null) {
        throw new HttpError(400, `Missing required guest field: "${key}".`, { [key]: 'This field is required.' });
      }
    }
  }

  const result: Partial<Guests> = {};
  if ('guestFrequency' in body) {
    result.guestFrequency = validateEnum(body.guestFrequency, ['rarely', 'occasionally', 'frequently'] as const, 'guestFrequency');
  }
  if ('overnightGuests' in body) {
    result.overnightGuests = validateEnum(body.overnightGuests, ['not-comfortable', 'occasionally', 'comfortable'] as const, 'overnightGuests');
  }
  if ('advanceNotice' in body) {
    result.advanceNotice = validateEnum(body.advanceNotice, ['required', 'preferred', 'not-necessary'] as const, 'advanceNotice');
  }
  if ('socialLifestyle' in body) {
    result.socialLifestyle = validateEnum(body.socialLifestyle, ['introverted', 'balanced', 'extroverted'] as const, 'socialLifestyle');
  }
  if ('sharedActivities' in body) {
    result.sharedActivities = validateEnum(body.sharedActivities, ['frequently', 'sometimes', 'prefer-personal-space'] as const, 'sharedActivities');
  }

  return result as Guests;
}

export function validateBudget(value: unknown, isPartial = false): Budget {
  const body = objectBody(value, 'budget');
  const allowed = [
    'minRent', 'maxRent', 'accommodationType', 'foodPreference', 'foodSharing',
    'smoking', 'alcohol', 'pets', 'roomArrangement',
  ] as const;
  allowFields(body, allowed, 'budget');

  if (!isPartial) {
    for (const key of allowed) {
      if (!(key in body) || body[key] === undefined || body[key] === null) {
        throw new HttpError(400, `Missing required budget field: "${key}".`, { [key]: 'This field is required.' });
      }
    }
  }

  const result: Partial<Budget> = {};

  if ('minRent' in body) {
    const minRent = Number(body.minRent);
    if (!Number.isFinite(minRent) || !Number.isInteger(minRent) || minRent < 0 || minRent > 10000000) {
      throw new HttpError(400, 'Minimum rent must be a non-negative integer up to 10,000,000.', { minRent: 'Enter a valid amount (0–10,000,000).' });
    }
    result.minRent = minRent;
  }

  if ('maxRent' in body) {
    const maxRent = Number(body.maxRent);
    if (!Number.isFinite(maxRent) || !Number.isInteger(maxRent) || maxRent < 0 || maxRent > 10000000) {
      throw new HttpError(400, 'Maximum rent must be a non-negative integer up to 10,000,000.', { maxRent: 'Enter a valid amount (0–10,000,000).' });
    }
    result.maxRent = maxRent;
  }

  if (result.minRent !== undefined && result.maxRent !== undefined && result.minRent > result.maxRent) {
    throw new HttpError(400, 'Minimum rent cannot exceed maximum rent.', { minRent: 'Minimum rent cannot exceed maximum rent.', maxRent: 'Maximum rent must be greater than or equal to minimum.' });
  }

  if ('accommodationType' in body) {
    result.accommodationType = validateEnum(body.accommodationType, ['apartment', 'pg', 'hostel', 'shared-house', 'no-preference'] as const, 'accommodationType');
  }
  if ('foodPreference' in body) {
    result.foodPreference = validateEnum(body.foodPreference, ['vegetarian', 'non-vegetarian', 'vegan', 'no-preference'] as const, 'foodPreference');
  }
  if ('foodSharing' in body) {
    result.foodSharing = validateEnum(body.foodSharing, ['share-groceries', 'separate-groceries', 'flexible'] as const, 'foodSharing');
  }
  if ('smoking' in body) {
    result.smoking = validateEnum(body.smoking, ['smoke-free-required', 'non-smokers-only', 'comfortable-with-smokers'] as const, 'smoking');
  }
  if ('alcohol' in body) {
    result.alcohol = validateEnum(body.alcohol, ['alcohol-free-preferred', 'occasional-acceptable', 'no-preference'] as const, 'alcohol');
  }
  if ('pets' in body) {
    result.pets = validateEnum(body.pets, ['comfortable-with-pets', 'prefer-no-pets', 'allergic-pet-free'] as const, 'pets');
  }
  if ('roomArrangement' in body) {
    result.roomArrangement = validateEnum(body.roomArrangement, ['private-room', 'shared-room', 'no-preference'] as const, 'roomArrangement');
  }

  return result as Budget;
}

export function validateRequirements(value: unknown): Requirements {
  const body = objectBody(value, 'requirements');
  const allowed = [
    'quietEnvironment', 'smokeFree', 'petFree', 'alcoholFree',
    'cleanlinessLevel', 'overnightGuestPolicy', 'dietarySharing',
  ] as const;
  allowFields(body, allowed, 'requirements');

  const result: Partial<Requirements> = {};
  for (const field of allowed) {
    if (field in body) {
      result[field] = validateEnum(body[field], ['preferred', 'required'] as const, field);
    } else {
      result[field] = 'preferred';
    }
  }

  return result as Requirements;
}

export interface ValidatedPreferencesInput {
  sleepSchedule: SleepSchedule;
  cleanliness: Cleanliness;
  noise: Noise;
  guests: Guests;
  budget: Budget;
  requirements?: Requirements;
}

export interface ValidatedPartialPreferencesInput {
  sleepSchedule?: SleepSchedule;
  cleanliness?: Cleanliness;
  noise?: Noise;
  guests?: Guests;
  budget?: Budget;
  requirements?: Requirements;
}

export function validatePreferences(value: unknown): ValidatedPreferencesInput {
  const body = objectBody(value);
  const allowedSections = ['sleepSchedule', 'cleanliness', 'noise', 'guests', 'budget', 'requirements'] as const;
  allowFields(body, allowedSections);

  for (const section of ['sleepSchedule', 'cleanliness', 'noise', 'guests', 'budget'] as const) {
    if (!(section in body) || !body[section]) {
      throw new HttpError(400, `Missing required section: "${section}".`, { [section]: `The ${section} section must be provided.` });
    }
  }

  const sleepSchedule = validateSleepSchedule(body.sleepSchedule, false);
  const cleanliness = validateCleanliness(body.cleanliness, false);
  const noise = validateNoise(body.noise, false);
  const guests = validateGuests(body.guests, false);
  const budget = validateBudget(body.budget, false);
  const requirements = 'requirements' in body && body.requirements ? validateRequirements(body.requirements) : undefined;

  return { sleepSchedule, cleanliness, noise, guests, budget, requirements };
}

export function validatePartialPreferences(value: unknown): ValidatedPartialPreferencesInput {
  const body = objectBody(value);
  const allowedSections = ['sleepSchedule', 'cleanliness', 'noise', 'guests', 'budget', 'requirements'] as const;
  allowFields(body, allowedSections);

  const result: ValidatedPartialPreferencesInput = {};
  if ('sleepSchedule' in body) result.sleepSchedule = validateSleepSchedule(body.sleepSchedule, false);
  if ('cleanliness' in body) result.cleanliness = validateCleanliness(body.cleanliness, false);
  if ('noise' in body) result.noise = validateNoise(body.noise, false);
  if ('guests' in body) result.guests = validateGuests(body.guests, false);
  if ('budget' in body) result.budget = validateBudget(body.budget, false);
  if ('requirements' in body && body.requirements) result.requirements = validateRequirements(body.requirements);

  if (Object.keys(result).length === 0) {
    throw new HttpError(400, 'Provide at least one preference section to update.');
  }

  return result;
}

export function isSleepScheduleComplete(s?: SleepSchedule | null): boolean {
  if (!s) return false;
  return !!(s.bedtime && s.wakeUpTime && s.consistency && s.wakingEnvironment && s.dailyRoutine && s.timeAtHome);
}

export function isCleanlinessComplete(c?: Cleanliness | null): boolean {
  if (!c) return false;
  return !!(c.cleanlinessLevel && c.cleaningFrequency && c.kitchenCleanliness && c.bathroomCleaning && c.sharedSpaceOrganization);
}

export function isNoiseComplete(n?: Noise | null): boolean {
  if (!n) return false;
  return !!(n.noiseTolerance && n.musicHabits && n.studyWorkEnvironment && n.quietHoursStart && n.quietHoursEnd && n.headphoneUsage);
}

export function isGuestsComplete(g?: Guests | null): boolean {
  if (!g) return false;
  return !!(g.guestFrequency && g.overnightGuests && g.advanceNotice && g.socialLifestyle && g.sharedActivities);
}

export function isBudgetComplete(b?: Budget | null): boolean {
  if (!b) return false;
  return (
    typeof b.minRent === 'number' &&
    typeof b.maxRent === 'number' &&
    b.minRent <= b.maxRent &&
    !!(b.accommodationType && b.foodPreference && b.foodSharing && b.smoking && b.alcohol && b.pets && b.roomArrangement)
  );
}

export function calculateCompletionStatus(preferences: RoommatePreferencesRecord | null | undefined) {
  if (!preferences) {
    return {
      isCompleted: false,
      completedAt: null,
      completedSections: 0,
      totalSections: 5,
      percent: 0,
      sections: {
        sleepSchedule: false,
        cleanliness: false,
        noise: false,
        guests: false,
        budget: false,
      },
    };
  }

  const sections = {
    sleepSchedule: isSleepScheduleComplete(preferences.sleepSchedule),
    cleanliness: isCleanlinessComplete(preferences.cleanliness),
    noise: isNoiseComplete(preferences.noise),
    guests: isGuestsComplete(preferences.guests),
    budget: isBudgetComplete(preferences.budget),
  };

  const completedSections = Object.values(sections).filter(Boolean).length;
  const isCompleted = completedSections === 5;
  const percent = Math.round((completedSections / 5) * 100);

  return {
    isCompleted,
    completedAt: preferences.completedAt ? preferences.completedAt.toISOString() : null,
    completedSections,
    totalSections: 5,
    percent,
    sections,
  };
}

