import mongoose, { Schema, model, type HydratedDocument } from 'mongoose';

export const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface SleepSchedule {
  bedtime: string;
  wakeUpTime: string;
  consistency: 'very-consistent' | 'somewhat-consistent' | 'irregular';
  wakingEnvironment: 'quiet' | 'normal-activity';
  dailyRoutine: 'student' | 'working-professional' | 'remote-worker' | 'mixed-other';
  timeAtHome: 'mostly-at-home' | 'partially-at-home' | 'rarely-at-home';
}

export interface Cleanliness {
  cleanlinessLevel: 'very-organized' | 'moderately-organized' | 'relaxed';
  cleaningFrequency: 'daily' | 'several-times-a-week' | 'weekly' | 'as-needed';
  kitchenCleanliness: 'clean-immediately' | 'clean-same-day' | 'flexible';
  bathroomCleaning: 'shared-schedule' | 'alternate-responsibilities' | 'individual-responsibility';
  sharedSpaceOrganization: 'very-tidy' | 'moderately-tidy' | 'relaxed';
}

export interface Noise {
  noiseTolerance: 'very-low' | 'moderate' | 'high';
  musicHabits: 'rarely' | 'occasionally' | 'frequently';
  studyWorkEnvironment: 'silent' | 'low-background-noise' | 'doesnt-matter';
  quietHoursStart: string;
  quietHoursEnd: string;
  headphoneUsage: 'always' | 'usually' | 'sometimes' | 'rarely';
}

export interface Guests {
  guestFrequency: 'rarely' | 'occasionally' | 'frequently';
  overnightGuests: 'not-comfortable' | 'occasionally' | 'comfortable';
  advanceNotice: 'required' | 'preferred' | 'not-necessary';
  socialLifestyle: 'introverted' | 'balanced' | 'extroverted';
  sharedActivities: 'frequently' | 'sometimes' | 'prefer-personal-space';
}

export interface Budget {
  minRent: number;
  maxRent: number;
  accommodationType: 'apartment' | 'pg' | 'hostel' | 'shared-house' | 'no-preference';
  foodPreference: 'vegetarian' | 'non-vegetarian' | 'vegan' | 'no-preference';
  foodSharing: 'share-groceries' | 'separate-groceries' | 'flexible';
  smoking: 'smoke-free-required' | 'non-smokers-only' | 'comfortable-with-smokers';
  alcohol: 'alcohol-free-preferred' | 'occasional-acceptable' | 'no-preference';
  pets: 'comfortable-with-pets' | 'prefer-no-pets' | 'allergic-pet-free';
  roomArrangement: 'private-room' | 'shared-room' | 'no-preference';
}

export interface Requirements {
  quietEnvironment: 'preferred' | 'required';
  smokeFree: 'preferred' | 'required';
  petFree: 'preferred' | 'required';
  alcoholFree: 'preferred' | 'required';
  cleanlinessLevel: 'preferred' | 'required';
  overnightGuestPolicy: 'preferred' | 'required';
  dietarySharing: 'preferred' | 'required';
}

export interface RoommatePreferencesRecord {
  userId: mongoose.Types.ObjectId;
  sleepSchedule?: SleepSchedule;
  cleanliness?: Cleanliness;
  noise?: Noise;
  guests?: Guests;
  budget?: Budget;
  requirements?: Requirements;
  isCompleted: boolean;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const sleepScheduleSchema = new Schema<SleepSchedule>({
  bedtime: { type: String, required: true, match: TIME_REGEX },
  wakeUpTime: { type: String, required: true, match: TIME_REGEX },
  consistency: { type: String, required: true, enum: ['very-consistent', 'somewhat-consistent', 'irregular'] },
  wakingEnvironment: { type: String, required: true, enum: ['quiet', 'normal-activity'] },
  dailyRoutine: { type: String, required: true, enum: ['student', 'working-professional', 'remote-worker', 'mixed-other'] },
  timeAtHome: { type: String, required: true, enum: ['mostly-at-home', 'partially-at-home', 'rarely-at-home'] },
}, { _id: false, strict: 'throw' });

const cleanlinessSchema = new Schema<Cleanliness>({
  cleanlinessLevel: { type: String, required: true, enum: ['very-organized', 'moderately-organized', 'relaxed'] },
  cleaningFrequency: { type: String, required: true, enum: ['daily', 'several-times-a-week', 'weekly', 'as-needed'] },
  kitchenCleanliness: { type: String, required: true, enum: ['clean-immediately', 'clean-same-day', 'flexible'] },
  bathroomCleaning: { type: String, required: true, enum: ['shared-schedule', 'alternate-responsibilities', 'individual-responsibility'] },
  sharedSpaceOrganization: { type: String, required: true, enum: ['very-tidy', 'moderately-tidy', 'relaxed'] },
}, { _id: false, strict: 'throw' });

const noiseSchema = new Schema<Noise>({
  noiseTolerance: { type: String, required: true, enum: ['very-low', 'moderate', 'high'] },
  musicHabits: { type: String, required: true, enum: ['rarely', 'occasionally', 'frequently'] },
  studyWorkEnvironment: { type: String, required: true, enum: ['silent', 'low-background-noise', 'doesnt-matter'] },
  quietHoursStart: { type: String, required: true, match: TIME_REGEX },
  quietHoursEnd: { type: String, required: true, match: TIME_REGEX },
  headphoneUsage: { type: String, required: true, enum: ['always', 'usually', 'sometimes', 'rarely'] },
}, { _id: false, strict: 'throw' });

const guestsSchema = new Schema<Guests>({
  guestFrequency: { type: String, required: true, enum: ['rarely', 'occasionally', 'frequently'] },
  overnightGuests: { type: String, required: true, enum: ['not-comfortable', 'occasionally', 'comfortable'] },
  advanceNotice: { type: String, required: true, enum: ['required', 'preferred', 'not-necessary'] },
  socialLifestyle: { type: String, required: true, enum: ['introverted', 'balanced', 'extroverted'] },
  sharedActivities: { type: String, required: true, enum: ['frequently', 'sometimes', 'prefer-personal-space'] },
}, { _id: false, strict: 'throw' });

const budgetSchema = new Schema<Budget>({
  minRent: { type: Number, required: true, min: 0, max: 10000000 },
  maxRent: { type: Number, required: true, min: 0, max: 10000000 },
  accommodationType: { type: String, required: true, enum: ['apartment', 'pg', 'hostel', 'shared-house', 'no-preference'] },
  foodPreference: { type: String, required: true, enum: ['vegetarian', 'non-vegetarian', 'vegan', 'no-preference'] },
  foodSharing: { type: String, required: true, enum: ['share-groceries', 'separate-groceries', 'flexible'] },
  smoking: { type: String, required: true, enum: ['smoke-free-required', 'non-smokers-only', 'comfortable-with-smokers'] },
  alcohol: { type: String, required: true, enum: ['alcohol-free-preferred', 'occasional-acceptable', 'no-preference'] },
  pets: { type: String, required: true, enum: ['comfortable-with-pets', 'prefer-no-pets', 'allergic-pet-free'] },
  roomArrangement: { type: String, required: true, enum: ['private-room', 'shared-room', 'no-preference'] },
}, { _id: false, strict: 'throw' });

const requirementsSchema = new Schema<Requirements>({
  quietEnvironment: { type: String, enum: ['preferred', 'required'], default: 'preferred' },
  smokeFree: { type: String, enum: ['preferred', 'required'], default: 'preferred' },
  petFree: { type: String, enum: ['preferred', 'required'], default: 'preferred' },
  alcoholFree: { type: String, enum: ['preferred', 'required'], default: 'preferred' },
  cleanlinessLevel: { type: String, enum: ['preferred', 'required'], default: 'preferred' },
  overnightGuestPolicy: { type: String, enum: ['preferred', 'required'], default: 'preferred' },
  dietarySharing: { type: String, enum: ['preferred', 'required'], default: 'preferred' },
}, { _id: false, strict: 'throw' });

const roommatePreferencesSchema = new Schema<RoommatePreferencesRecord>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  sleepSchedule: { type: sleepScheduleSchema, required: false },
  cleanliness: { type: cleanlinessSchema, required: false },
  noise: { type: noiseSchema, required: false },
  guests: { type: guestsSchema, required: false },
  budget: { type: budgetSchema, required: false },
  requirements: { type: requirementsSchema, default: () => ({}) },
  isCompleted: { type: Boolean, default: false, index: true },
  completedAt: { type: Date, default: null },
}, { timestamps: true, strict: 'throw', bufferCommands: false });

roommatePreferencesSchema.set('toJSON', {
  transform(_document, result) {
    Reflect.deleteProperty(result, '__v');
    return result;
  },
});

export const RoommatePreferences = model<RoommatePreferencesRecord>('RoommatePreferences', roommatePreferencesSchema);
export type RoommatePreferencesDocument = HydratedDocument<RoommatePreferencesRecord>;

export function calculateSleepDurationMinutes(bedtime: string, wakeUpTime: string): number {
  if (!TIME_REGEX.test(bedtime) || !TIME_REGEX.test(wakeUpTime)) return 0;
  const [bH, bM] = bedtime.split(':').map(Number);
  const [wH, wM] = wakeUpTime.split(':').map(Number);
  const start = bH * 60 + bM;
  const end = wH * 60 + wM;
  if (end >= start) {
    return end - start;
  }
  // Crosses midnight, e.g. 23:00 to 07:00
  return (1440 - start) + end;
}

export function publicPreferences(doc: RoommatePreferencesDocument | RoommatePreferencesRecord) {
  return {
    id: (doc as any)._id?.toString() ?? (doc as any).id,
    userId: doc.userId.toString(),
    sleepSchedule: doc.sleepSchedule ? {
      bedtime: doc.sleepSchedule.bedtime,
      wakeUpTime: doc.sleepSchedule.wakeUpTime,
      consistency: doc.sleepSchedule.consistency,
      wakingEnvironment: doc.sleepSchedule.wakingEnvironment,
      dailyRoutine: doc.sleepSchedule.dailyRoutine,
      timeAtHome: doc.sleepSchedule.timeAtHome,
      sleepWindowHours: Number((calculateSleepDurationMinutes(doc.sleepSchedule.bedtime, doc.sleepSchedule.wakeUpTime) / 60).toFixed(1)),
    } : null,
    cleanliness: doc.cleanliness ? {
      cleanlinessLevel: doc.cleanliness.cleanlinessLevel,
      cleaningFrequency: doc.cleanliness.cleaningFrequency,
      kitchenCleanliness: doc.cleanliness.kitchenCleanliness,
      bathroomCleaning: doc.cleanliness.bathroomCleaning,
      sharedSpaceOrganization: doc.cleanliness.sharedSpaceOrganization,
    } : null,
    noise: doc.noise ? {
      noiseTolerance: doc.noise.noiseTolerance,
      musicHabits: doc.noise.musicHabits,
      studyWorkEnvironment: doc.noise.studyWorkEnvironment,
      quietHoursStart: doc.noise.quietHoursStart,
      quietHoursEnd: doc.noise.quietHoursEnd,
      headphoneUsage: doc.noise.headphoneUsage,
    } : null,
    guests: doc.guests ? {
      guestFrequency: doc.guests.guestFrequency,
      overnightGuests: doc.guests.overnightGuests,
      advanceNotice: doc.guests.advanceNotice,
      socialLifestyle: doc.guests.socialLifestyle,
      sharedActivities: doc.guests.sharedActivities,
    } : null,
    budget: doc.budget ? {
      minRent: doc.budget.minRent,
      maxRent: doc.budget.maxRent,
      accommodationType: doc.budget.accommodationType,
      foodPreference: doc.budget.foodPreference,
      foodSharing: doc.budget.foodSharing,
      smoking: doc.budget.smoking,
      alcohol: doc.budget.alcohol,
      pets: doc.budget.pets,
      roomArrangement: doc.budget.roomArrangement,
    } : null,
    requirements: doc.requirements ? {
      quietEnvironment: doc.requirements.quietEnvironment,
      smokeFree: doc.requirements.smokeFree,
      petFree: doc.requirements.petFree,
      alcoholFree: doc.requirements.alcoholFree,
      cleanlinessLevel: doc.requirements.cleanlinessLevel,
      overnightGuestPolicy: doc.requirements.overnightGuestPolicy,
      dietarySharing: doc.requirements.dietarySharing,
    } : {
      quietEnvironment: 'preferred',
      smokeFree: 'preferred',
      petFree: 'preferred',
      alcoholFree: 'preferred',
      cleanlinessLevel: 'preferred',
      overnightGuestPolicy: 'preferred',
      dietarySharing: 'preferred',
    },
    isCompleted: doc.isCompleted,
    completedAt: doc.completedAt ? doc.completedAt.toISOString() : null,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
  };
}

