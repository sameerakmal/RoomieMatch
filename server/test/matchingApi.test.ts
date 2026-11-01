import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server-core';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.JWT_EXPIRES_IN_SECONDS = '3600';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.COOKIE_SAME_SITE = 'lax';

let database: MongoMemoryServer;
let server: Server;
let baseUrl: string;
let User: typeof import('../src/models/User.js').User;
let RoommatePreferences: typeof import('../src/models/RoommatePreferences.js').RoommatePreferences;

const samplePreferences = {
  sleepSchedule: {
    bedtime: '23:00',
    wakeUpTime: '07:00',
    consistency: 'very-consistent',
    wakingEnvironment: 'quiet',
    dailyRoutine: 'working-professional',
    timeAtHome: 'partially-at-home',
  },
  cleanliness: {
    cleanlinessLevel: 'very-organized',
    cleaningFrequency: 'daily',
    kitchenCleanliness: 'clean-immediately',
    bathroomCleaning: 'shared-schedule',
    sharedSpaceOrganization: 'very-tidy',
  },
  noise: {
    noiseTolerance: 'moderate',
    musicHabits: 'rarely',
    studyWorkEnvironment: 'silent',
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    headphoneUsage: 'always',
  },
  guests: {
    guestFrequency: 'rarely',
    overnightGuests: 'not-comfortable',
    advanceNotice: 'required',
    socialLifestyle: 'introverted',
    sharedActivities: 'sometimes',
  },
  budget: {
    minRent: 15000,
    maxRent: 30000,
    accommodationType: 'apartment',
    foodPreference: 'vegetarian',
    foodSharing: 'flexible',
    smoking: 'smoke-free-required',
    alcohol: 'alcohol-free-preferred',
    pets: 'prefer-no-pets',
    roomArrangement: 'private-room',
  },
  requirements: {
    quietEnvironment: 'preferred',
    smokeFree: 'required',
    petFree: 'preferred',
    alcoholFree: 'preferred',
    cleanlinessLevel: 'preferred',
    overnightGuestPolicy: 'preferred',
    dietarySharing: 'preferred',
  },
};

before(async () => {
  database = await MongoMemoryServer.create({ binary: { version: '8.0.17', downloadDir: join(tmpdir(), 'roomiematch-mongodb') } });
  process.env.MONGODB_URI = database.getUri('roomiematch_match_test');
  ({ User } = await import('../src/models/User.js'));
  ({ RoommatePreferences } = await import('../src/models/RoommatePreferences.js'));
  const { connectDatabase } = await import('../src/config/database.js');
  await connectDatabase();
  const { app } = await import('../src/app.js');
  await new Promise<void>(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, { timeout: 180000 });

beforeEach(async () => {
  await User.deleteMany({});
  await RoommatePreferences.deleteMany({});
});

after(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await mongoose.disconnect();
  if (database) await database.stop();
});

async function request(path: string, options: { method?: string; body?: unknown; cookie?: string; headers?: Record<string, string> } = {}) {
  return fetch(`${baseUrl}/api${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-RoomieMatch-Request': 'web',
      Origin: 'http://localhost:5173',
      ...(options.cookie ? { Cookie: options.cookie } : {}),
      ...options.headers,
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
}

async function createAccount(name: string, email: string, city = 'Mumbai') {
  const response = await request('/auth/register', {
    method: 'POST',
    body: { name, email, password: 'SecurePassword-123' },
  });
  assert.equal(response.status, 201);
  const cookie = response.headers.get('set-cookie')!.split(';')[0];
  const user = (await response.json()).user;

  // Set city
  const profRes = await request('/profile', {
    method: 'PATCH',
    cookie,
    body: { profile: { city, occupation: 'Architect', bio: 'Love calm spaces.' } },
  });
  assert.equal(profRes.status, 200);

  return { cookie, user };
}

test('GET /api/matches: unauthenticated discovery is rejected with 401', async () => {
  const response = await request('/matches');
  assert.equal(response.status, 401);
});

test('GET /api/matches: user without completed questionnaire receives 400', async () => {
  const { cookie } = await createAccount('User Incomplete', 'incomplete@example.com');
  const response = await request('/matches', { cookie });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.error.message, /complete your roommate preferences questionnaire/i);
});

test('GET /api/matches: excludes current user and candidates without completed preferences', async () => {
  const userA = await createAccount('User A', 'usera@example.com');
  const userB = await createAccount('User B', 'userb@example.com');
  const userC = await createAccount('User C Incomplete', 'userc@example.com');

  // User A and User B complete preferences
  await request('/preferences', { method: 'PUT', cookie: userA.cookie, body: samplePreferences });
  await request('/preferences', { method: 'PUT', cookie: userB.cookie, body: samplePreferences });
  // User C leaves preferences incomplete

  const response = await request('/matches', { cookie: userA.cookie });
  assert.equal(response.status, 200);
  const data = await response.json();

  assert.equal(data.matches.length, 1);
  assert.equal(data.matches[0].candidate.id, userB.user.id);
  assert.equal(data.matches[0].candidate.name, 'User B');
});

test('GET /api/matches: candidates violating hard constraints are excluded from discovery recommendations', async () => {
  const strictUser = await createAccount('Strict User', 'strict@example.com');
  const incompatibleCandidate = await createAccount('Incompatible User', 'incompatible@example.com');
  const compatibleCandidate = await createAccount('Compatible User', 'compatible@example.com');

  // Strict user requires high cleanliness
  const strictPrefs = {
    ...samplePreferences,
    cleanliness: { ...samplePreferences.cleanliness, cleanlinessLevel: 'very-organized' },
    requirements: { ...samplePreferences.requirements, cleanlinessLevel: 'required' },
  };
  await request('/preferences', { method: 'PUT', cookie: strictUser.cookie, body: strictPrefs });

  // Incompatible candidate has relaxed cleanliness
  const relaxedPrefs = {
    ...samplePreferences,
    cleanliness: { ...samplePreferences.cleanliness, cleanlinessLevel: 'relaxed' },
  };
  await request('/preferences', { method: 'PUT', cookie: incompatibleCandidate.cookie, body: relaxedPrefs });

  // Compatible candidate has very-organized cleanliness
  const organizedPrefs = {
    ...samplePreferences,
    cleanliness: { ...samplePreferences.cleanliness, cleanlinessLevel: 'very-organized' },
  };
  await request('/preferences', { method: 'PUT', cookie: compatibleCandidate.cookie, body: organizedPrefs });

  const response = await request('/matches', { cookie: strictUser.cookie });
  assert.equal(response.status, 200);
  const data = await response.json();

  assert.equal(data.matches.length, 1);
  assert.equal(data.matches[0].candidate.id, compatibleCandidate.user.id);
});

test('GET /api/matches: sorts candidates by descending compatibility score', async () => {
  const mainUser = await createAccount('Main User', 'main@example.com');
  const highMatch = await createAccount('High Match', 'high@example.com');
  const moderateMatch = await createAccount('Moderate Match', 'moderate@example.com');

  await request('/preferences', { method: 'PUT', cookie: mainUser.cookie, body: samplePreferences });

  // Identical preferences (high score)
  await request('/preferences', { method: 'PUT', cookie: highMatch.cookie, body: samplePreferences });

  // Moderate preferences (different budget and hours)
  const moderatePrefs = {
    ...samplePreferences,
    budget: { ...samplePreferences.budget, minRent: 28000, maxRent: 40000, accommodationType: 'shared-house' },
    sleepSchedule: { ...samplePreferences.sleepSchedule, bedtime: '01:00', wakeUpTime: '09:00' },
  };
  await request('/preferences', { method: 'PUT', cookie: moderateMatch.cookie, body: moderatePrefs });

  const response = await request('/matches', { cookie: mainUser.cookie });
  assert.equal(response.status, 200);
  const data = await response.json();

  assert.equal(data.matches.length, 2);
  assert.equal(data.matches[0].candidate.id, highMatch.user.id);
  assert.ok(data.matches[0].compatibility.overallScore >= data.matches[1].compatibility.overallScore);
});

test('GET /api/matches: pagination works correctly', async () => {
  const mainUser = await createAccount('Main User', 'main2@example.com');
  await request('/preferences', { method: 'PUT', cookie: mainUser.cookie, body: samplePreferences });

  for (let i = 1; i <= 5; i++) {
    const candidate = await createAccount(`Cand ${i}`, `cand${i}@example.com`);
    await request('/preferences', { method: 'PUT', cookie: candidate.cookie, body: samplePreferences });
  }

  // Page 1, limit 2
  const p1Res = await request('/matches?page=1&limit=2', { cookie: mainUser.cookie });
  assert.equal(p1Res.status, 200);
  const p1 = await p1Res.json();
  assert.equal(p1.matches.length, 2);
  assert.equal(p1.pagination.page, 1);
  assert.equal(p1.pagination.limit, 2);
  assert.equal(p1.pagination.total, 5);
  assert.equal(p1.pagination.totalPages, 3);

  // Page 3, limit 2
  const p3Res = await request('/matches?page=3&limit=2', { cookie: mainUser.cookie });
  const p3 = await p3Res.json();
  assert.equal(p3.matches.length, 1);
});

test('GET /api/matches: filters candidates by city and budget', async () => {
  const mainUser = await createAccount('Main User', 'main_filt@example.com', 'Bengaluru');
  await request('/preferences', { method: 'PUT', cookie: mainUser.cookie, body: samplePreferences });

  // Candidate 1: Bengaluru
  const candBlr = await createAccount('Blr User', 'blr@example.com', 'Bengaluru');
  await request('/preferences', { method: 'PUT', cookie: candBlr.cookie, body: samplePreferences });

  // Candidate 2: Delhi
  const candDel = await createAccount('Del User', 'del@example.com', 'New Delhi');
  await request('/preferences', { method: 'PUT', cookie: candDel.cookie, body: samplePreferences });

  // Filter by city: Bengaluru
  const blrRes = await request('/matches?city=bengaluru', { cookie: mainUser.cookie });
  assert.equal(blrRes.status, 200);
  const blrData = await blrRes.json();
  assert.equal(blrData.matches.length, 1);
  assert.equal(blrData.matches[0].candidate.id, candBlr.user.id);
});

test('GET /api/matches: private credentials and raw questionnaire are never exposed', async () => {
  const mainUser = await createAccount('Main User', 'main_sec@example.com');
  const candidate = await createAccount('Secret Candidate', 'cand_sec@example.com');

  await request('/preferences', { method: 'PUT', cookie: mainUser.cookie, body: samplePreferences });
  await request('/preferences', { method: 'PUT', cookie: candidate.cookie, body: samplePreferences });

  const response = await request('/matches', { cookie: mainUser.cookie });
  assert.equal(response.status, 200);
  const data = await response.json();
  const match = data.matches[0];

  assert.equal(match.candidate.name, 'Secret Candidate');
  assert.equal((match.candidate as any).email, undefined);
  assert.equal((match.candidate as any).passwordHash, undefined);
  assert.equal((match as any).rawPreferences, undefined);
});

test('GET /api/matches/:userId: returns detailed compatibility breakdown for valid candidate', async () => {
  const userA = await createAccount('User A', 'det_a@example.com');
  const userB = await createAccount('User B', 'det_b@example.com');

  await request('/preferences', { method: 'PUT', cookie: userA.cookie, body: samplePreferences });
  await request('/preferences', { method: 'PUT', cookie: userB.cookie, body: samplePreferences });

  const response = await request(`/matches/${userB.user.id}`, { cookie: userA.cookie });
  assert.equal(response.status, 200);
  const data = await response.json();

  assert.equal(data.candidate.id, userB.user.id);
  assert.equal((data.candidate as any).email, undefined);
  assert.ok(data.compatibility.overallScore >= 95);
  assert.equal(data.compatibility.dataCoverage, 100);
  assert.ok(data.compatibility.categories.sleep.score > 0);
  assert.ok(data.compatibility.categories.cleanliness.score > 0);
  assert.ok(data.compatibility.categories.noise.score > 0);
  assert.ok(data.compatibility.categories.guests.score > 0);
  assert.ok(data.compatibility.categories.budget.score > 0);
  assert.ok(data.compatibility.categories.lifestyle.score > 0);
  assert.equal(data.compatibility.budgetOverlap.hasOverlap, true);
  assert.ok(data.compatibility.strengths.length > 0);
});

test('GET /api/matches/:userId: returns 400 when requesting compatibility with oneself', async () => {
  const userA = await createAccount('User Self', 'self@example.com');
  await request('/preferences', { method: 'PUT', cookie: userA.cookie, body: samplePreferences });

  const response = await request(`/matches/${userA.user.id}`, { cookie: userA.cookie });
  assert.equal(response.status, 400);
});

test('GET /api/matches/:userId: returns 404 for nonexistent candidate or incomplete candidate', async () => {
  const userA = await createAccount('User A', 'test_404@example.com');
  await request('/preferences', { method: 'PUT', cookie: userA.cookie, body: samplePreferences });

  const nonexistentId = new mongoose.Types.ObjectId().toString();
  const res1 = await request(`/matches/${nonexistentId}`, { cookie: userA.cookie });
  assert.equal(res1.status, 404);

  const incompleteUser = await createAccount('Incomplete Cand', 'incomp_cand@example.com');
  const res2 = await request(`/matches/${incompleteUser.user.id}`, { cookie: userA.cookie });
  assert.equal(res2.status, 404);
});
