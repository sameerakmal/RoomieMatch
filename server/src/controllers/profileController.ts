import type { RequestHandler } from 'express';
import { User, publicUser } from '../models/User.js';
import { HttpError } from '../utils/HttpError.js';
import { validateProfileUpdate } from '../utils/validation.js';

export const getProfile: RequestHandler = (request, response) => {
  response.json({ user: publicUser(request.user!) });
};
export const updateProfile: RequestHandler = async (request, response) => {
  const update = validateProfileUpdate(request.body);
  const fields: Record<string, string | number | null> = {};
  if (update.name !== undefined) fields.name = update.name;
  // Use dotted $set paths so partial profile edits preserve all other fields.
  for (const [key, value] of Object.entries(update.profile ?? {})) fields[`profile.${key}`] = value;
  const user = await User.findByIdAndUpdate(request.user!._id, { $set: fields }, { new: true, runValidators: true });
  if (!user) throw new HttpError(401, 'Please log in to continue.');
  response.json({ user: publicUser(user) });
};
