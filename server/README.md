# TalentGrid — Server

Express 5 + Prisma 7 + PostgreSQL REST API that powers TalentGrid. It serves
everything under `/api/v1`, uses cookie-first authentication with refresh-token
rotation, and enforces tenant (organization / institution) boundaries for every
employer and institute surface. See [API.md](./API.md) for the endpoint
reference.

> **Deep documentation:** [docs/index.md](./docs/index.md) — architecture,
> request lifecycle, database/Prisma guide, security model, per-module pages,
> end-to-end workflows, development guides, and a verified
> [known-issues register](./docs/reference/known-issues.md).

## Requirements

- Node.js 24+
- PostgreSQL 17+

## Getting started

```bash
npm install                # install dependencies
copy .env.example .env     # then edit .env (DATABASE_URI, JWT_SECRET, ...)
npm run db:create -- Talent-Grid   # create the database (if missing)
npm run prisma:deploy      # apply migrations
npm run db:seed            # seed the skill catalog
npm run admin:create       # create the first admin account
npm run dev                # start on http://localhost:8000
```

Health check: `GET /health`.

## Commands

| Command                                   | Purpose                                              |
| ----------------------------------------- | ---------------------------------------------------- |
| `npm run dev` / `npm start`               | start the server (`--watch` / plain)                 |
| `npm test` / `npm run test:watch`         | run the vitest suite                                 |
| `npm run format` / `npm run format:check` | prettier write / check                               |
| `npm run prisma:generate`                 | regenerate the Prisma client                         |
| `npm run prisma:migrate`                  | `prisma migrate dev` (development)                   |
| `npm run prisma:deploy`                   | `prisma migrate deploy`                              |
| `npm run prisma:status`                   | `prisma migrate status`                              |
| `npm run db:create -- <name>`             | create a database using the maintenance connection   |
| `npm run db:seed`                         | seed/refresh the skill catalog (idempotent)          |
| `npm run admin:create`                    | create or update an admin user                       |
| `npm run db:reconcile`                    | one-time legacy data reconciliation (see `scripts/`) |

## Layout

```text
server/
  index.js                 entry point (listen + graceful shutdown)
  prisma/                  schema.prisma + migrations
  scripts/                 db/admin/seed maintenance scripts
  src/
    app.js                 express app factory (mount order matters)
    config/env.js          validated, frozen environment configuration
    lib/prisma.js          PrismaClient + connection lifecycle
    errors/ utils/         ApiError, async handler, cookies, tokens, otp, ...
    services/              access (tenant guards), scoring, eligibility, mailer
    middleware/            authenticate, authorize, tenant, csrf, validate, ...
    modules/               one folder per resource (routes + schemas + service)
  tests/                   vitest + supertest suites
  vitest.config.js
```

## Authentication

- **Cookies by default.** `access_token` (short-lived JWT, path `/api/v1`),
  `refresh_token` (opaque, path `/api/v1/auth`), `csrf_token` (readable,
  signed double-submit).
- **Bearer is a first-class alternative.** `register`/`login`/`refresh` also
  return `data.tokens.access_token` for non-browser clients; Bearer requests
  skip CSRF and get identical authorization.
- **Refresh rotation.** Every refresh rotates the token. A second attempt with
  the old token inside `REFRESH_REUSE_GRACE_SECONDS` gets a harmless "retry"
  response (no cookies cleared); beyond that it is treated as reuse and the
  whole session family is revoked with reason `reuse_detected`.
- **CSRF.** Cookie-authenticated mutating requests need a matching `Origin`
  plus the `x-csrf-token` header; cookie-less `register`/`login` are exempt.
- **Locked accounts.** Suspended users get `403`; suspending a user revokes all
  their sessions (`admin` reason).

## Safety guards

- `NODE_ENV=test` requires `TEST_DATABASE_URI`, which must differ from
  `DATABASE_URI` and contain `test` in the database name — tests can never
  touch development data (`tests/setup.js` re-checks this).
- Production rejects `MAILER=console`, requires explicit `CORS_ORIGINS`, and
  requires `COOKIE_SECURE` when `COOKIE_SAMESITE=none`.
- Employer/institute accounts are created `pending` until a platform admin
  verifies the organization/institution; verification activates the pending
  owner membership. The first admin comes from `npm run admin:create`.

## Skill verification

Candidates declare skills with a `declared_level`; they can never write
`verified_*` fields. Passing the assessment engine's evaluation
(`POST /api/v1/assessments/attempts/:attemptId/evaluate`, engine token or
admin) stamps the skill as verified at the assessment's target level
(`verified_level = max(previous, target)`). Scores map to levels as
`<50 beginner`, `50–79 intermediate`, `≥80 advanced`.

## Institutions

- **Imports**: staff upload student roster rows (≤500 per request); each row is
  processed resiliently and reported as `completed` / `partial` / `failed`.
  Imported rows are trusted as `verification_source: institution_import`.
- **Claims**: students link an existing membership with an emailed OTP
  (`POST /api/v1/membership-claims`). Codes are bound to the membership +
  email context, expire after `OTP_TTL_MINUTES`, and lock after
  `OTP_MAX_ATTEMPTS` wrong attempts.
- **Drives**: institutes create placement drives with eligibility criteria
  (CGPA, backlogs, batch, departments) and optional attached jobs/assessments;
  candidate progress follows `applied → shortlisted → selected/rejected`.

## Inferences register

Decisions taken beyond the ER diagram (kept deliberately small):

1. `sessions` table (approved addition) stores sha256-hashed refresh tokens
   with rotation lineage (`family_id`) and revoke reasons
   (`rotated` / `logout` / `reuse_detected` / `admin`).
2. Enum-like columns are `text` + DB `CHECK` constraints; `created_at` /
   `updated_at` audit columns everywhere.
3. A failed assessment never downgrades previously verified level; skill
   verification only happens through a passed evaluation.
4. Drive `eligibility_status` is snapshotted when a student applies;
   eligibility (`reasons[]`) is recomputed at read time for listings.
5. Job invitations create applications with `source: invited`; drive-sourced
   applications use `source: placement_drive`.
6. Partial unique indexes enforce two workflow invariants: at most one open
   assessment attempt per (assessment, candidate) and at most one pending OTP
   claim per membership. Applications are unique per (job, candidate) and
   (drive, candidate) via regular unique constraints.

## Testing

```bash
npm test
```

Vitest + supertest, serial execution. The suite sets `MAILER=test` (in-memory
outbox), `BCRYPT_ROUNDS=4`, and `ASSESSMENT_ENGINE_TOKEN=test-engine-token`
itself; only `TEST_DATABASE_URI` must exist in `.env`. Coverage includes auth +
rotation, RBAC/tenant isolation, assessments/verification, applications,
institutions (imports/claims), and placement drives.
