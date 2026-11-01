# RoomieMatch

RoomieMatch is a full-stack roommate compatibility, networking, and real-time messaging platform designed to help people find compatible living partners based on lifestyle, habits, budgets, and schedules.

---

## Technology Stack

- **Frontend**: React 19, TypeScript, Vite 7, Tailwind CSS v4, React Router 7, Axios, Lucide React.
- **Backend**: Node.js 22+, Express 5, TypeScript, Socket.IO 4, Helmet 8, CORS, Cookie-Parser, Express-Rate-Limit.
- **Database**: MongoDB 8 & Mongoose 8.
- **Authentication**: Stateless HS256 JWT stored in HttpOnly, SameSite, Secure cookies, bcrypt password hashing (cost 12), mutation preflight verification headers.
- **Real-Time Communication**: Socket.IO with cookie-based handshake authorization, room isolation, typing indicators, read receipts, and presence tracking.
- **Deployment Targets**:
  - Frontend: Vercel (Static SPA with rewrites)
  - Backend: Render (Web Service)
  - Database: MongoDB Atlas (Replica Set)

---

## Architecture & Features (Phases 1–7)

1. **Architecture & Foundation**: Monorepo with npm workspaces (`client`, `server`), strict TypeScript, unified build and testing pipeline.
2. **Authentication & User Profiles**: Secure registration, login, logout, account restore (`/api/auth/me`), and editable personal profiles with input sanitization and age/date validation.
3. **Lifestyle Questionnaire & Preferences**: 5-part lifestyle preference model (sleep schedule, cleanliness, noise tolerances, guest policies, budget & accommodation constraints).
4. **Compatibility Matching Engine**: Multi-dimensional scoring engine with circular sleep schedule analysis, budget overlap calculations, hard lifestyle constraint filtering, and human-readable match explanations.
5. **Connection Requests & Networking**: Mutual connection requests, state machine transitions (pending, accepted, rejected, cancelled), notification feed, and user discovery.
6. **Real-Time Chat & Messaging**: Socket.IO real-time chat between accepted connections, typing indicators, online/offline presence tracking, idempotency-key deduplication, message persistence, cursor-based pagination, and instant room revocation upon connection cancellation.
7. **Production Readiness & Hardening**: Strict environment validation, MongoDB Atlas connection pooling and index synchronization, Helmet security headers, cross-origin cookie policies, graceful shutdown (`SIGTERM`/`SIGINT`), health & readiness endpoints, and Vercel/Render deployment configurations.

---

## Local Development Setup

### Prerequisites

- Node.js **>= 22.14.0** and npm (`.nvmrc` selects Node 22).
- MongoDB running locally or a MongoDB Atlas cluster.

### 1. Clone & Install Dependencies

```sh
git clone https://github.com/your-username/RoomieMatch.git
cd RoomieMatch
npm ci
```

### 2. Configure Backend Environment

```sh
cp server/.env.example server/.env
```

Generate a secure 48-byte random signing secret:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Open `server/.env` and update:
- `JWT_SECRET`: Paste the generated secret.
- `MONGODB_URI`: Set your local MongoDB URI (e.g. `mongodb://127.0.0.1:27017/roomiematch`) or Atlas connection string.
- `COOKIE_SAME_SITE`: Keep `lax` for local development.

### 3. Run Development Servers

```sh
npm run dev
```

This concurrently launches:
- Frontend: `http://127.0.0.1:5173` (Vite development server with API proxy)
- Backend: `http://127.0.0.1:4000` (Express & Socket.IO server with live reload)

Visit `http://127.0.0.1:5173` in your browser.

---

## Environment Variables Reference

### Backend (`server/.env` & Render Dashboard)

| Variable | Required in Production | Default | Purpose & Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | **Yes** | `development` | Must be set to `production` in production. Enables secure cookies, strict validations, and hides stack traces. |
| `PORT` | **Yes** (set by Render) | `4000` | Port for the HTTP/Socket.IO server. Render automatically injects this. The server binds to `0.0.0.0`. |
| `MONGODB_URI` | **Yes** | None | Full MongoDB Atlas connection URI including credentials and database name (`/roomiematch`). |
| `JWT_SECRET` | **Yes** | None | Cryptographically random secret of at least 32 UTF-8 bytes (64 hex characters) used to sign session JWTs. |
| `JWT_EXPIRES_IN_SECONDS` | No | `604800` (7 days) | Session cookie and JWT expiration in seconds (min: 60, max: 2592000 [30 days]). |
| `CLIENT_ORIGIN` | **Yes** | `http://localhost:5173` | Comma-separated list of allowed frontend origins without paths or trailing slashes (e.g. `https://roomiematch.vercel.app`). |
| `COOKIE_SAME_SITE` | **Yes** | `lax` | Cookie SameSite policy: `none` for cross-site deployments (Vercel frontend + Render backend); `lax` for same-site custom domains. |

### Frontend (`client/.env` & Vercel Dashboard)

| Variable | Required in Production | Default | Purpose & Description |
| :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Optional | `/api` | Base URL for REST API requests. Default `/api` routes via Vercel's reverse proxy rewrites, preventing iOS WebKit ITP cookie blocking. |
| `VITE_SOCKET_URL` | Optional | Auto-detected | Base URL for Socket.IO connection. If omitted, uses current window origin in dev/proxy or derives from `VITE_API_BASE_URL`. |

> [!WARNING]
> Never prefix backend secrets (`JWT_SECRET`, `MONGODB_URI`) with `VITE_`. Any variable starting with `VITE_` is compiled directly into the client JavaScript bundle.

---

## MongoDB Atlas Setup Guide

1. **Create an Atlas Account & Cluster**:
   - Log in to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
   - Create a project (e.g. `RoomieMatch`).
   - Create a shared cluster (M0 Free Tier or M10+ for dedicated resources). Choose an AWS/GCP region closest to your Render service (e.g. Oregon / US West or Frankfurt / EU Central).

2. **Create a Database User**:
   - Go to **Security → Database Access → Add New Database User**.
   - Authentication Method: **Password**.
   - Database User Privileges: Select **Read and write to any database** or restrict to the `roomiematch` database.
   - Choose a strong password and save it securely. Avoid special characters like `@`, `:`, `/`, `?` or ensure they are URL-encoded (`encodeURIComponent`).

3. **Configure Network Access**:
   - Go to **Security → Network Access → Add IP Address**.
   - For Render cloud deployments with dynamic outbound IPs, add `0.0.0.0/0` (Allow access from anywhere). Access is secured by SCRAM-SHA-256 database authentication credentials.
   - Alternatively, if using a static outbound IP service or VPC peering, specify the dedicated IP range.

4. **Obtain Connection String**:
   - Go to **Deployment → Database → Connect → Drivers**.
   - Driver: `Node.js`, Version: `6.7 or later`.
   - Copy the SRV connection string:
     ```
     mongodb+srv://<username>:<password>@cluster0.xxxxxx.mongodb.net/roomiematch?retryWrites=true&w=majority
     ```
   - Ensure you specify `/roomiematch` as the database name before query parameters.

5. **Safe Startup & Index Initialization**:
   - When the backend starts up, `connectDatabase()` connects with connection pooling (`maxPoolSize: 20`, `minPoolSize: 2`, `connectTimeoutMS: 10000`, `socketTimeoutMS: 45000`).
   - It automatically and non-destructively runs `.init()` on all models (`User`, `Connection`, `Conversation`, `Message`, `Notification`, `RoommatePreferences`) to establish unique and partial compound indexes before traffic is served.
   - Collections and existing user data are never dropped.

---

## Render Backend Deployment Guide

### Option A: Using the Render Blueprint (`render.yaml`)

1. Push your repository to GitHub.
2. In the [Render Dashboard](https://dashboard.render.com/), click **New → Blueprint**.
3. Select your GitHub repository. Render detects the root `render.yaml`.
4. Render prompts you for the missing environment variables:
   - `MONGODB_URI`: Paste your MongoDB Atlas connection string.
   - `CLIENT_ORIGIN`: Enter your Vercel frontend URL (e.g. `https://roomiematch.vercel.app`).
   - `JWT_SECRET`: Render will auto-generate a secure random secret, or you can paste your own.
5. Click **Apply**. Render will automatically build and deploy your service.

### Option B: Manual Web Service Setup on Render

1. In the Render Dashboard, click **New → Web Service**.
2. Connect your Git repository.
3. Configure settings:
   - **Name**: `roomiematch-api`
   - **Region**: Select a region close to your database (e.g., Oregon, US West).
   - **Branch**: `main`
   - **Root Directory**: Leave blank (monorepo root).
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build -w server`
   - **Start Command**: `npm run start -w server`
   - **Health Check Path**: `/api/health`
4. Under **Environment Variables**, add:
   - `NODE_ENV`: `production`
   - `MONGODB_URI`: `mongodb+srv://<user>:<password>@cluster0.xxxxxx.mongodb.net/roomiematch?retryWrites=true&w=majority`
   - `JWT_SECRET`: `<generated 48-byte hex secret>`
   - `JWT_EXPIRES_IN_SECONDS`: `604800`
   - `CLIENT_ORIGIN`: `https://roomiematch.vercel.app` (update once Vercel URL is known)
   - `COOKIE_SAME_SITE`: `none`
5. Click **Create Web Service**.
6. Note your Render URL (e.g. `https://roomiematch-api.onrender.com`).

---

## Vercel Frontend Deployment Guide

1. In the [Vercel Dashboard](https://vercel.com/dashboard), click **Add New → Project**.
2. Import your GitHub repository.
3. Configure project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click `Edit` and select `client`.
   - **Build Command**: `npm run build` (or leave default Vite build)
   - **Output Directory**: `dist`
4. Under **Environment Variables**:
   - `VITE_API_BASE_URL`: `/api` (Recommended: routes through Vercel's reverse proxy rewrites in `vercel.json` to keep requests same-origin, ensuring cookies are first-party and preventing iOS WebKit ITP cookie blocking).
   - `VITE_SOCKET_URL`: Optional (defaults to window origin when using the `/socket.io` rewrite).
5. Click **Deploy**.
6. When deployment finishes, copy the deployed Vercel domain (e.g. `https://roomiematch.vercel.app`).
7. **Crucial Next Step**: Return to Render Dashboard → Environment Variables → update `CLIENT_ORIGIN` to match your exact Vercel URL (without trailing slashes), and trigger a redeploy on Render.

---

## Production Cookie & CORS Configuration

Authentication uses an HttpOnly cookie containing a verified HS256 JWT.

### WebKit ITP & First-Party Proxying (iOS Safari & Chrome)

Apple iOS requires all browsers (Safari, Chrome, Firefox) to use WebKit. WebKit's Intelligent Tracking Prevention (ITP) blocks third-party cross-site cookies by default.
- To prevent iOS authentication failures, `vercel.json` provides reverse proxy rewrites mapping `/api/:path*` and `/socket.io/:path*` to the Render backend (`https://roomiematch-f8lz.onrender.com`).
- Browser requests on `https://roomiematch.vercel.app` stay same-origin (`/api`), and session cookies are stored as first-party host cookies on `roomiematch.vercel.app`.
- For direct cross-site deployments, `authService` automatically adds the `Partitioned` (CHIPS) attribute whenever `COOKIE_SAME_SITE=none`.
- When requests return 401 on protected routes, `AuthProvider`'s Axios interceptor automatically synchronizes frontend authentication state with the backend session, clearing stale memory user state and redirecting to `/login`.

### Same-Site Deployments (Custom Domains)

If you assign custom domains under the same parent domain (e.g. `app.yourdomain.com` for frontend and `api.yourdomain.com` for backend):
- Set `COOKIE_SAME_SITE=lax`.
- This provides standard first-party cookie isolation and prevents third-party tracking blocks in Safari/Brave.

---

## Socket.IO Production Configuration

RoomieMatch uses Socket.IO for:
- Real-time instant messaging.
- Live typing indicators with multi-tab awareness.
- Active user presence (online/offline status).
- Read receipts and unread count badges.
- Conversation room security and instant membership revocation.

### Infrastructure & Scaling Notes

- **Transport Support**: Configured for both `websocket` and `polling` transports. Render supports WebSockets over HTTP/1.1 and HTTP/2 out of the box.
- **Handshake Authentication**: During the WebSocket handshake, Socket.IO extracts the HttpOnly session cookie, validates the JWT, and verifies the user exists in MongoDB before granting connection access.
- **Single Instance Architecture**: Presence tracking and active typing states are maintained in-memory within `presenceManager` and `typingManager`. A single Render backend instance is recommended for initial production. If horizontally scaling across multiple instances in the future, a Redis adapter (`@socket.io/redis-adapter`) and a shared Redis presence store must be introduced.
- **Clean Shutdown**: Upon server termination (`SIGTERM`/`SIGINT`), `closeSocketServer()` closes all open WebSocket connections cleanly before the HTTP server unbinds.

---

## Health Checks & Reliability

| Endpoint | Method | Access | Purpose |
| :--- | :--- | :--- | :--- |
| `/api/health` or `/health` | `GET` | Public | Liveness probe reporting overall service status (`ok` or `degraded`), database connection status, and ISO timestamp. |
| `/api/ready` or `/ready` | `GET` | Public | Readiness probe returning HTTP 200 `{ status: "ready" }` if database is connected and accepting queries, or HTTP 503 `{ status: "not_ready" }`. Exposes no secrets or database hostnames. |

### Reliability Features

- **Graceful Shutdown**: Intercepts `SIGTERM` and `SIGINT`, halts incoming connections, closes Socket.IO rooms, closes active database connections, and exits with code 0 within a 10-second safety window.
- **Global Error Handling**: Catches unhandled promise rejections and uncaught exceptions safely without crashing the event loop silently or exposing secrets.
- **Centralized HTTP Error Formats**: Uniform `{ error: { message, status, fields? } }` responses. Database validation errors return 400; duplicate keys return 409; database disconnections return 503; unknown routes return JSON 404. Stack traces are never leaked to clients.

---

## Verification & Automated Test Suite

Run all verification checks across workspaces:

```sh
# Typecheck TypeScript across both client and server
npm run typecheck

# Lint frontend with ESLint (zero warnings permitted)
npm run lint

# Build client production bundle and server TypeScript
npm run build

# Run all 143 backend unit, integration, and regression tests
npm test
```

### Test Coverage Highlights (143 Tests Passing)

- **Authentication & Profiles**: Registration, duplicate prevention, bcrypt hashing, cookie flags, `/me` restoration, profile field validation, tampering resistance, and rate limiting.
- **Lifestyle Preferences**: Questionnaire validation, section updates, sleep window calculations, and completion tracking.
- **Compatibility Engine**: Circular sleep calculations, cleanliness scoring, noise quiet-hour overlaps, guest policies, budget ranges, and constraint filtering.
- **Connections & Requests**: Mutual request state transitions, pagination, duplicate prevention, and notifications.
- **Conversations & Real-Time Messaging**: Connection validation, cursor pagination, Socket.IO handshake auth, room authorization, typing indicators, read receipts, room revocation, and idempotency key deduplication.
- **Deployment & Security**: CORS origin allowlisting, preflight handling, payload limits, security headers, unconfigured development fallback, and health/readiness endpoints.

---

## Troubleshooting Common Deployment Issues

### 1. `CORS: This origin is not allowed` (HTTP 403)
- **Cause**: The `CLIENT_ORIGIN` environment variable on Render does not exactly match the Vercel URL.
- **Fix**: Check your Vercel URL (e.g. `https://roomiematch.vercel.app`). In Render, ensure `CLIENT_ORIGIN` is set to `https://roomiematch.vercel.app` without any trailing slash or subpaths.

### 2. Login succeeds but immediately redirects back to Login (Cookie not sent)
- **Cause**: `COOKIE_SAME_SITE` is set to `lax` while frontend and backend are on different domains (`vercel.app` vs `onrender.com`), or request is over unencrypted HTTP.
- **Fix**: Set `COOKIE_SAME_SITE=none` in the Render environment variables. Ensure both frontend and backend are accessed over `https://`.

### 3. Page Refresh on `/dashboard` or `/messages` returns 404 on Vercel
- **Cause**: SPA client-side routes were requested directly from the web server without rewrite rules.
- **Fix**: Ensure [client/vercel.json](file:///Users/sameerakmal/RoomieMatch/client/vercel.json) (or root `vercel.json`) is present with the rewrite `"source": "/(.*)", "destination": "/index.html"`.

### 4. MongoDB `MongoServerSelectionError` on Startup
- **Cause**: Atlas Network Access does not permit connections from Render, or database user credentials are incorrect.
- **Fix**: In Atlas **Network Access**, ensure `0.0.0.0/0` is allowed. In Atlas **Database Access**, verify the username and password. If the password contains special characters, URL-encode them.

### 5. Render Web Service fails health check
- **Cause**: Health check path misconfigured, or startup crashed due to missing environment variables.
- **Fix**: Verify health check path is `/api/health`. Check Render build and deploy logs for missing required environment variables (`JWT_SECRET`, `MONGODB_URI`, `CLIENT_ORIGIN`).

---

## License

Private repository. All rights reserved.
