import type { BudgetOverlapResult, CategoryKey, CategoryScoreResult, MatchingPreferencesInput } from './matchingTypes.js';
import { circularTimeDifferenceMinutes } from './categoryScorers.js';

export function generateMatchExplanations(
  userPref: MatchingPreferencesInput,
  candidatePref: MatchingPreferencesInput,
  categoryScores: Record<CategoryKey, CategoryScoreResult>,
  budgetOverlap: BudgetOverlapResult,
  overallScore: number | null,
): { strengths: string[]; differences: string[]; summary: string } {
  const strengths: string[] = [];
  const differences: string[] = [];

  const sleepA = userPref.sleepSchedule;
  const sleepB = candidatePref.sleepSchedule;
  if (sleepA && sleepB) {
    const bedtimeDiff = circularTimeDifferenceMinutes(sleepA.bedtime, sleepB.bedtime);
    const wakeDiff = circularTimeDifferenceMinutes(sleepA.wakeUpTime, sleepB.wakeUpTime);

    if (categoryScores.sleep.score >= 80) {
      if (bedtimeDiff <= 60 && wakeDiff <= 60) {
        strengths.push('Close daily rhythms with synchronized sleep and wake schedules.');
      } else if (sleepA.consistency === sleepB.consistency) {
        strengths.push(`Both maintain a ${sleepA.consistency.replace('-', ' ')} daily routine.`);
      } else {
        strengths.push('Compatible overall sleep schedules and morning habits.');
      }
    } else if (categoryScores.sleep.score < 70) {
      if (bedtimeDiff > 120) {
        differences.push(`Bedtime difference of approximately ${(bedtimeDiff / 60).toFixed(1)} hours.`);
      }
      if (sleepA.wakingEnvironment !== sleepB.wakingEnvironment) {
        differences.push('Different morning wake-up environment preferences (quiet vs. normal activity).');
      }
    }
  }

  const cleanA = userPref.cleanliness;
  const cleanB = candidatePref.cleanliness;
  if (cleanA && cleanB) {
    if (categoryScores.cleanliness.score >= 80) {
      if (cleanA.cleanlinessLevel === cleanB.cleanlinessLevel) {
        strengths.push(`Mutual expectation of a ${cleanA.cleanlinessLevel.replace('-', ' ')} shared home.`);
      }
      if (cleanA.kitchenCleanliness === cleanB.kitchenCleanliness) {
        strengths.push(`Shared kitchen standard: ${cleanA.kitchenCleanliness.replace('-', ' ')}.`);
      }
    } else if (categoryScores.cleanliness.score < 70) {
      if (cleanA.cleanlinessLevel !== cleanB.cleanlinessLevel) {
        differences.push(`Cleanliness standard difference: ${cleanA.cleanlinessLevel.replace('-', ' ')} versus ${cleanB.cleanlinessLevel.replace('-', ' ')}.`);
      }
      if (cleanA.kitchenCleanliness !== cleanB.kitchenCleanliness) {
        differences.push(`Different kitchen cleanup expectations (${cleanA.kitchenCleanliness.replace('-', ' ')} vs ${cleanB.kitchenCleanliness.replace('-', ' ')}).`);
      }
    }
  }

  const noiseA = userPref.noise;
  const noiseB = candidatePref.noise;
  if (noiseA && noiseB) {
    if (categoryScores.noise.score >= 80) {
      strengths.push(`Compatible sound habits and quiet hours (${noiseA.quietHoursStart}–${noiseA.quietHoursEnd}).`);
    } else if (categoryScores.noise.score < 70) {
      if (noiseA.noiseTolerance !== noiseB.noiseTolerance) {
        differences.push(`Different noise tolerance levels (${noiseA.noiseTolerance} vs ${noiseB.noiseTolerance}).`);
      }
      if (noiseA.studyWorkEnvironment !== noiseB.studyWorkEnvironment && noiseA.studyWorkEnvironment !== 'doesnt-matter' && noiseB.studyWorkEnvironment !== 'doesnt-matter') {
        differences.push(`Different study/work environment needs (${noiseA.studyWorkEnvironment} vs ${noiseB.studyWorkEnvironment}).`);
      }
    }
  }

  const guestsA = userPref.guests;
  const guestsB = candidatePref.guests;
  if (guestsA && guestsB) {
    if (categoryScores.guests.score >= 80) {
      if (guestsA.advanceNotice === guestsB.advanceNotice) {
        strengths.push(`Aligned advance notice expectation for visitors (${guestsA.advanceNotice}).`);
      } else {
        strengths.push('Compatible boundaries around social gatherings and guests.');
      }
    } else if (categoryScores.guests.score < 70) {
      if (guestsA.overnightGuests !== guestsB.overnightGuests) {
        differences.push(`Different comfort levels regarding overnight visitors (${guestsA.overnightGuests.replace('-', ' ')} vs ${guestsB.overnightGuests.replace('-', ' ')}).`);
      }
      if (guestsA.guestFrequency !== guestsB.guestFrequency) {
        differences.push(`Differing guest frequency preferences (${guestsA.guestFrequency} vs ${guestsB.guestFrequency}).`);
      }
    }
  }

  const budgetA = userPref.budget;
  const budgetB = candidatePref.budget;
  if (budgetA && budgetB) {
    if (budgetOverlap.hasOverlap) {
      strengths.push(`Mutual monthly budget overlap of ₹${budgetOverlap.min?.toLocaleString()} – ₹${budgetOverlap.max?.toLocaleString()}.`);
      if (budgetA.accommodationType === budgetB.accommodationType && budgetA.accommodationType !== 'no-preference') {
        strengths.push(`Both prefer ${budgetA.accommodationType.replace('-', ' ')} accommodation.`);
      }
    } else {
      differences.push(budgetOverlap.explanation);
    }
  }

  const lifestyleScore = categoryScores.lifestyle.score;
  if (lifestyleScore >= 80 && budgetA && budgetB) {
    if (budgetA.smoking === 'smoke-free-required' && (budgetB.smoking === 'smoke-free-required' || budgetB.smoking === 'non-smokers-only')) {
      strengths.push('Both commit to maintaining a smoke-free household.');
    }
    if (budgetA.pets === budgetB.pets) {
      strengths.push(`Matching pet living arrangement (${budgetA.pets.replace(/-/g, ' ')}).`);
    }
  }

  // Summary generation based on calculated score
  let summary = 'Compatibility calculated based on lifestyle questionnaire responses.';
  if (overallScore === null) {
    summary = 'Insufficient questionnaire data to calculate an overall compatibility score.';
  } else if (overallScore >= 85) {
    summary = 'Exceptionally high compatibility across daily schedules, home cleanliness, and living boundaries.';
  } else if (overallScore >= 75) {
    summary = 'Strong compatibility with well-matched routines and easily manageable lifestyle differences.';
  } else if (overallScore >= 60) {
    summary = 'Moderate compatibility with shared core preferences, along with several areas that benefit from clear discussion.';
  } else {
    summary = 'Low compatibility with notable divergences across key everyday habits and expectations.';
  }

  return {
    strengths: strengths.slice(0, 5),
    differences: differences.slice(0, 5),
    summary,
  };
}
