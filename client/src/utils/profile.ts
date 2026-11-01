import type { User } from '../types';

export function profileCompletion(user: User) {
  const { city, occupation, age, moveInDate, bio, profilePhotoUrl } = user.profile;
  const completed = [user.name, city, occupation, age, moveInDate, bio, profilePhotoUrl].filter(Boolean).length;
  return { completed, total: 7, percent: Math.round(completed / 7 * 100) };
}
