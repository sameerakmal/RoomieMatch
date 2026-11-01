import type { ConstraintEvaluation, MatchingPreferencesInput } from './matchingTypes.js';

export function evaluateOneDirectionConstraints(
  source: MatchingPreferencesInput,
  target: MatchingPreferencesInput,
  direction: 'user-to-candidate' | 'candidate-to-user',
): ConstraintEvaluation[] {
  const evaluations: ConstraintEvaluation[] = [];
  const req = source.requirements;
  if (!req) return evaluations;

  // 1. Smoke-free constraint
  if (req.smokeFree === 'required') {
    const targetSmoking = target.budget?.smoking;
    if (!targetSmoking) {
      evaluations.push({
        id: 'smoke-free',
        name: 'Smoke-Free Home',
        status: 'unknown',
        affectedCategory: 'lifestyle',
        direction,
        explanation: 'A smoke-free environment is strictly required, but the candidate has not recorded smoking preferences.',
      });
    } else if (targetSmoking === 'smoke-free-required' || targetSmoking === 'non-smokers-only') {
      evaluations.push({
        id: 'smoke-free',
        name: 'Smoke-Free Home',
        status: 'passed',
        affectedCategory: 'lifestyle',
        direction,
        explanation: 'Smoke-free requirement satisfied: both parties prioritize a non-smoking living environment.',
      });
    } else {
      // 'comfortable-with-smokers'
      evaluations.push({
        id: 'smoke-free',
        name: 'Smoke-Free Home',
        status: 'unknown',
        affectedCategory: 'lifestyle',
        direction,
        explanation: 'A smoke-free environment is required. The candidate is comfortable with smokers, but personal smoking habits are not recorded in the questionnaire.',
      });
    }
  }

  // 2. Pet-free constraint
  if (req.petFree === 'required') {
    const targetPets = target.budget?.pets;
    if (!targetPets) {
      evaluations.push({
        id: 'pet-free',
        name: 'Pet-Free Accommodation',
        status: 'unknown',
        affectedCategory: 'lifestyle',
        direction,
        explanation: 'A pet-free environment is strictly required, but pet preferences are not provided.',
      });
    } else if (targetPets === 'allergic-pet-free' || targetPets === 'prefer-no-pets') {
      evaluations.push({
        id: 'pet-free',
        name: 'Pet-Free Accommodation',
        status: 'passed',
        affectedCategory: 'lifestyle',
        direction,
        explanation: 'Pet-free requirement satisfied: both parties prefer or require living without pets.',
      });
    } else {
      // 'comfortable-with-pets'
      evaluations.push({
        id: 'pet-free',
        name: 'Pet-Free Accommodation',
        status: 'unknown',
        affectedCategory: 'lifestyle',
        direction,
        explanation: 'A pet-free accommodation is required. The candidate is comfortable with pets, but current pet ownership is not recorded in the questionnaire.',
      });
    }
  }

  // 3. Alcohol-free constraint
  if (req.alcoholFree === 'required') {
    const targetAlcohol = target.budget?.alcohol;
    if (!targetAlcohol) {
      evaluations.push({
        id: 'alcohol-free',
        name: 'Alcohol-Free Environment',
        status: 'unknown',
        affectedCategory: 'lifestyle',
        direction,
        explanation: 'An alcohol-free environment is strictly required, but alcohol preferences are missing.',
      });
    } else if (targetAlcohol === 'alcohol-free-preferred') {
      evaluations.push({
        id: 'alcohol-free',
        name: 'Alcohol-Free Environment',
        status: 'passed',
        affectedCategory: 'lifestyle',
        direction,
        explanation: 'Alcohol-free requirement satisfied: both parties prefer an alcohol-free living space.',
      });
    } else {
      evaluations.push({
        id: 'alcohol-free',
        name: 'Alcohol-Free Environment',
        status: 'unknown',
        affectedCategory: 'lifestyle',
        direction,
        explanation: 'An alcohol-free environment is required. The candidate has no strict alcohol prohibition, but personal consumption habits are not recorded.',
      });
    }
  }

  // 4. Quiet environment constraint
  if (req.quietEnvironment === 'required') {
    const targetNoise = target.noise;
    if (!targetNoise) {
      evaluations.push({
        id: 'quiet-environment',
        name: 'Quiet Environment',
        status: 'unknown',
        affectedCategory: 'noise',
        direction,
        explanation: 'A quiet environment is strictly required, but noise preferences are not recorded.',
      });
    } else if (targetNoise.musicHabits === 'frequently' && targetNoise.headphoneUsage === 'rarely') {
      evaluations.push({
        id: 'quiet-environment',
        name: 'Quiet Environment',
        status: 'failed',
        affectedCategory: 'noise',
        direction,
        explanation: 'A quiet environment is strictly required, but the candidate frequently plays music without headphones.',
      });
    } else {
      evaluations.push({
        id: 'quiet-environment',
        name: 'Quiet Environment',
        status: 'passed',
        affectedCategory: 'noise',
        direction,
        explanation: 'Quiet environment requirement satisfied without conflicting noise habits.',
      });
    }
  }

  // 5. Cleanliness level constraint
  if (req.cleanlinessLevel === 'required') {
    const sourceCleanLevel = source.cleanliness?.cleanlinessLevel;
    const targetCleanLevel = target.cleanliness?.cleanlinessLevel;
    if (!targetCleanLevel || !sourceCleanLevel) {
      evaluations.push({
        id: 'cleanliness-level',
        name: 'Cleanliness Standards',
        status: 'unknown',
        affectedCategory: 'cleanliness',
        direction,
        explanation: 'Strict cleanliness standards are required, but cleanliness records are incomplete.',
      });
    } else if (sourceCleanLevel === 'very-organized' && targetCleanLevel === 'relaxed') {
      evaluations.push({
        id: 'cleanliness-level',
        name: 'Cleanliness Standards',
        status: 'failed',
        affectedCategory: 'cleanliness',
        direction,
        explanation: 'A very organized standard is strictly required, which conflicts with a relaxed approach to household cleanliness.',
      });
    } else {
      evaluations.push({
        id: 'cleanliness-level',
        name: 'Cleanliness Standards',
        status: 'passed',
        affectedCategory: 'cleanliness',
        direction,
        explanation: 'Cleanliness standards align within acceptable mutual thresholds.',
      });
    }
  }

  // 6. Overnight guest policy constraint
  if (req.overnightGuestPolicy === 'required') {
    const sourceOvernight = source.guests?.overnightGuests;
    const targetOvernight = target.guests?.overnightGuests;
    if (!targetOvernight || !sourceOvernight) {
      evaluations.push({
        id: 'overnight-guests',
        name: 'Overnight Guest Policy',
        status: 'unknown',
        affectedCategory: 'guests',
        direction,
        explanation: 'Strict overnight guest restrictions are required, but guest preferences are incomplete.',
      });
    } else if (sourceOvernight === 'not-comfortable' && targetOvernight === 'comfortable') {
      evaluations.push({
        id: 'overnight-guests',
        name: 'Overnight Guest Policy',
        status: 'failed',
        affectedCategory: 'guests',
        direction,
        explanation: 'Strict restriction on overnight guests conflicts with being comfortable hosting overnight guests frequently.',
      });
    } else {
      evaluations.push({
        id: 'overnight-guests',
        name: 'Overnight Guest Policy',
        status: 'passed',
        affectedCategory: 'guests',
        direction,
        explanation: 'Overnight guest expectations are compatible under current preferences.',
      });
    }
  }

  // 7. Dietary sharing constraint
  if (req.dietarySharing === 'required') {
    const sourceFood = source.budget?.foodPreference;
    const targetFood = target.budget?.foodPreference;
    const sourceSharing = source.budget?.foodSharing;
    const targetSharing = target.budget?.foodSharing;

    if (!sourceSharing || !targetSharing) {
      evaluations.push({
        id: 'dietary-sharing',
        name: 'Dietary & Grocery Sharing',
        status: 'unknown',
        affectedCategory: 'lifestyle',
        direction,
        explanation: 'Dietary sharing policy is strictly required, but grocery-sharing preferences are missing.',
      });
    } else if (sourceSharing === 'share-groceries' && targetSharing === 'separate-groceries') {
      evaluations.push({
        id: 'dietary-sharing',
        name: 'Dietary & Grocery Sharing',
        status: 'failed',
        affectedCategory: 'lifestyle',
        direction,
        explanation: 'Grocery and meal sharing is strictly required, conflicting with a preference for strictly separate groceries.',
      });
    } else if (
      sourceSharing === 'share-groceries' &&
      (sourceFood === 'vegetarian' || sourceFood === 'vegan') &&
      targetFood === 'non-vegetarian'
    ) {
      evaluations.push({
        id: 'dietary-sharing',
        name: 'Dietary & Grocery Sharing',
        status: 'failed',
        affectedCategory: 'lifestyle',
        direction,
        explanation: 'Grocery and food sharing is strictly required, but vegetarian/vegan requirements conflict with non-vegetarian food sharing.',
      });
    } else {
      evaluations.push({
        id: 'dietary-sharing',
        name: 'Dietary & Grocery Sharing',
        status: 'passed',
        affectedCategory: 'lifestyle',
        direction,
        explanation: 'Dietary sharing preferences align with mutual expectations.',
      });
    }
  }

  return evaluations;
}

export function evaluateHardConstraints(
  userPref: MatchingPreferencesInput,
  candidatePref: MatchingPreferencesInput,
): { constraints: ConstraintEvaluation[]; hasViolation: boolean } {
  const userToCandidate = evaluateOneDirectionConstraints(userPref, candidatePref, 'user-to-candidate');
  const candidateToUser = evaluateOneDirectionConstraints(candidatePref, userPref, 'candidate-to-user');

  const allConstraints = [...userToCandidate, ...candidateToUser];
  const hasViolation = allConstraints.some(c => c.status === 'failed');

  return {
    constraints: allConstraints,
    hasViolation,
  };
}
