import type { RequestHandler } from 'express';
import {
  RoommatePreferences,
  publicPreferences,
} from '../models/RoommatePreferences.js';
import {
  calculateCompletionStatus,
  validatePartialPreferences,
  validatePreferences,
} from '../utils/preferencesValidation.js';

export const getPreferences: RequestHandler = async (request, response) => {
  const preferences = await RoommatePreferences.findOne({ userId: request.user!._id });
  response.json({ preferences: preferences ? publicPreferences(preferences) : null });
};

export const upsertPreferences: RequestHandler = async (request, response) => {
  const validated = validatePreferences(request.body);
  const existing = await RoommatePreferences.findOne({ userId: request.user!._id });

  const isCompleted = true;
  const completedAt = existing?.completedAt ?? new Date();

  const preferences = await RoommatePreferences.findOneAndUpdate(
    { userId: request.user!._id },
    {
      $set: {
        userId: request.user!._id,
        sleepSchedule: validated.sleepSchedule,
        cleanliness: validated.cleanliness,
        noise: validated.noise,
        guests: validated.guests,
        budget: validated.budget,
        requirements: validated.requirements ?? existing?.requirements ?? {},
        isCompleted,
        completedAt,
      },
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );

  response.json({ preferences: publicPreferences(preferences) });
};

export const patchPreferences: RequestHandler = async (request, response) => {
  const validated = validatePartialPreferences(request.body);

  let preferences = await RoommatePreferences.findOne({ userId: request.user!._id });
  if (!preferences) {
    preferences = new RoommatePreferences({
      userId: request.user!._id,
      ...validated,
    });
  } else {
    if (validated.sleepSchedule) preferences.sleepSchedule = validated.sleepSchedule;
    if (validated.cleanliness) preferences.cleanliness = validated.cleanliness;
    if (validated.noise) preferences.noise = validated.noise;
    if (validated.guests) preferences.guests = validated.guests;
    if (validated.budget) preferences.budget = validated.budget;
    if (validated.requirements) {
      preferences.requirements = {
        ...preferences.requirements,
        ...validated.requirements,
      } as any;
    }
  }

  const status = calculateCompletionStatus(preferences);
  preferences.isCompleted = status.isCompleted;
  if (status.isCompleted && !preferences.completedAt) {
    preferences.completedAt = new Date();
  } else if (!status.isCompleted) {
    preferences.completedAt = null;
  }

  await preferences.save();

  response.json({ preferences: publicPreferences(preferences) });
};

export const getPreferencesStatus: RequestHandler = async (request, response) => {
  const preferences = await RoommatePreferences.findOne({ userId: request.user!._id });
  const status = calculateCompletionStatus(preferences);
  response.json({ status });
};
