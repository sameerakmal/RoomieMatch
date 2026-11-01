import { Schema, model, type HydratedDocument } from 'mongoose';
import { emailPattern, isPhotoUrl } from '../utils/validation.js';

export interface UserProfile {
  city: string;
  occupation: string;
  bio: string;
  profilePhotoUrl: string;
  age: number | null;
  moveInDate: Date | null;
}
export interface UserRecord {
  name: string;
  email: string;
  passwordHash: string;
  profile: UserProfile;
  createdAt: Date;
  updatedAt: Date;
}
const profileSchema = new Schema<UserProfile>({
  city: { type: String, trim: true, maxlength: 100, default: '' },
  occupation: { type: String, trim: true, maxlength: 100, default: '' },
  bio: { type: String, trim: true, maxlength: 500, default: '' },
  profilePhotoUrl: { type: String, trim: true, maxlength: 2048, validate: isPhotoUrl, default: '' },
  age: { type: Number, min: 18, max: 120, validate: (value: number | null) => value === null || Number.isInteger(value), default: null },
  moveInDate: { type: Date, default: null },
}, { _id: false, strict: 'throw' });
const userSchema = new Schema<UserRecord>({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254, match: emailPattern },
  passwordHash: { type: String, required: true, select: false },
  profile: { type: profileSchema, default: () => ({}) },
}, { timestamps: true, strict: 'throw', bufferCommands: false });

// Defense in depth for accidental serialization outside the explicit public DTO.
userSchema.set('toJSON', { transform(_document, result) { Reflect.deleteProperty(result, 'passwordHash'); Reflect.deleteProperty(result, '__v'); return result; } });
export const User = model<UserRecord>('User', userSchema);
export type UserDocument = HydratedDocument<UserRecord>;

export function publicUser(user: UserDocument) {
  return {
    id: user.id as string,
    name: user.name,
    email: user.email,
    profile: {
      city: user.profile.city,
      occupation: user.profile.occupation,
      bio: user.profile.bio,
      profilePhotoUrl: user.profile.profilePhotoUrl,
      age: user.profile.age,
      moveInDate: user.profile.moveInDate?.toISOString().slice(0, 10) ?? null,
    },
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
