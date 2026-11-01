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

const credentials = { name: 'Pref User', email: 'pref@example.com', password: 'Test-password-123' };

const samplePreferences = {
  sleepSchedule: {
    bedtime: '23:00',
    wakeUpTime: '07:00',
    consistency: 'somewhat-consistent',
    wakingEnvironment: 'quiet',
    dailyRoutine: 'working-professional',
    timeAtHome: 'partially-at-home',
  },
  cleanliness: {
    cleanlinessLevel: 'moderately-organized',
    cleaningFrequency: 'several-times-a-week',
    kitchenCleanliness: 'clean-same-day',
    bathroomCleaning: 'shared-schedule',
    sharedSpaceOrganization: 'moderately-tidy',
  },
  noise: {
    noiseTolerance: 'moderate',
    musicHabits: 'occasionally',
    studyWorkEnvironment: 'low-background-noise',
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    headphoneUsage: 'usually',
  },
  guests: {
    guestFrequency: 'occasionally',
    overnightGuests: 'occasionally',
    advanceNotice: 'preferred',
    socialLifestyle: 'balanced',
    sharedActivities: 'sometimes',
  },
  budget: {
    minRent: 15000,
    maxRent: 30000,
    accommodationType: 'apartment',
    foodPreference: 'vegetarian',
    foodSharing: 'flexible',
    smoking: 'smoke-free-required',
    alcohol: 'occasional-acceptable',
    pets: 'comfortable-with-pets',
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
  process.env.MONGODB_URI = database.getUri('roomiematch_pref_test');
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

async function account(overrides = {}) {
  const response = await request('/auth/register', { method: 'POST', body: { ...credentials, ...overrides } });
  assert.equal(response.status, 201);
  return { cookie: response.headers.get('set-cookie')!.split(';')[0], user: (await response.json()).user };
}

test('GET /api/preferences returns null when no preferences exist', async () => {
  const { cookie } = await account();
  const response = await request('/preferences', { cookie });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.preferences, null);
});

test('GET /api/preferences/status returns 0% when no preferences exist', async () => {
  const { cookie } = await account();
  const response = await request('/preferences/status', { cookie });
  assert.equal(response.status, 200);
  const { status } = await response.json();
  assert.equal(status.isCompleted, false);
  assert.equal(status.percent, 0);
  assert.equal(status.completedSections, 0);
  assert.equal(status.totalSections, 5);
  assert.equal(status.sections.sleepSchedule, false);
  assert.equal(status.sections.budget, false);
});

test('PUT /api/preferences saves complete questionnaire responses and computes sleep window', async () => {
  const { cookie, user } = await account();
  const response = await request('/preferences', { method: 'PUT', cookie, body: samplePreferences });
  assert.equal(response.status, 200);
  const { preferences } = await response.json();

  assert.equal(preferences.userId, user.id);
  assert.equal(preferences.isCompleted, true);
  assert.ok(preferences.completedAt);
  assert.equal(preferences.sleepSchedule.bedtime, '23:00');
  assert.equal(preferences.sleepSchedule.wakeUpTime, '07:00');
  assert.equal(preferences.sleepSchedule.sleepWindowHours, 8);
  assert.equal(preferences.cleanliness.cleanlinessLevel, 'moderately-organized');
  assert.equal(preferences.noise.noiseTolerance, 'moderate');
  assert.equal(preferences.guests.guestFrequency, 'occasionally');
  assert.equal(preferences.budget.minRent, 15000);
  assert.equal(preferences.budget.maxRent, 30000);
  assert.equal(preferences.requirements.smokeFree, 'required');

  const stored = await RoommatePreferences.findOne({ userId: user.id });
  assert.ok(stored);
  assert.equal(stored.isCompleted, true);
});

test('GET /api/preferences returns saved preferences across requests', async () => {
  const { cookie, user } = await account();
  await request('/preferences', { method: 'PUT', cookie, body: samplePreferences });

  const response = await request('/preferences', { cookie });
  assert.equal(response.status, 200);
  const { preferences } = await response.json();
  assert.equal(preferences.userId, user.id);
  assert.equal(preferences.isCompleted, true);
  assert.equal(preferences.budget.accommodationType, 'apartment');
});

test('PUT /api/preferences updates existing preferences', async () => {
  const { cookie } = await account();
  await request('/preferences', { method: 'PUT', cookie, body: samplePreferences });

  const updatedPrefs = {
    ...samplePreferences,
    budget: { ...samplePreferences.budget, minRent: 20000, maxRent: 40000 },
  };
  const response = await request('/preferences', { method: 'PUT', cookie, body: updatedPrefs });
  assert.equal(response.status, 200);
  const { preferences } = await response.json();
  assert.equal(preferences.budget.minRent, 20000);
  assert.equal(preferences.budget.maxRent, 40000);

  assert.equal(await RoommatePreferences.countDocuments(), 1);
});

test('PATCH /api/preferences partially updates specific sections and preserves others', async () => {
  const { cookie } = await account();
  // Start with just sleep schedule
  const patch1 = await request('/preferences', {
    method: 'PATCH',
    cookie,
    body: { sleepSchedule: samplePreferences.sleepSchedule },
  });
  assert.equal(patch1.status, 200);
  const { preferences: pref1 } = await patch1.json();
  assert.equal(pref1.isCompleted, false);
  assert.equal(pref1.sleepSchedule.bedtime, '23:00');
  assert.equal(pref1.cleanliness, null);

  // Check status is 20%
  const status1 = await (await request('/preferences/status', { cookie })).json();
  assert.equal(status1.status.percent, 20);
  assert.equal(status1.status.sections.sleepSchedule, true);
  assert.equal(status1.status.sections.cleanliness, false);

  // Now add cleanliness and noise
  const patch2 = await request('/preferences', {
    method: 'PATCH',
    cookie,
    body: { cleanliness: samplePreferences.cleanliness, noise: samplePreferences.noise },
  });
  assert.equal(patch2.status, 200);
  const { preferences: pref2 } = await patch2.json();
  assert.equal(pref2.sleepSchedule.bedtime, '23:00');
  assert.equal(pref2.cleanliness.cleanlinessLevel, 'moderately-organized');
  assert.equal(pref2.noise.noiseTolerance, 'moderate');

  // Check status is 60%
  const status2 = await (await request('/preferences/status', { cookie })).json();
  assert.equal(status2.status.percent, 60);
});

test('PATCH completing all 5 sections transitions isCompleted to true', async () => {
  const { cookie } = await account();
  await request('/preferences', {
    method: 'PATCH',
    cookie,
    body: {
      sleepSchedule: samplePreferences.sleepSchedule,
      cleanliness: samplePreferences.cleanliness,
      noise: samplePreferences.noise,
      guests: samplePreferences.guests,
    },
  });

  const beforeFinish = await (await request('/preferences/status', { cookie })).json();
  assert.equal(beforeFinish.status.isCompleted, false);
  assert.equal(beforeFinish.status.percent, 80);

  await request('/preferences', {
    method: 'PATCH',
    cookie,
    body: { budget: samplePreferences.budget },
  });

  const afterFinish = await (await request('/preferences/status', { cookie })).json();
  assert.equal(afterFinish.status.isCompleted, true);
  assert.equal(afterFinish.status.percent, 100);
  assert.ok(afterFinish.status.completedAt);
});

test('validation rejects minimum rent exceeding maximum rent', async () => {
  const { cookie } = await account();
  const invalidBudget = {
    ...samplePreferences,
    budget: { ...samplePreferences.budget, minRent: 50000, maxRent: 20000 },
  };
  const response = await request('/preferences', { method: 'PUT', cookie, body: invalidBudget });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.error.message, /Minimum rent cannot exceed maximum rent/);
});

test('validation rejects invalid enum values', async () => {
  const { cookie } = await account();
  const invalidEnum = {
    ...samplePreferences,
    sleepSchedule: { ...samplePreferences.sleepSchedule, consistency: 'unknown-value' },
  };
  const response = await request('/preferences', { method: 'PUT', cookie, body: invalidEnum });
  assert.equal(response.status, 400);
});

test('validation rejects invalid time formats', async () => {
  const { cookie } = await account();
  for (const bedtime of ['25:00', '11:65', '11pm', 'invalid', '']) {
    const invalidTime = {
      ...samplePreferences,
      sleepSchedule: { ...samplePreferences.sleepSchedule, bedtime },
    };
    const response = await request('/preferences', { method: 'PUT', cookie, body: invalidTime });
    assert.equal(response.status, 400);
  }
});

test('validation rejects unrecognized/disallowed fields', async () => {
  const { cookie } = await account();
  const unexpected = {
    ...samplePreferences,
    adminPrivilege: true,
  };
  const response = await request('/preferences', { method: 'PUT', cookie, body: unexpected });
  assert.equal(response.status, 400);
});

test('unauthenticated access is rejected with 401', async () => {
  const getRes = await request('/preferences');
  assert.equal(getRes.status, 401);

  const putRes = await request('/preferences', { method: 'PUT', body: samplePreferences });
  assert.equal(putRes.status, 401);

  const patchRes = await request('/preferences', { method: 'PATCH', body: { budget: samplePreferences.budget } });
  assert.equal(patchRes.status, 401);

  const statusRes = await request('/preferences/status');
  assert.equal(statusRes.status, 401);
});

test('users cannot access or modify each other preferences', async () => {
  const userA = await account({ email: 'userA@example.com' });
  const userB = await account({ email: 'userB@example.com', name: 'User B' });

  // User A creates preferences
  await request('/preferences', { method: 'PUT', cookie: userA.cookie, body: samplePreferences });

  // User B's preferences should be null
  const bResponse = await request('/preferences', { cookie: userB.cookie });
  assert.equal(bResponse.status, 200);
  assert.equal((await bResponse.json()).preferences, null);

  // User B creates their own preferences
  const bPrefs = {
    ...samplePreferences,
    budget: { ...samplePreferences.budget, minRent: 5000, maxRent: 10000 },
  };
  await request('/preferences', { method: 'PUT', cookie: userB.cookie, body: bPrefs });

  // User A's preferences are unchanged
  const aResponse = await request('/preferences', { cookie: userA.cookie });
  assert.equal(aResponse.status, 200);
  const aPref = (await aResponse.json()).preferences;
  assert.equal(aPref.budget.minRent, 15000);
  assert.equal(aPref.budget.maxRent, 30000);

  // User B's preferences are their own
  const bSaved = (await (await request('/preferences', { cookie: userB.cookie })).json()).preferences;
  assert.equal(bSaved.budget.minRent, 5000);
  assert.equal(bSaved.budget.maxRent, 10000);
});

test('mutations reject missing verification header', async () => {
  const { cookie } = await account();
  const response = await request('/preferences', {
    method: 'PUT',
    cookie,
    body: samplePreferences,
    headers: { 'X-RoomieMatch-Request': '' },
  });
  assert.equal(response.status, 403);
});

