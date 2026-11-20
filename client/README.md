# TalentGrid client

This Vite + React app is the TalentGrid frontend. The landing page is currently
the only UI; the centralized API/auth layer is ready for feature pages.

## API configuration

Copy `.env.example` to `.env` when the API is not same-origin:

```text
VITE_API_BASE_URL=https://api.example.com/api/v1
```

Leave it unset for a same-origin deployment. During local development, Vite
proxies `/api` to `http://localhost:8000`, so the default `/api/v1` base works
without a `.env` file.

## CSRF / session handling

- `src/lib/api-client.js` is the single HTTP client. It sends
  `credentials: "include"` to the TalentGrid API and attaches `X-CSRF-Token` to
  `POST`, `PUT`, `PATCH`, and `DELETE` only.
- Login and registration are public session-establishment endpoints: they do
  not require the token, even if stale auth cookies are present. Refresh,
  logout, and all other mutations still do.
- The token is stored in memory (`src/lib/csrf-token.js`); it is never written
  to `localStorage` or `sessionStorage`. Access/refresh tokens are also never
  stored in JavaScript.
- `src/main.jsx` calls `GET /api/v1/auth/csrf` on startup. If the token is
  missing, `apiFetch` bootstraps it before a mutation.
- `src/lib/auth-api.js` provides `login`, `register`, `refreshSession`,
  `logout`, and `fetchCurrentUser`. Login/register/refresh update the in-memory
  CSRF token; logout clears it.
- If the API and frontend are cross-site, the backend needs
  `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true`, and the exact frontend origin in
  `CORS_ORIGINS`. Third-party-cookie restrictions can still block cookie auth;
  prefer a shared custom domain.
- Never send the CSRF token to an external URL; the API client only attaches it
  to the configured TalentGrid API origin.

## Commands

```bash
npm run dev     # start Vite (proxies /api to localhost:8000)
npm test        # vitest
npm run lint    # eslint
npm run build   # production build
```

## Vite notes

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
