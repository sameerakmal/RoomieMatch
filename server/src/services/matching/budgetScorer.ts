import type { Budget } from '../../models/RoommatePreferences.js';
import type { BudgetOverlapResult } from './matchingTypes.js';

export function calculateRentOverlap(
  budgetA: Budget,
  budgetB: Budget,
): { rentScore: number; overlapResult: BudgetOverlapResult } {
  const minA = budgetA.minRent;
  const maxA = budgetA.maxRent;
  const minB = budgetB.minRent;
  const maxB = budgetB.maxRent;

  const overlapMin = Math.max(minA, minB);
  const overlapMax = Math.min(maxA, maxB);
  const hasOverlap = overlapMin <= overlapMax;

  if (hasOverlap) {
    const overlapSpan = overlapMax - overlapMin;
    const spanA = maxA - minA;
    const spanB = maxB - minB;

    let effectiveRatio = 1;
    if (spanA > 0 || spanB > 0) {
      const ratioA = spanA > 0 ? overlapSpan / spanA : 1;
      const ratioB = spanB > 0 ? overlapSpan / spanB : 1;
      effectiveRatio = (ratioA + ratioB) / 2;
    }

    const rentScore = Math.min(100, Math.round(70 + 30 * effectiveRatio));
    return {
      rentScore,
      overlapResult: {
        hasOverlap: true,
        min: overlapMin,
        max: overlapMax,
        overlapSpan,
        userBudget: { min: minA, max: maxA },
        candidateBudget: { min: minB, max: maxB },
        explanation: `Overlapping monthly budget of ₹${overlapMin.toLocaleString()} – ₹${overlapMax.toLocaleString()} provides viable mutual rental options.`,
      },
    };
  }

  // No overlap: calculate gap
  const gap = overlapMin - overlapMax;
  const lowerMax = Math.min(maxA, maxB);
  const higherMin = Math.max(minA, minB);

  const relativeGap = lowerMax > 0 ? gap / lowerMax : 1;
  let rentScore = 0;
  if (relativeGap <= 0.15) {
    rentScore = Math.max(20, Math.round(55 * (1 - relativeGap / 0.15)));
  } else if (relativeGap <= 0.4) {
    rentScore = Math.max(5, Math.round(20 * (1 - (relativeGap - 0.15) / 0.25)));
  }

  return {
    rentScore,
    overlapResult: {
      hasOverlap: false,
      min: null,
      max: null,
      overlapSpan: 0,
      userBudget: { min: minA, max: maxA },
      candidateBudget: { min: minB, max: maxB },
      explanation: `No direct budget overlap: a difference of ₹${gap.toLocaleString()} exists between the upper limit (₹${lowerMax.toLocaleString()}) and the lower limit (₹${higherMin.toLocaleString()}).`,
    },
  };
}

export function scoreAccommodationType(
  typeA: Budget['accommodationType'],
  typeB: Budget['accommodationType'],
): number {
  if (typeA === 'no-preference' || typeB === 'no-preference') return 100;
  if (typeA === typeB) return 100;

  const pair = [typeA, typeB].sort().join(':');
  switch (pair) {
    case 'apartment:shared-house':
      return 80;
    case 'hostel:pg':
      return 80;
    case 'pg:shared-house':
      return 65;
    case 'apartment:pg':
      return 55;
    case 'apartment:hostel':
      return 35;
    default:
      return 50;
  }
}

export function scoreRoomArrangement(
  arrA: Budget['roomArrangement'],
  arrB: Budget['roomArrangement'],
): number {
  if (arrA === 'no-preference' || arrB === 'no-preference') return 100;
  if (arrA === arrB) return 100;
  return 30; // 'private-room' vs 'shared-room'
}

export function scoreBudgetAndAccommodation(
  budgetA?: Budget | null,
  budgetB?: Budget | null,
): { score: number | null; budgetOverlap: BudgetOverlapResult } {
  if (!budgetA || !budgetB) {
    return {
      score: null,
      budgetOverlap: {
        hasOverlap: false,
        min: null,
        max: null,
        overlapSpan: 0,
        userBudget: { min: budgetA?.minRent ?? 0, max: budgetA?.maxRent ?? 0 },
        candidateBudget: { min: budgetB?.minRent ?? 0, max: budgetB?.maxRent ?? 0 },
        explanation: 'Insufficient budget information to calculate financial compatibility.',
      },
    };
  }

  const { rentScore, overlapResult } = calculateRentOverlap(budgetA, budgetB);
  const accomScore = scoreAccommodationType(budgetA.accommodationType, budgetB.accommodationType);
  const roomScore = scoreRoomArrangement(budgetA.roomArrangement, budgetB.roomArrangement);

  const weightedScore = Math.round(rentScore * 0.60 + accomScore * 0.25 + roomScore * 0.15);

  return {
    score: Math.min(100, Math.max(0, weightedScore)),
    budgetOverlap: overlapResult,
  };
}

