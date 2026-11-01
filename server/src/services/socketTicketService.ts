import { createHash, randomBytes } from 'node:crypto';
import { SocketTicket } from '../models/SocketTicket.js';
import { RevokedSession } from '../models/RevokedSession.js';
import type { AuthSession } from './authService.js';
import { HttpError } from '../utils/HttpError.js';

export const socketTicketLifetimeMs = 30_000;
export const hashTicket = (ticket: string): string => createHash('sha256').update(ticket).digest('hex');

export async function sessionIsActive(hash: string, expiresAt: Date): Promise<boolean> {
  return expiresAt.getTime() > Date.now() && !await RevokedSession.exists({ _id: hash });
}

export async function issueSocketTicket(session: AuthSession, origin: string) {
  if (!await sessionIsActive(session.hash, session.expiresAt)) throw new HttpError(401, 'Please log in to continue.');
  const ticket = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Math.min(Date.now() + socketTicketLifetimeMs, session.expiresAt.getTime()));
  await SocketTicket.create({ _id: hashTicket(ticket), userId: session.userId, sessionHash: session.hash,
    sessionExpiresAt: session.expiresAt, origin, expiresAt });
  return { ticket, expiresAt: expiresAt.toISOString() };
}

export async function consumeSocketTicket(ticket: unknown, origin: string) {
  if (typeof ticket !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(ticket)) return null;
  const now = new Date();
  // One atomic delete returns the record to exactly one caller, including across processes.
  // TTL cleanup is asynchronous; expiry must always be part of this predicate.
  const record = await SocketTicket.findOneAndDelete({ _id: hashTicket(ticket), origin,
    expiresAt: { $gt: now }, sessionExpiresAt: { $gt: now } }, { writeConcern: { w: 'majority' } });
  if (!record || !await sessionIsActive(record.sessionHash, record.sessionExpiresAt)) return null;
  return record;
}

export async function revokeSession(session: AuthSession): Promise<void> {
  // Persist revocation first: racing issuers/consumers must still fail the session check.
  await RevokedSession.updateOne({ _id: session.hash }, { $set: { expiresAt: session.expiresAt } }, { upsert: true, writeConcern: { w: 'majority' } });
  await SocketTicket.deleteMany({ sessionHash: session.hash });
}
