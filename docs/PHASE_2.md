# Phase 2 delivery notes

Authentication and private user profiles are implemented in the existing React/Vite and Express/Mongoose applications. Registration and login issue HttpOnly JWT cookies, `/me` restores the session, protected routes require authentication, and logout clears the cookie. Profile edits persist in MongoDB and update the dashboard name and completion indicator. The established ivory, charcoal, olive and terracotta design is preserved.

## Verification

| Check | Result |
| --- | --- |
| Backend integration suite (`npm test`) | 26/26 passed against isolated real MongoDB 8.0.17 |
| Backend TypeScript compilation (`npm run build -w server`) | Passed, including final root build |
| Frontend production build (`npm run build -w client`) | Passed, including final root build |
| Frontend lint (`npm run lint`) | Passed with zero warnings |
| Dependency audit (`npm audit`) | Zero vulnerabilities reported at verification time |
| Dependency resolution (`npm ls minimatch`) | Clean; patched 11.0.3 override |
| Whitespace (`git diff --check`) | Passed |

Integration tests exercise registration, duplicate and concurrent registration, invalid input, bcrypt persistence, valid/incorrect login, missing/tampered/expired sessions, deleted users, `/me`, logout, profile retrieval, persistence, partial updates and clearing, owner isolation, forbidden fields, invalid dates/ages/photo URLs, write verification, CORS, production cookie flags, rate limits, and existing health/error behavior.

Native Chrome browser checks used an isolated local MongoDB database and a disposable test account. Verified registration with confirmation mismatch feedback, protected-route redirects, profile saving and persistence after reload, updated dashboard name and completion, authenticated login-page redirects, incorrect-password feedback, successful login and logout. The phone layout was checked at a 393px viewport; document and main content widths both measured 393px without horizontal page overflow. Date validation/persistence is covered by API tests; the browser's segmented date input was not independently verified end to end.

The temporary QA database and servers are not the application's configured development environment. No production deployment or Atlas cluster was created. No real user credentials are committed.

## Setup and API documentation

See [README](../README.md) for every endpoint, request and response contracts, environment variables, exact installation/run commands, MongoDB Atlas setup, and deployment notes.

## Changed-file inventory

This inventory covers the Phase 2 changes relative to the existing Phase 1 checkout. Build output, ignored dependencies, temporary QA files and local environment files are excluded.

### New

- `client/eslint.config.js`
- `client/src/components/AuthProvider.tsx`
- `client/src/components/AuthRoute.tsx`
- `client/src/components/ProfileAvatar.tsx`
- `client/src/hooks/useAuth.ts`
- `client/src/layouts/DashboardLayout.tsx`
- `client/src/pages/ProfilePage.tsx`
- `client/src/services/auth.ts`
- `client/src/services/profile.ts`
- `client/src/utils/profile.ts`
- `docs/PHASE_2.md`
- `server/src/controllers/authController.ts`
- `server/src/controllers/profileController.ts`
- `server/src/middleware/authenticate.ts`
- `server/src/middleware/requestSecurity.ts`
- `server/src/models/User.ts`
- `server/src/routes/authRoutes.ts`
- `server/src/routes/profileRoutes.ts`
- `server/src/services/authService.ts`
- `server/src/utils/validation.ts`
- `server/test/auth-profile.test.ts`

### Modified

- `README.md`
- `client/package.json`
- `client/src/App.tsx`
- `client/src/components/Navbar.tsx`
- `client/src/main.tsx`
- `client/src/pages/AuthPage.tsx`
- `client/src/pages/DashboardPage.tsx`
- `client/src/services/api.ts`
- `client/src/styles.css`
- `client/src/types/index.ts`
- `client/src/utils/validation.ts`
- `package-lock.json`
- `package.json`
- `server/.env.example`
- `server/package.json`
- `server/src/app.ts`
- `server/src/config/database.ts`
- `server/src/config/env.ts`
- `server/src/middleware/errorHandler.ts`
- `server/src/utils/HttpError.ts`
- `server/test/api.test.ts`

### Removed

- `server/src/models/README.md`

## Remaining limitations

- MongoDB Atlas and production HTTPS/cross-site browser sessions were not exercised; production cookie attributes were tested automatically.
- Logout clears the current browser cookie. Stateless JWTs are not revoked server-side and copied tokens remain valid until expiry.
- Rate limiting uses an in-process store. Multiple instances need a shared store and a deployment-specific proxy configuration.
- No password reset, email verification/change, refresh-token rotation, or device/session management is included.
- Profile photos use HTTPS URLs; there is no upload service. Optional profile fields remain optional.
- Lifestyle questionnaires, matching, discovery, connections, chat, notifications, and payments remain outside this phase.
