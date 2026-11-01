export interface AuthValues { name: string; email: string; password: string; confirmPassword: string }
export type AuthErrors = Partial<Record<keyof AuthValues, string>>;
export interface UserProfile {
  city: string;
  occupation: string;
  bio: string;
  profilePhotoUrl: string;
  age: number | null;
  moveInDate: string | null;
}
export interface User {
  id: string;
  name: string;
  email: string;
  profile: UserProfile;
  createdAt: string;
  updatedAt: string;
}
export interface UserResponse { user: User }
export interface LoginInput { email: string; password: string }
export interface RegisterInput extends LoginInput { name: string }
export interface ProfileInput { name?: string; profile?: Partial<UserProfile> }
export interface ProfileValues {
  name: string;
  city: string;
  occupation: string;
  bio: string;
  profilePhotoUrl: string;
  age: string;
  moveInDate: string;
}
export type ProfileErrors = Partial<Record<keyof ProfileValues, string>>;
export interface ApiErrorBody { error: { message: string; status: number; fields?: Record<string, string> } }
export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  database: 'connected' | 'disconnected' | 'connecting' | 'disconnecting' | 'unconfigured';
  timestamp: string;
}

// Phase 3: Lifestyle Questionnaire & Roommate Preferences Types
export interface SleepScheduleData {
  bedtime: string;
  wakeUpTime: string;
  consistency: 'very-consistent' | 'somewhat-consistent' | 'irregular';
  wakingEnvironment: 'quiet' | 'normal-activity';
  dailyRoutine: 'student' | 'working-professional' | 'remote-worker' | 'mixed-other';
  timeAtHome: 'mostly-at-home' | 'partially-at-home' | 'rarely-at-home';
  sleepWindowHours?: number;
}

export interface CleanlinessData {
  cleanlinessLevel: 'very-organized' | 'moderately-organized' | 'relaxed';
  cleaningFrequency: 'daily' | 'several-times-a-week' | 'weekly' | 'as-needed';
  kitchenCleanliness: 'clean-immediately' | 'clean-same-day' | 'flexible';
  bathroomCleaning: 'shared-schedule' | 'alternate-responsibilities' | 'individual-responsibility';
  sharedSpaceOrganization: 'very-tidy' | 'moderately-tidy' | 'relaxed';
}

export interface NoiseData {
  noiseTolerance: 'very-low' | 'moderate' | 'high';
  musicHabits: 'rarely' | 'occasionally' | 'frequently';
  studyWorkEnvironment: 'silent' | 'low-background-noise' | 'doesnt-matter';
  quietHoursStart: string;
  quietHoursEnd: string;
  headphoneUsage: 'always' | 'usually' | 'sometimes' | 'rarely';
}

export interface GuestsData {
  guestFrequency: 'rarely' | 'occasionally' | 'frequently';
  overnightGuests: 'not-comfortable' | 'occasionally' | 'comfortable';
  advanceNotice: 'required' | 'preferred' | 'not-necessary';
  socialLifestyle: 'introverted' | 'balanced' | 'extroverted';
  sharedActivities: 'frequently' | 'sometimes' | 'prefer-personal-space';
}

export interface BudgetData {
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

export interface RequirementsData {
  quietEnvironment: 'preferred' | 'required';
  smokeFree: 'preferred' | 'required';
  petFree: 'preferred' | 'required';
  alcoholFree: 'preferred' | 'required';
  cleanlinessLevel: 'preferred' | 'required';
  overnightGuestPolicy: 'preferred' | 'required';
  dietarySharing: 'preferred' | 'required';
}

export interface RoommatePreferences {
  id: string;
  userId: string;
  sleepSchedule: SleepScheduleData | null;
  cleanliness: CleanlinessData | null;
  noise: NoiseData | null;
  guests: GuestsData | null;
  budget: BudgetData | null;
  requirements: RequirementsData;
  isCompleted: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PreferencesResponse {
  preferences: RoommatePreferences | null;
}

export interface PreferencesStatus {
  isCompleted: boolean;
  completedAt: string | null;
  completedSections: number;
  totalSections: number;
  percent: number;
  sections: {
    sleepSchedule: boolean;
    cleanliness: boolean;
    noise: boolean;
    guests: boolean;
    budget: boolean;
  };
}

export interface PreferencesStatusResponse {
  status: PreferencesStatus;
}

export interface QuestionnaireFormValues {
  // Sleep
  bedtime: string;
  wakeUpTime: string;
  consistency: string;
  wakingEnvironment: string;
  dailyRoutine: string;
  timeAtHome: string;
  // Cleanliness
  cleanlinessLevel: string;
  cleaningFrequency: string;
  kitchenCleanliness: string;
  bathroomCleaning: string;
  sharedSpaceOrganization: string;
  // Noise
  noiseTolerance: string;
  musicHabits: string;
  studyWorkEnvironment: string;
  quietHoursStart: string;
  quietHoursEnd: string;
  headphoneUsage: string;
  // Guests
  guestFrequency: string;
  overnightGuests: string;
  advanceNotice: string;
  socialLifestyle: string;
  sharedActivities: string;
  // Budget
  minRent: string;
  maxRent: string;
  accommodationType: string;
  foodPreference: string;
  foodSharing: string;
  smoking: string;
  alcohol: string;
  pets: string;
  roomArrangement: string;
  // Requirements (preferred vs required)
  quietEnvironmentRequirement: 'preferred' | 'required';
  smokeFreeRequirement: 'preferred' | 'required';
  petFreeRequirement: 'preferred' | 'required';
  alcoholFreeRequirement: 'preferred' | 'required';
  cleanlinessRequirement: 'preferred' | 'required';
  overnightGuestRequirement: 'preferred' | 'required';
  dietarySharingRequirement: 'preferred' | 'required';
}
