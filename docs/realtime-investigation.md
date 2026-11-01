# Production chat investigation — 1 November 2026

**Historical report from the diagnostic phase.** The user subsequently confirmed Chrome's `0 → 40 → 44` missing-cookie failure. The implemented follow-up is documented in [socket-ticket-authentication.md](socket-ticket-authentication.md); its current ticket-only socket flow supersedes the cookie-based observations below.

1. **Root cause and evidence boundary**

   The deployed frontend uses same-origin `/api` requests but connects Socket.IO directly to `https://roomiematch-f8lz.onrender.com`. The repository issues a host-only HttpOnly session cookie. A cookie issued through the frontend proxy cannot authenticate a socket on the unrelated Render host. `withCredentials` does not change cookie domain matching. This failure mode was reproduced with a real browser and a valid REST session, but the production Chrome cookie state and packets remain unobserved. Therefore this is a verified architectural failure mode, not yet a proven explanation of that particular Chrome incident.

   A separate frontend defect is verified: the original chat initialized `isConnected` to `true` and never handled `connect_error`. Namespace authentication rejection could therefore leave a silent, apparently usable composer. Socket.IO does not automatically retry a middleware rejection. The patch exposes this failure and prevents disconnected sends, but does not repair the underlying session mismatch.

   See the [cookie host and prefix rules](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie) and [Socket.IO connection error behavior](https://socket.io/docs/v4/client-socket-instance/#connect_error).

2. **Live production checks**

   | Check | Actual result |
   | --- | --- |
   | `https://roomiematch.vercel.app` from the brief | HTTP 404 |
   | `https://roomeematch.vercel.app` from existing Chrome/Brave tabs | HTTP 200, RoomieMatch frontend |
   | Deployed bundle | `/assets/index-DSrIJWiv.js`; same-origin REST, explicit direct Render socket URL |
   | Bundle API variable | Leading tab before the Render API URL; REST trims it. Explicit socket URL is valid, so this does not explain this incident. |
   | Render `/api/health` | HTTP 200, database connected |
   | Frontend `/api/health` | HTTP 200, proxy reaches backend |
   | Unauthenticated `/api/auth/me` on both origins | HTTP 401, as expected |
   | Render Engine.IO polling handshake | HTTP 200, Engine.IO `0` open packet |
   | Render WebSocket, no session cookie | HTTP 101 → incoming `0` → outgoing `40` → incoming `44{"message":"Authentication required: missing session cookie."}` |
   | Frontend `/socket.io/?EIO=4&transport=polling` | HTTP 200 containing frontend HTML, not an Engine.IO open packet |
   | Frontend WebSocket upgrade | HTTP 200 rather than 101; upgrade rejected |
   | Allowed origin on live API responses | `https://roomeematch.vercel.app` |

   These were unauthenticated probes, not the user's failing Chrome connection. The deployed `/socket.io` behavior differs from the checked-in rewrite configuration. This proves the current deployed route is unusable for this socket; it does not establish a general limitation of all Vercel rewrites or Functions. No routing configuration was changed.

   Local `server/.env` was inspected only through an allowlist: development mode, localhost frontend origins, SameSite=Lax. Render's configured environment and deployment logs were not accessible. `render.yaml` specifies production/SameSite=None. The observed live CORS origin differs from the examples, which use the misspelled frontend host. Do not replace the working production origin with the example value.

3. **Lifecycle and room trace**

   `AuthProvider` restores `/auth/me`; `AuthRoute` gates authenticated pages. `DashboardLayout` and `MessagesPage` share the module singleton from `getSocket()`. Socket creation does not require a conversation ID. The room effect emits after an ID exists; Socket.IO buffers the join until connection. The `connect` handler rejoins the selected room on reconnect. Named listeners are registered once per effect and removed during cleanup. Development StrictMode replays those effects but does not itself recreate this singleton. The browser fixture uses the actual app with StrictMode enabled.

   The backend authenticates the cookie, verifies the JWT and database user, then joins `user:<authenticated user ID>`. Conversation joins independently check membership and an accepted connection before joining `conversation:<conversation ID>`. REST supplies canonical lowercase MongoDB ID strings. The socket handler validates but does not canonicalize arbitrary uppercase IDs; this is a potential edge case, with no evidence that the real clients used uppercase IDs.

   `disconnectSocket()` has no callers in the inspected application. Logout/account changes therefore do not currently destroy the shared socket. This is a separate lifecycle issue, not established as the cause of the Chrome/Brave difference; it was not changed in this diagnostic patch.

4. **Message trace**

   The composer creates an optimistic message and idempotency key, then emits `message:send`. The backend validates the ID/content, verifies participant membership and accepted connection status, checks the idempotency key, persists the message, and saves conversation metadata. It broadcasts `message:new` using `io.to(conversationRoom).emit()`, then emits `message:sent` to the sender, then emits `conversation:updated` to participants' user rooms. In this implementation the broadcast precedes the sender acknowledgement.

   `io.to(room)` intentionally includes the sender when joined. Sender receipt does not prove recipient delivery. The recipient must have a connected socket in the same conversation room. The frontend's `message:new` listener reconciles messages only into the selected conversation, updates the list, and emits a read event. `message:sent` reconciles the sender's optimistic entry. The MongoDB unique index and reconciliation utilities preserve deduplication. Typing and presence implementations were left unchanged.

   New server diagnostics distinguish reception, authorization rejection, persistence, broadcast, deduplication, and acknowledgement. `recipientSocketCount` counts recipient sockets in the target room at broadcast time on this process; it is not a delivery acknowledgement. Client incoming-event diagnostics and browser UI assertions establish the later delivery stages.

5. **Why Brave worked and Chrome did not**

   Not established for the production sessions. Brave may have a separate usable Render cookie from an earlier login path, a different cookie partition, or different browser settings; these are hypotheses only. Both browsers can be tested with the same local fixture to distinguish cookie state from browser implementation. An empty DevTools frame panel alone cannot locate the failure: capture the newest connection from before reload with its filter cleared. Extensions/privacy settings were not changed or blamed.

   Classification of the reproduced failure: namespace authentication fails after the WebSocket and Engine.IO handshake, before conversation joining. Classification of the verified UI defect: frontend connection/error state handling. Production classification remains pending Chrome's packet trace and the corresponding server authentication log.

6. **Files inspected and modified**

   Inspected client files: `src/services/{socket,api,auth,conversations}.ts`, `src/components/{AuthProvider,AuthRoute}.tsx`, `src/layouts/DashboardLayout.tsx`, `src/pages/MessagesPage.tsx`, `src/{App,main}.tsx`, and message reconciliation coverage in the existing test suite. Also inspected `client/{package.json,tsconfig.json,vite.config.ts,vercel.json,.env.example}`.

   Inspected backend files: `src/realtime/{socketServer,presenceManager,typingManager}.ts`, `src/services/authService.ts`, `src/middleware/authenticate.ts`, `src/config/env.ts`, `src/{app,index}.ts`, `src/models/{User,Connection,Conversation,Message}.ts`, `src/controllers/conversationController.ts`, `src/routes/{authRoutes,conversationRoutes}.ts`, `server/package.json`, environment examples, and existing conversation/deduplication tests. Also inspected root `package.json`, `vercel.json`, `render.yaml`, and the public deployed frontend bundle. No applicable `AGENTS.md` was found.

   Modified/added:

   - `client/src/services/socket.ts`: attach diagnostics before starting the connection; transport, URL selection and authentication remain the same.
   - `client/src/services/socketDiagnostics.ts`: opt-in lifecycle, Engine.IO packet type, namespace and event metadata logs; no packet bodies.
   - `client/src/pages/MessagesPage.tsx`: initialize from actual socket state, handle connection rejection, prevent disconnected sends, detect rejection before page mount.
   - `server/src/realtime/socketServer.ts` and `diagnostics.ts`: opt-in structured logs for authentication, rooms, message stages and recipient socket counts.
   - `client/.env.example`, `server/.env.example`: document disabled-by-default debug flags.
   - `server/test/realtimeDiagnostics.test.ts`: opt-in behavior and redaction tests.
   - `server/test/browserRealtime.mjs`: repeatable, isolated Chrome/Brave regression fixture with disposable MongoDB.
   - `docs/realtime-investigation.md`: this report and verification runbook.

   No secrets, live environment files, deployment settings, cookie policy, CORS policy, authorization checks, message persistence, or idempotency index were changed.

7. **Tests and how to repeat them**

   Baseline: `npm test` passed 143/143. With diagnostics tests: 145/145 passed. `npm run typecheck`, `npm run lint`, and `npm run build` passed. Build reports a bundle larger than 500 kB, unrelated to this patch. The sandbox initially blocked test IPC; the suite passed when allowed to launch its local test servers.

   **Actual Playwright results: Chrome PASS; Brave PASS (both Chromium-based).** Each passed the REST-200/socket-cookie-missing reproduction (`0` → outbound `40` → inbound `44`), visible authentication failure and disabled send, successful namespace acknowledgement, shared room membership for two users/three tabs, unauthorized-room rejection, sender and recipient UI delivery without refresh, duplicate-send prevention, and transport disconnect/reconnect/rejoin followed by a live reply. These tests exercise the real React app and Socket.IO backend. They do not establish Firefox/WebKit compatibility or reproduce the user's production browser settings.

   Initial browser-fixture runs failed before valid assertions: the fixture collided with the existing development server, then expected an unauthorized-room error in a UI region that is not rendered for outsiders. The final fixture uses a dedicated server configuration and asserts the actual room rejection event; its final run exited 0 in both browsers. No application behavior was changed to make those fixture setup assertions pass.

   Browser runner (requires Playwright installed or an absolute module path):

   ```sh
   PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node --import tsx server/test/browserRealtime.mjs
   ```

   Defaults use installed macOS Chrome and Brave executables. Override `CHROME_PATH`/`BRAVE_PATH` elsewhere. It uses isolated contexts and synthetic sessions, creates no production accounts, and never accesses real browser profiles or Atlas. It deliberately checks host-only cookie separation using localhost versus 127.0.0.1; this is not a full production HTTPS/SameSite=None/Partitioned-cookie test.

8. **Remaining deployment and manual verification**

   Nothing has been deployed. Deploy the diagnostic patch with `REALTIME_DEBUG=true` on Render and build the frontend with `VITE_REALTIME_DEBUG=true` in the existing Vercel project. Keep the current working REST and direct socket routing while gathering evidence. Vite variables require a rebuild; changing Render's flag requires a restart/redeploy. Afterwards disable both flags and rebuild/restart. Authentication architecture changes must follow the captured failure rather than guessing between proxying, custom domains, or a scoped socket-authentication mechanism.

   Run these exact checks in Chrome and Brave:

   1. Use `https://roomeematch.vercel.app`. Open DevTools **before** loading Messages. Enable Preserve log, clear Network/WS filters, reload, and select the newest Render `/socket.io/?EIO=4&transport=websocket` request.
   2. Confirm `/api/auth/me` status and request hostname. In the WebSocket Messages panel record only packet types: incoming `0`, outgoing `40`, incoming `40` acknowledgement or `44` rejection. A raw `101` is insufficient. Clear any Messages text/direction filter.
   3. If `0` never arrives, inspect transport/proxy/extension behavior next. If `0` arrives but outgoing `40` does not, inspect client lifecycle. If incoming `44` arrives, correlate Render's `auth:result` reason. If incoming `40` arrives, proceed to room and delivery checks rather than treating the transport as failed.
   4. In Application/Storage and the WebSocket request's Cookies view, compare **presence, host/domain, SameSite, Secure, partition key and blocked reason only** for the session cookie. Never copy cookie values, JWTs or raw HAR files. A frontend-host cookie alone cannot authenticate the Render connection. Compare the same metadata in Brave without clearing either working session.
   5. Sign in as two different users with an accepted connection. Open the same conversation. Match each `socket:connected` authenticated user ID and socket ID to `conversation:joined` with the same exact `conversation:<ID>` room. Each browser must receive `conversation:joined`.
   6. Send one unique test message. Match `message:received` → `message:persisted` → `message:broadcast` (recipient count at least 1) and `message:acknowledged`. Check sender `message:sent`, recipient `message:new`, and exactly one recipient bubble **without refreshing**. Sender receiving its own broadcast is expected.
   7. Reply in the other direction. Check read receipts and typing. Open a second recipient tab; verify unique socket IDs and no duplicate bubbles. Disconnect/reconnect networking, wait for a new namespace connection and room join, then send another message. Verify a nonparticipant's join is rejected. Check logout/login separately because the existing singleton cleanup gap is documented above.
   8. Provide only sanitized lifecycle logs/packet types and cookie metadata. This evidence is required to establish the exact Chrome stopping point and explain the Brave difference.
