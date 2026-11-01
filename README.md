# RoomieMatch

Roommate discovery, built around the way people live. Phase 2 adds real authentication and basic profiles to the existing React/Vite and Express/Mongoose foundation. The warm editorial design, fonts, local photography, and reusable components are preserved.

## Requirements

- Node.js **22.14+** and npm (`.nvmrc` selects Node 22).
- MongoDB running locally, or a MongoDB Atlas cluster.
- HTTPS for production cookie authentication.

## Install and run

Run from the repository root:

```sh
npm ci
cp -n server/.env.example server/.env
```

Generate a signing secret locally:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Paste that value into `JWT_SECRET` in `server/.env`. Set `MONGODB_URI` to your own database URI. The example uses `mongodb://127.0.0.1:27017/roomiematch`; start your local MongoDB service before starting RoomieMatch. Never commit real environment files or share the signing secret.

```sh
npm run dev
```

Open **http://127.0.0.1:5173**. The API runs on **http://localhost:4000**. Vite proxies `/api` to Express. Use the same frontend hostname consistently: cookies set for `127.0.0.1` are not shared with `localhost`. Stop both applications with Ctrl+C.

No client `.env` is required for this setup. If desired:

```sh
cp -n client/.env.example client/.env
```

`JWT_SECRET` is required in every environment. With no `MONGODB_URI`, the development server can still serve health checks, but account endpoints return 503. A configured but unreachable database stops startup after a bounded timeout. This does not create fake accounts or substitute local storage for MongoDB.

### Runtime available in this workspace

Node.js was not on this machine's PATH. A checksum-verified official Node.js 22.23.4 runtime was used from temporary storage. While it remains available, prefix the setup above with:

```sh
export PATH="/private/tmp/node-v22.23.4-darwin-arm64/bin:$PATH"
```

Install Node.js normally for ongoing development. The temporary runtime is not a project dependency or a permanent installation.

## MongoDB Atlas setup

1. Create an Atlas project and deploy a cluster using the tier appropriate for your environment.
2. Under **Database Access**, create a database user, distinct from your Atlas account. Grant read/write access to the `roomiematch` database.
3. Under **Network Access**, allow your development machine's current public IP, and later your backend host's outbound IP. Avoid opening access to every address for normal operation.
4. Select the cluster's **Connect → Drivers → Node.js** flow and copy its connection string.
5. Replace the placeholders with the database user's credentials, URL-encoding special characters in those credentials. Specify `/roomiematch` before the query string and place the URI in `server/.env` as `MONGODB_URI`.
6. Set a random `JWT_SECRET`, then run `npm run dev`. `GET /api/health` should report `database: "connected"`.

Atlas requires both a database user and an IP access-list entry. See the official [Atlas connection instructions](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/) and [connection troubleshooting](https://www.mongodb.com/docs/atlas/troubleshoot-connection/). No Atlas cluster, account, credentials, or public deployment was created by this implementation.

## Environment variables

| Variable | Default / requirement | Purpose |
| --- | --- | --- |
| `JWT_SECRET` | Required; at least 32 UTF-8 bytes | Random JWT signing secret. Use the generation command above. |
| `MONGODB_URI` | Required for accounts; mandatory in production | MongoDB connection string |
| `JWT_EXPIRES_IN_SECONDS` | `604800` (7 days) | JWT and cookie lifetime; 60–2592000 seconds |
| `COOKIE_SAME_SITE` | `lax` | `lax`, `strict`, or `none`; `none` requires production HTTPS |
| `CLIENT_ORIGIN` | `http://localhost:5173,http://127.0.0.1:5173` in development | Comma-separated allowed origins without paths/trailing slashes. Explicit value required in production. |
| `PORT` | `4000` | Express port; update the Vite proxy if changing it |
| `NODE_ENV` | `development` | `development`, `test`, or `production` |
| `VITE_API_BASE_URL` | `/api` | Public frontend API base URL, compiled at build time |

Do not put secrets in `VITE_*` variables. npm workspace scripts run in each application's directory, so the server loads `server/.env`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Frontend and backend with live reload |
| `npm run dev -w client` | Frontend only |
| `npm run dev -w server` | Backend only |
| `npm run build` | Frontend production build and backend TypeScript compilation |
| `npm run typecheck` | Type-check both applications |
| `npm run lint` | Frontend ESLint with zero warnings allowed |
| `npm test` | 26 backend integration tests |
| `npm start -w server` | Run compiled backend from `server/dist` |
| `npm run preview -w client` | Preview built frontend on port 4173; see hosting notes |

## API contract

All account and profile responses use `Cache-Control: no-store`. Successful account responses contain `{ "user": { "id", "name", "email", "profile", "createdAt", "updatedAt" } }`. Responses never include a password, password hash, JWT, or signing secret.

| Method | Endpoint | Authentication | Request / result |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | API and actual database state |
| POST | `/api/auth/register` | Public | `{ name, email, password }`; creates account, sets cookie, returns user (201) |
| POST | `/api/auth/login` | Public | `{ email, password }`; verifies credentials, sets cookie, returns user (200) |
| POST | `/api/auth/logout` | Cookie optional | Clears cookie; returns success (200), also works with an expired session |
| GET | `/api/auth/me` | Required | Restores current user from cookie (200) |
| GET | `/api/profile` | Required | Returns current user and profile (200) |
| PATCH | `/api/profile` | Required | `{ name?, profile?: { city?, occupation?, age?, moveInDate?, bio?, profilePhotoUrl? } }`; persists supplied fields (200) |

For writes, send `X-RoomieMatch-Request: web`; registration, login and profile edits also require `Content-Type: application/json`. The frontend Axios instance sets the verification header and `withCredentials: true` (equivalent to `fetch`'s `credentials: "include"`). Curl or other API clients must send the same write header and retain the session cookie.

Example profile patch:

```json
{
  "name": "Your name",
  "profile": {
    "city": "Bengaluru",
    "occupation": "Designer",
    "age": 27,
    "moveInDate": "2027-01-15",
    "bio": "A short introduction in your own words.",
    "profilePhotoUrl": "https://example.com/photo.jpg"
  }
}
```

Text is trimmed and length-limited. Name is 2–100 characters, city/occupation up to 100, and bio up to 500. Age is an optional integer from 18 to 120. Move-in date is an optional real `YYYY-MM-DD` calendar date between 1900 and 2200, returned without timezone shifts. Clear text fields with `""`, and age/date with `null`. The profile photo must be an HTTPS URL without embedded credentials, up to 2048 characters. The server does not fetch URLs; the browser renders the photo with no referrer and falls back to an icon if loading fails.

PATCH rejects unknown fields at both levels, including email, password/passwordHash, roles, permissions, IDs, dotted field names, and database operators. Updates target only the authenticated account and use dotted `$set` paths to preserve unsupplied profile fields.

Errors use `{ "error": { "message", "status", "fields"? } }`: 400 invalid input, 401 unauthenticated/incorrect credentials, 403 disallowed origin or missing verification header, 409 duplicate email, 413 oversized JSON, 415 unsupported content type, 429 too many attempts, and 503 unavailable account services. Unknown routes return JSON 404.

## Authentication and profile behavior

- Emails are trimmed/lowercased; a unique MongoDB index protects concurrent registration as well as normal duplicates.
- Passwords use bcrypt with cost 12. Registration requires at least 8 characters; both endpoints reject passwords over bcrypt's 72-byte UTF-8 limit instead of silently truncating. Passwords are not trimmed.
- JWTs have a subject, issuer, audience, expiry, and an explicitly verified HS256 signature. The middleware also checks the account still exists.
- Development uses `roomiematch_session`, HttpOnly, SameSite=Lax by default. Production uses a host-only `__Host-roomiematch_session` cookie with Secure, HttpOnly and Path=/; no cookie Domain is set. Clearing uses the same cookie attributes.
- CORS uses exact allowed origins and credentials. Requiring a custom header on every mutation forces browser cross-origin writes through preflight; simple HTML cross-site forms cannot perform writes.
- Registration/login share a limit of 30 failed attempts per IP per 15 minutes. Successful requests do not count. The store is process-local.
- Auth state is restored from `/api/auth/me`. Tokens are never placed in localStorage or exposed to JavaScript.
- `/dashboard` and `/profile` are protected. Login/register redirect authenticated visitors to the dashboard. Session expiry on a protected API request returns the visitor to login; network failures show retryable errors.
- Register/login have client validation, confirm password for registration, visibility toggles, loading states and server errors. Successful submission authenticates and opens the dashboard.
- The profile page loads persisted details and shows a save confirmation only after the API succeeds. Email is read-only. Unsaved entries are retained after a failed save.
- The dashboard uses the real user's first name and calculates completion from seven saved details: name, city, occupation, age, move-in date, bio, and photo URL. Optional fields remain optional, even when included in this indicator.
- Logout only clears local auth state after the server successfully clears its cookie. No successful logout is simulated during a network failure.

## Production hosting

Run `npm run build`. Deploy `client/dist` to a static host with SPA fallback to `index.html`. Proxy `/api` to Express, or build with `VITE_API_BASE_URL=https://your-api.example/api`. Configure production variables, then run:

```sh
NODE_ENV=production npm start -w server
```

Use HTTPS, an explicit frontend origin, a persistent MongoDB database, and a persistent random signing secret. Same-site hosting is recommended. If the frontend and API are truly cross-site, set `COOKIE_SAME_SITE=none`; third-party-cookie restrictions can still prevent sessions in some browsers. The Vite development proxy avoids this locally.

Vite preview is a static build preview, not a production server; it does not use the development API proxy. For full API testing on port 4173, build with an absolute API base URL and add that origin to `CLIENT_ORIGIN`.

The server does not trust forwarded IP headers by default. A reverse-proxy deployment needs a deliberately configured `trust proxy` topology and a shared rate-limit store before horizontally scaling. Do not blindly enable trust for arbitrary forwarded addresses.

## Verification and remaining limits

- **26/26 backend integration tests passed** against an isolated real MongoDB 8.0.17 process. They cover registration, concurrent/normalized duplicates, validation, actual bcrypt hashing, login, missing/invalid/expired sessions, `/me`, logout, profile retrieval/persistence/partial edits/clearing, protected-field rejection, account isolation, CORS/write verification, production cookie flags, and rate limiting.
- The test runner uses `mongodb-memory-server-core` only as a development dependency. It downloads the official MongoDB binary on the first test run and caches it in the OS temporary directory under `roomiematch-mongodb`. Internet access and permission to bind local ports are needed on the first run. Tests never use the developer's Atlas database.
- Browser verification exercised registration and password confirmation, protected-route redirects, profile editing and reload persistence, live completion changes, wrong-password feedback, login, and logout using a disposable local account/database. Responsive inspection included the profile page at a 393px phone viewport and the existing desktop/tablet layout; the mobile document and main content both measured 393px without horizontal page overflow.
- Frontend production build, backend compilation, frontend lint, and dependency checks are recorded in [Phase 2 delivery notes](docs/PHASE_2.md).
- No Atlas deployment or production HTTPS/browser cross-site environment was tested. Production cookie attributes are covered by automated tests.
- JWTs are stateless: logout removes the browser cookie but does not revoke a previously copied token; it remains valid until expiry. There is no refresh-token rotation, device-session management, password reset, email verification, or email change in this phase.
- Photo URLs are supported; file upload is not. Profiles are private to their authenticated owner. There is no lifestyle questionnaire, matching, discovery, connection requests, chat, notifications, or payments.

## Structure and assets

The existing `client/src/{components,pages,layouts,hooks,services,types,utils,assets}` and `server/src/{config,controllers,models,routes,middleware,services,utils}` separation is preserved. The root npm workspace installs both apps with one lockfile. A complete changed-file inventory is in [Phase 2 delivery notes](docs/PHASE_2.md).

Inter and DM Serif Display are bundled through Fontsource, and Lucide provides the icons. Residential photographs remain local assets downloaded from [Unsplash image 1](https://images.unsplash.com/photo-1600210492486-724fe5c67fb0) and [Unsplash image 2](https://images.unsplash.com/photo-1616486338812-3dadae4b4ace). The app uses no gradients and retains the established ivory, charcoal, olive, and terracotta visual system.
