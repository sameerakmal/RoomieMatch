import type { RequestHandler } from 'express';
import mongoose from 'mongoose';
import { User, type UserDocument } from '../models/User.js';
import { RoommatePreferences, type RoommatePreferencesRecord } from '../models/RoommatePreferences.js';
import { calculateCompatibility } from '../services/matching/matchingEngine.js';
import type { MatchDiscoveryItem, SafeCandidateProfile } from '../services/matching/matchingTypes.js';
import { HttpError } from '../utils/HttpError.js';

function toSafeProfile(user: UserDocument): SafeCandidateProfile {
  return {
    id: user._id.toString(),
    name: user.name,
    profile: {
      city: user.profile?.city ?? '',
      occupation: user.profile?.occupation ?? '',
      bio: user.profile?.bio ?? '',
      profilePhotoUrl: user.profile?.profilePhotoUrl ?? '',
      age: user.profile?.age ?? null,
      moveInDate: user.profile?.moveInDate ? user.profile.moveInDate.toISOString().slice(0, 10) : null,
    },
  };
}

export const getMatches: RequestHandler = async (request, response) => {
  const currentUserId = request.user!._id;

  // 1. Ensure authenticated user has completed preferences
  const userPreferences = await RoommatePreferences.findOne({ userId: currentUserId });
  if (!userPreferences || !userPreferences.isCompleted) {
    throw new HttpError(
      400,
      'Please complete your roommate preferences questionnaire before discovering matches.',
      { code: 'PREFERENCES_INCOMPLETE' },
    );
  }

  // 2. Parse and validate query parameters
  const page = Math.max(1, parseInt(String(request.query.page || '1'), 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(request.query.limit || '10'), 10) || 10));

  const cityFilter = typeof request.query.city === 'string' ? request.query.city.trim() : undefined;
  const minScoreFilter = request.query.minScore ? parseInt(String(request.query.minScore), 10) : undefined;
  const accomFilter = typeof request.query.accommodationType === 'string' ? request.query.accommodationType.trim() : undefined;
  const minBudgetFilter = request.query.minBudget ? parseInt(String(request.query.minBudget), 10) : undefined;
  const maxBudgetFilter = request.query.maxBudget ? parseInt(String(request.query.maxBudget), 10) : undefined;

  // 3. Query candidate preferences with completed status, excluding authenticated user
  const prefQuery: mongoose.FilterQuery<RoommatePreferencesRecord> = {
    userId: { $ne: currentUserId },
    isCompleted: true,
  };

  if (accomFilter && accomFilter !== 'all') {
    prefQuery['budget.accommodationType'] = { $in: [accomFilter, 'no-preference'] };
  }
  if (minBudgetFilter !== undefined && !Number.isNaN(minBudgetFilter)) {
    prefQuery['budget.maxRent'] = { $gte: minBudgetFilter };
  }
  if (maxBudgetFilter !== undefined && !Number.isNaN(maxBudgetFilter)) {
    prefQuery['budget.minRent'] = { $lte: maxBudgetFilter };
  }

  const candidatePreferencesList = await RoommatePreferences.find(prefQuery)
    .populate<{ userId: UserDocument }>('userId', 'name profile')
    .lean();

  // 4. Calculate compatibility and filter eligible candidates
  const items: MatchDiscoveryItem[] = [];

  for (const candidatePref of candidatePreferencesList) {
    const candidateUser = candidatePref.userId as unknown as UserDocument;
    if (!candidateUser || !candidateUser._id) {
      continue;
    }

    // Apply city filter if requested
    if (cityFilter) {
      const candidateCity = (candidateUser.profile?.city || '').toLowerCase();
      if (!candidateCity.includes(cityFilter.toLowerCase())) {
        continue;
      }
    }

    // Compute compatibility
    const compatibility = calculateCompatibility(userPreferences, candidatePref);

    // Hard constraint violation or insufficient data excludes candidate
    if (!compatibility.isEligible || compatibility.overallScore === null) {
      continue;
    }

    // Apply minScore filter if specified
    if (minScoreFilter !== undefined && !Number.isNaN(minScoreFilter)) {
      if (compatibility.overallScore < minScoreFilter) {
        continue;
      }
    }

    items.push({
      candidate: toSafeProfile(candidateUser),
      compatibility,
    });
  }

  // 5. Sort candidates by descending compatibility score
  items.sort((a, b) => (b.compatibility.overallScore ?? 0) - (a.compatibility.overallScore ?? 0));

  // 6. Paginate results
  const total = items.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const startIndex = (page - 1) * limit;
  const paginatedMatches = items.slice(startIndex, startIndex + limit);

  response.json({
    matches: paginatedMatches,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  });
};

export const getMatchDetails: RequestHandler = async (request, response) => {
  const currentUserId = request.user!._id;
  const targetUserId = Array.isArray(request.params.userId) ? request.params.userId[0] : request.params.userId;

  if (!targetUserId || !mongoose.Types.ObjectId.isValid(targetUserId)) {
    throw new HttpError(400, 'Invalid user ID format.');
  }

  if (currentUserId.toString() === targetUserId) {
    throw new HttpError(400, 'Cannot calculate roommate compatibility with yourself.');
  }

  // 1. Verify current user's preferences
  const userPreferences = await RoommatePreferences.findOne({ userId: currentUserId });
  if (!userPreferences || !userPreferences.isCompleted) {
    throw new HttpError(
      400,
      'Please complete your roommate preferences questionnaire before viewing match details.',
      { code: 'PREFERENCES_INCOMPLETE' },
    );
  }

  // 2. Verify target candidate and preferences
  const targetUser = await User.findById(targetUserId);
  if (!targetUser) {
    throw new HttpError(404, 'Roommate candidate not found.');
  }

  const candidatePreferences = await RoommatePreferences.findOne({ userId: targetUserId });
  if (!candidatePreferences || !candidatePreferences.isCompleted) {
    throw new HttpError(404, 'Candidate has not completed their roommate preferences.');
  }

  // 3. Calculate full compatibility
  const compatibility = calculateCompatibility(userPreferences, candidatePreferences);

  response.json({
    candidate: toSafeProfile(targetUser),
    compatibility,
  });
};
