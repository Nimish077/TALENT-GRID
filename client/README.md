# TalentGrid — Client

React 19 + Vite single-page app for TalentGrid. It talks to the Express API
under `/api/v1`, uses cookie-based sessions, and renders role-specific
dashboards for candidates, employers, and institutes.

## Requirements

- Node.js 24+
- The API server running locally (see `../server/README.md`)

## Getting started

```bash
npm install
copy .env.example .env   # optional; only needed for a non-proxied API origin
npm run dev              # http://localhost:5173
```

In development, Vite proxies `/api` to `http://localhost:8000`, so the browser
sees a same-origin API and the auth cookies work without extra CORS setup.

## Commands

| Command           | Purpose                              |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Start the Vite dev server            |
| `npm run build`   | Create a production build in `dist/` |
| `npm run preview` | Preview the production build         |
| `npm test`        | Run the Vitest suite once            |
| `npm run lint`    | Run ESLint                           |

## API and CSRF

The API client is `src/lib/api.js`. It is intentionally small and centralized so
every request uses the same authentication and CSRF rules.

### Session transport

- Requests always use `credentials: "include"`.
- The API sets `access_token` and `refresh_token` as HttpOnly cookies; the
  browser never reads them.
- The API also sets a readable `csrf_token` cookie and returns the same token in
  `data.csrf_token` from `GET /auth/csrf`, `POST /auth/login`,
  `POST /auth/register`, and `POST /auth/refresh`.

### Token lifecycle

1. `src/main.jsx` calls `bootstrapCsrfToken()` on startup. It fetches
   `GET /auth/csrf`, stores the returned token **in memory**, and lets the API
   set the matching cookie.
2. Mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`) send the token as
   `x-csrf-token`, except `POST /auth/login` and `POST /auth/register`, which
   are public session-establishment endpoints and do not require CSRF.
3. If a mutation fails with `403` and a CSRF message, the client bootstraps a
   fresh token and retries the request **once**. This covers a refresh that
   rotated the token in another tab.
4. Login/register/refresh responses update the in-memory token. Logout clears
   it.

The token is never written to `localStorage` or `sessionStorage`, and the header
is only sent to the configured TalentGrid API base URL.

### API base URL

By default the client uses `/api/v1`, which works with the Vite proxy in
development and with the Vercel rewrite in production. To point at a different
API origin, set `VITE_API_BASE_URL` in `.env`:

```dotenv
VITE_API_BASE_URL=https://api.example.com/api/v1
```

### Demo accounts panel

The login pages (`/login`, `/admin/login`) can show the public demo accounts as one-click buttons. Two switches turn it on, either is enough:

- **Server (recommended, no rebuild):** the API reports `demo_login` from `GET /api/v1/config`. It follows `SEED_DEMO=true` on the server, or set `DEMO_LOGIN=true|false` to override. Change it on Render and restart.
- **Build time:** `VITE_DEMO_LOGIN=true` (needs a new Vercel deployment).

Off by default; keep it off for a real deployment. See `docs/DEMO.md`.

`VITE_API_URL` is also accepted for backwards compatibility. When using a
cross-origin API, the server's `CORS_ORIGINS` must include this frontend origin,
and the cookies must be configured for that deployment (`COOKIE_SECURE`,
`COOKIE_SAMESITE`, and `COOKIE_DOMAIN` on the server).

## Auth flow

- `AuthProvider` restores an existing cookie session with `GET /auth/me`.
- `useAuth()` exposes `user`, `loading`, `login`, `register`, and `logout`.
- `ProtectedRoute` redirects anonymous users to `/login`, preserving the
  intended destination.
- Login and registration navigate to `/dashboard`; the dashboard selects the
  candidate, employer, or institute view from `user.role`.

## Structure

```text
src/
  components/       shared UI, landing sections, layout, dashboard primitives
  context/          auth context and provider
  lib/              API client, endpoints, formatting, registration helpers
  pages/            login, register, dashboard, and role dashboards
  test/             Vitest setup
```

## Testing

```bash
npm test
npm run lint
npm run build
```

Tests use Vitest, jsdom, and Testing Library. `src/lib/api.test.js` covers CSRF
bootstrap, in-memory token use, the one-time 403 retry, safe requests, and logout
cleanup. Page tests cover route protection, login, registration, and dashboard
rendering.
