# RoomieMatch

A roommate discovery foundation built around the way people live. The interface uses warm ivory, charcoal, muted olive and terracotta, with DM Serif Display, Inter, and locally bundled residential photography. No gradients or external runtime font/image requests.

## Requirements

- Node.js **22.12 or newer** (Node 22 is selected in `.nvmrc`) and npm.
- A local MongoDB instance or MongoDB Atlas connection string when you want to connect a database.

## Quick start

From the project root:

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. The API runs at **http://localhost:4000**. Both applications run together, with Vite proxying `/api` to the backend. Port 4000 avoids the AirPlay service commonly using port 5000 on macOS. Stop both applications with Ctrl+C.

No environment file is needed for the development UI and health endpoint. Without `MONGODB_URI`, the API explicitly reports `database: "unconfigured"`; it does not simulate a database connection. The foundation has no database-backed features yet.

To enable MongoDB:

```sh
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Edit `server/.env` with your MongoDB connection string and start MongoDB before running the application. The example uses `mongodb://127.0.0.1:27017/roomiematch`. For Atlas, supply your own URI and configure network access in Atlas. Never commit real `.env` files. `VITE_*` variables are public frontend configuration and must never contain secrets.

If a configured database is unavailable, startup fails after a bounded connection timeout rather than claiming success. In production, both `MONGODB_URI` and `CLIENT_ORIGIN` are required. A database connection lost after startup makes the health endpoint return HTTP 503.

### This workspace's runtime

The implementation environment did not have Node.js on PATH. A SHA-256 verified official Node.js 22.23.4 runtime was used from `/private/tmp/node-v22.23.4-darwin-arm64`. While that temporary directory exists, you can run:

```sh
export PATH="/private/tmp/node-v22.23.4-darwin-arm64/bin:$PATH"
npm run dev
```

Install Node.js normally for ongoing development; the temporary runtime is not part of the project or a permanent machine installation.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run both applications with live reload |
| `npm run dev -w client` | Run only the React frontend |
| `npm run dev -w server` | Run only the Express backend |
| `npm run build` | Build frontend production assets and compile backend TypeScript |
| `npm run typecheck` | Type-check both applications |
| `npm test` | Run six API integration tests using Node's test runner |
| `npm run preview -w client` | Preview the built frontend on port 4173 |
| `npm start -w server` | Run the compiled backend |

## Pages and phase boundaries

| Route | Included behavior |
| --- | --- |
| `/` | Editorial landing page, three-step introduction, five compatibility categories, rationale, CTA and footer |
| `/login` | Email/password validation, password visibility toggle, registration and preview links |
| `/register` | Name/email/password validation, accessible errors, login and preview links |
| `/dashboard` | Explicit public preview, welcoming copy, sidebar anchors, 0% profile completion, empty recommendations, real API availability indicator |
| Any other route | Designed 404 page with home navigation |

Login and registration **do not authenticate, create accounts, persist credentials, or send form values to the API**. Valid submission explains this and offers the dashboard preview. Preview form values exist only in component memory and are discarded on navigation. Browser autofill/password managers remain controlled by the browser.

There are no questionnaires, matching algorithms, connection requests, chat, or notifications. Future profile sections are clearly marked coming soon. No fabricated users, testimonials, or recommendations are shown. The dashboard greeting uses “future roomie” until genuine authenticated user data exists.

## Project structure

```text
client/
  public/                  Favicon
  src/
    assets/                Bundled residential photography
    components/            Brand, Navbar, Footer, Buttons, FormInput, LoadingState
    pages/                 Landing, Login/Registration, Dashboard, NotFound
    layouts/               SiteLayout and AuthLayout
    hooks/                 Abortable API health request
    services/              Axios client
    types/                 Shared frontend interfaces
    utils/                 Form validation
    App.tsx                Routes, titles and scroll behavior
    main.tsx               Entry point and local fonts
    styles.css             Tailwind theme and responsive visual system
  .env.example
  vite.config.ts
server/
  src/
    config/                Validated environment and MongoDB connection
    controllers/           Health response
    models/                Reserved for future Mongoose models
    routes/                API route registration
    middleware/            Centralized errors and JSON 404s
    services/              Actual database health state
    utils/                 Typed HTTP error
    app.ts                 Testable Express setup
    index.ts               Startup and graceful shutdown
  test/                    HTTP, JSON errors, size limit and CORS tests
  .env.example
```

The root npm workspace shares dependency installation and lockfile while keeping the two applications, configurations, and build outputs separate.

## API

```sh
curl http://localhost:4000/api/health
```

Example without a configured development database:

```json
{
  "status": "ok",
  "service": "roomiematch-api",
  "database": "unconfigured",
  "timestamp": "<current ISO timestamp>"
}
```

`status: "ok"` means the foundation API is available; check `database` for connectivity. Configured but disconnected databases return `status: "degraded"` with HTTP 503. Successful database connections report `database: "connected"`.

Unknown routes return a JSON 404. Invalid JSON returns 400; JSON over 16 KB returns 413. CORS uses an explicit origin allowlist and supports preflight requests. Error responses do not expose stack traces or connection strings. CORS is not authentication.

## Environment reference

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | Backend HTTP port |
| `NODE_ENV` | `development` | `development`, `test`, or `production` |
| `CLIENT_ORIGIN` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated allowed frontend origins, without trailing slashes |
| `MONGODB_URI` | Unset | Mongoose connection URI; mandatory in production |
| `VITE_API_BASE_URL` | `/api` | Frontend API base URL, configured at build time |

If changing the backend port, also update the target in `client/vite.config.ts`, or set an absolute `VITE_API_BASE_URL` and allow the frontend origin. npm workspace commands load `server/.env` from the server application's directory.

## Production hosting

Run `npm run build`. Deploy `client/dist` on a static host with an SPA fallback to `index.html` for frontend routes. Proxy `/api` to the Express server, or build with `VITE_API_BASE_URL=https://your-api.example/api`. Start the backend with `NODE_ENV=production npm start -w server` after configuring its production environment. Build output lives in `server/dist`.

The Vite preview command is only a static build preview; it is not a production server and does not use the development API proxy. For API access from port 4173, build with an absolute API base URL and include that preview origin in `CLIENT_ORIGIN`, or use the integrated development command above.

## Verification

Both production builds passed. The six HTTP integration tests cover actual HTTP responses, health, unknown routes, invalid/oversized JSON, CORS allow/reject behavior, and preflight handling. They use a disposable loopback listener and intentionally do not require MongoDB.

The development frontend and proxied health endpoint were exercised locally. Browser checks covered the desktop landing and registration pages, mobile landing/login/dashboard layouts at 400px, mobile menu and section navigation, empty-field validation, and the valid-registration preview notice. A missing space at a responsive line break was found and corrected. Test servers were stopped after verification.

A live MongoDB connection requires a running MongoDB instance or an Atlas URI; neither is supplied with this foundation.

## Assets and references

- Residential photos downloaded from [Unsplash image 1](https://images.unsplash.com/photo-1600210492486-724fe5c67fb0) and [Unsplash image 2](https://images.unsplash.com/photo-1616486338812-3dadae4b4ace); retained locally under `client/src/assets`.
- Fonts are bundled via Fontsource packages, with their included font licenses.
- Icons: Lucide React.
- Stack references: [Vite setup](https://vite.dev/guide/) and [Express error handling](https://expressjs.com/en/5x/guide/error-handling/).
