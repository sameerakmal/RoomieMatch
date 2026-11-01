import {
  CATEGORY_WEIGHTS,
  type CategoryKey,
  type CategoryScoreResult,
  type CompatibilityResult,
  type MatchingPreferencesInput,
} from './matchingTypes.js';
import { evaluateHardConstraints } from './constraintEvaluator.js';
import {
  scoreCleanliness,
  scoreGuests,
  scoreLifestyle,
  scoreNoise,
  scoreSleepSchedule,
} from './categoryScorers.js';
import { scoreBudgetAndAccommodation } from './budgetScorer.js';
import { generateMatchExplanations } from './matchExplanations.js';

export function calculateCompatibility(
  userPref: MatchingPreferencesInput,
  candidatePref: MatchingPreferencesInput,
): CompatibilityResult {
  // 1. Evaluate hard constraints mutually
  const { constraints, hasViolation } = evaluateHardConstraints(userPref, candidatePref);

  // 2. Score individual categories
  const rawSleep = scoreSleepSchedule(userPref.sleepSchedule, candidatePref.sleepSchedule);
  const rawCleanliness = scoreCleanliness(userPref.cleanliness, candidatePref.cleanliness);
  const rawNoise = scoreNoise(userPref.noise, candidatePref.noise);
  const rawGuests = scoreGuests(userPref.guests, candidatePref.guests);
  const { score: rawBudget, budgetOverlap } = scoreBudgetAndAccommodation(userPref.budget, candidatePref.budget);
  const rawLifestyle = scoreLifestyle(userPref, candidatePref);

  const categories: Record<CategoryKey, CategoryScoreResult> = {
    sleep: {
      score: rawSleep ?? 0,
      weight: CATEGORY_WEIGHTS.sleep,
      isAvailable: rawSleep !== null,
    },
    cleanliness: {
      score: rawCleanliness ?? 0,
      weight: CATEGORY_WEIGHTS.cleanliness,
      isAvailable: rawCleanliness !== null,
    },
    noise: {
      score: rawNoise ?? 0,
      weight: CATEGORY_WEIGHTS.noise,
      isAvailable: rawNoise !== null,
    },
    guests: {
      score: rawGuests ?? 0,
      weight: CATEGORY_WEIGHTS.guests,
      isAvailable: rawGuests !== null,
    },
    budget: {
      score: rawBudget ?? 0,
      weight: CATEGORY_WEIGHTS.budget,
      isAvailable: rawBudget !== null,
    },
    lifestyle: {
      score: rawLifestyle ?? 0,
      weight: CATEGORY_WEIGHTS.lifestyle,
      isAvailable: rawLifestyle !== null,
    },
  };

  // 3. Compute data coverage and renormalize weights
  let availableWeightSum = 0;
  let weightedScoreSum = 0;
  for (const key of Object.keys(categories) as CategoryKey[]) {
    const cat = categories[key];
    if (cat.isAvailable) {
      availableWeightSum += cat.weight;
      weightedScoreSum += cat.score * cat.weight;
    }
  }

  const dataCoverage = Math.round((availableWeightSum / 100) * 100);

  // Missing data policy: If available coverage is below 50%, do not produce a score
  let overallScore: number | null = null;
  if (dataCoverage >= 50 && availableWeightSum > 0) {
    const normalized = weightedScoreSum / availableWeightSum;
    overallScore = Math.min(100, Math.max(0, Math.round(normalized)));
  }

  // 4. Determine eligibility:
  // Must have no hard constraint violation AND sufficient data coverage
  const isEligible = !hasViolation && overallScore !== null;

  // 5. Generate deterministic explanations
  const { strengths, differences, summary } = generateMatchExplanations(
    userPref,
    candidatePref,
    categories,
    budgetOverlap,
    overallScore,
  );

  return {
    overallScore,
    dataCoverage,
    isEligible,
    categories,
    strengths,
    differences,
    budgetOverlap,
    constraints,
    summary,
  };
}
