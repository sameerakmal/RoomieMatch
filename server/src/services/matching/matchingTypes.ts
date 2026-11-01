import type {
  Budget,
  Cleanliness,
  Guests,
  Noise,
  Requirements,
  SleepSchedule,
} from '../../models/RoommatePreferences.js';

export type CategoryKey = 'sleep' | 'cleanliness' | 'noise' | 'guests' | 'budget' | 'lifestyle';

export interface MatchingPreferencesInput {
  sleepSchedule?: SleepSchedule | null;
  cleanliness?: Cleanliness | null;
  noise?: Noise | null;
  guests?: Guests | null;
  budget?: Budget | null;
  requirements?: Requirements | null;
}

export interface CategoryWeightConfig {
  key: CategoryKey;
  label: string;
  weight: number;
}

export const CATEGORY_WEIGHTS: Record<CategoryKey, number> = {
  sleep: 20,
  cleanliness: 20,
  noise: 15,
  guests: 15,
  budget: 20,
  lifestyle: 10,
};

export type ConstraintStatus = 'passed' | 'failed' | 'unknown';

export interface ConstraintEvaluation {
  id: string;
  name: string;
  status: ConstraintStatus;
  affectedCategory: CategoryKey;
  explanation: string;
  direction: 'user-to-candidate' | 'candidate-to-user';
}

export interface CategoryScoreResult {
  score: number;
  weight: number;
  isAvailable: boolean;
  explanation?: string;
}

export interface BudgetOverlapResult {
  hasOverlap: boolean;
  min: number | null;
  max: number | null;
  overlapSpan: number;
  userBudget: { min: number; max: number };
  candidateBudget: { min: number; max: number };
  explanation: string;
}

export interface CompatibilityResult {
  overallScore: number | null;
  dataCoverage: number;
  isEligible: boolean;
  categories: Record<CategoryKey, CategoryScoreResult>;
  strengths: string[];
  differences: string[];
  budgetOverlap: BudgetOverlapResult;
  constraints: ConstraintEvaluation[];
  summary: string;
}

export interface SafeCandidateProfile {
  id: string;
  name: string;
  profile: {
    city: string;
    occupation: string;
    bio: string;
    profilePhotoUrl: string;
    age: number | null;
    moveInDate: string | null;
  };
}

export interface CandidateConnectionInfo {
  id: string;
  status: 'pending' | 'accepted';
  direction: 'sent' | 'received';
}

export interface MatchDiscoveryItem {
  candidate: SafeCandidateProfile;
  compatibility: CompatibilityResult;
  connection?: CandidateConnectionInfo | null;
}
