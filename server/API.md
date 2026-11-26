# TalentGrid API Reference

Base URL: `/api/v1` (server default `http://localhost:8000`).

## Conventions

- All responses use an envelope:
  - success: `{ "success": true, "message": "...", "data": { ... } }`
  - error: `{ "success": false, "message": "...", "error": [ ... ] }`
- Validation errors return `422` with an `error` array of
  `{ path, message }` entries; not found `404`; tenant/role denials `403`;
  conflicts (duplicates, illegal transitions) `409`.
- Auth: httpOnly cookies by default; `Authorization: Bearer <access_token>` is
  also accepted (skip CSRF). Browser clients bootstrap a signed CSRF token from
  `GET /auth/csrf` (or read `data.csrf_token` from register/login/refresh),
  keep it in memory, and send it as `x-csrf-token` on mutating requests.
  Cookie-authenticated mutations also need a matching `Origin`.
- `POST /auth/login` and `POST /auth/register` are exempt from the CSRF
  double-submit check, even when stale auth cookies are present; their `Origin`
  is still validated when provided. `refresh` and `logout` require CSRF.
- Roles: `candidate`, `employer`, `institute`, `admin`.
- "member" below means an `active` user of that organization/institution;
  "owner/admin" means tenant role `owner` or `admin`. Pending/suspended
  tenants are locked out until a platform admin verifies them.

## Auth — `/api/v1/auth`

| Method | Path        | Access                  | Notes                                                                                                                                                                                      |
| ------ | ----------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/csrf`     | public                  | issues a signed CSRF token, sets the readable `csrf_token` cookie, and returns `data.csrf_token`.                                                                                          |
| POST   | `/register` | public                  | role-discriminated body (`candidate` / `employer` / `institute`); employer/institute also create their tenant (owner, `pending`). Sets cookies; returns `data.tokens` + `data.csrf_token`. |
| POST   | `/login`    | public                  | sets cookies; returns `data.tokens` + `data.csrf_token`.                                                                                                                                   |
| POST   | `/refresh`  | refresh cookie          | requires CSRF; rotates refresh token; sets cookies; returns `data.tokens` + a new `data.csrf_token`. Reuse beyond grace revokes the session family.                                        |
| POST   | `/logout`   | public (refresh cookie) | requires CSRF when auth cookies are present; revokes the presented session (idempotent; no auth middleware); clears cookies.                                                               |
| GET    | `/me`       | authenticated           | current user + role profile.                                                                                                                                                               |

## Candidates — `/api/v1/candidates`

| Method         | Path                           | Access    | Notes                                                                                                               |
| -------------- | ------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------- |
| GET / PATCH    | `/me`                          | candidate | profile (own).                                                                                                      |
| GET / POST     | `/me/educations`               | candidate | list / create.                                                                                                      |
| PATCH / DELETE | `/me/educations/:educationId`  | candidate | same pattern for `/me/experiences/:experienceId`, `/me/projects/:projectId`, `/me/certifications/:certificationId`. |
| GET / POST     | `/me/skills`                   | candidate | declared skills.                                                                                                    |
| PATCH / DELETE | `/me/skills/:candidateSkillId` | candidate | `declared_level` only; `verified_*` is engine-owned.                                                                |
| GET            | `/me/consents`                 | candidate | list consent flags.                                                                                                 |
| PUT            | `/me/consents/:consentType`    | candidate | upsert consent.                                                                                                     |
| GET            | `/:candidateProfileId`         | public    | respects `profile_visibility` (`public` / `employers_only` / `private`); employers get more when authenticated.     |

## Skills — `/api/v1/skills`

| Method | Path        | Access        | Notes                                                                          |
| ------ | ----------- | ------------- | ------------------------------------------------------------------------------ |
| GET    | `/`         | authenticated | catalog list (`search`, `category`, `status` — default `active` — pagination). |
| POST   | `/`         | admin         | create skill.                                                                  |
| PATCH  | `/:skillId` | admin         | update / archive.                                                              |

## Organizations — `/api/v1/organizations`

| Method         | Path                               | Access        | Notes                                                   |
| -------------- | ---------------------------------- | ------------- | ------------------------------------------------------- |
| POST           | `/`                                | employer      | create org (owner membership `pending`).                |
| GET            | `/mine`                            | authenticated | orgs the user belongs to.                               |
| GET            | `/:organizationId`                 | member        | details.                                                |
| PATCH          | `/:organizationId`                 | owner/admin   | update.                                                 |
| POST           | `/:organizationId/jobs`            | owner/admin   | create job for the org.                                 |
| GET            | `/:organizationId/jobs`            | member        | list org jobs.                                          |
| GET            | `/:organizationId/members`         | member        | list members.                                           |
| POST           | `/:organizationId/members`         | owner/admin   | add member.                                             |
| PATCH / DELETE | `/:organizationId/members/:userId` | owner/admin   | self-modification blocked; last active owner protected. |

## Jobs — `/api/v1/jobs`

| Method | Path                   | Access        | Notes                                                                                                                                                                                                                     |
| ------ | ---------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/`                    | authenticated | published jobs of active orgs (filters + pagination).                                                                                                                                                                     |
| GET    | `/:jobId`              | public        | published jobs of active orgs are public; otherwise owner/admin/member of the owning org only (other authenticated users get `403`; anonymous requests currently hit a known 500 — see `docs/reference/known-issues.md`). |
| PATCH  | `/:jobId`              | owner/admin   | update.                                                                                                                                                                                                                   |
| POST   | `/:jobId/publish`      | owner/admin   | `draft → published`.                                                                                                                                                                                                      |
| POST   | `/:jobId/close`        | owner/admin   | `published → closed`.                                                                                                                                                                                                     |
| PUT    | `/:jobId/skills`       | owner/admin   | replace required-skills set.                                                                                                                                                                                              |
| PUT    | `/:jobId/assessments`  | owner/admin   | replace attached assessment set.                                                                                                                                                                                          |
| GET    | `/:jobId/applications` | member        | applicant pipeline.                                                                                                                                                                                                       |
| POST   | `/:jobId/invitations`  | member        | invite a candidate (`source: invited`).                                                                                                                                                                                   |
| POST   | `/:jobId/applications` | candidate     | apply (`source: self_applied`); published + within deadline; duplicate → 409.                                                                                                                                             |

## Applications — `/api/v1/applications`

| Method | Path                       | Access                  | Notes                                                                                     |
| ------ | -------------------------- | ----------------------- | ----------------------------------------------------------------------------------------- |
| GET    | `/mine`                    | candidate               | own applications.                                                                         |
| GET    | `/:applicationId`          | applicant or hiring org | detail.                                                                                   |
| POST   | `/:applicationId/withdraw` | candidate               | allowed from `applied` / `shortlisted`.                                                   |
| PATCH  | `/:applicationId/status`   | hiring org              | `applied → shortlisted/rejected`, `shortlisted → selected/rejected`; anything else → 409. |

## Assessments — `/api/v1/assessments`

| Method | Path                            | Access                | Notes                                                                                                            |
| ------ | ------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| GET    | `/`                             | authenticated         | candidates see `active` only; admins see all.                                                                    |
| POST   | `/`                             | admin                 | create.                                                                                                          |
| GET    | `/:assessmentId`                | authenticated         | candidates cannot read drafts.                                                                                   |
| PATCH  | `/:assessmentId`                | admin                 | update / archive.                                                                                                |
| GET    | `/attempts/mine`                | candidate profile     | own attempts.                                                                                                    |
| POST   | `/:assessmentId/attempts`       | candidate profile     | start attempt; one open attempt at a time (partial unique index).                                                |
| GET    | `/attempts/:attemptId`          | owner or admin        | own attempt.                                                                                                     |
| POST   | `/attempts/:attemptId/submit`   | owner                 | stamps `submitted_at` (the API stores no answers — the engine owns question delivery).                           |
| POST   | `/attempts/:attemptId/abandon`  | owner                 | free the open slot.                                                                                              |
| POST   | `/attempts/:attemptId/evaluate` | engine token or admin | body `{ score: 0–100 }`; marks `passed`/`failed` and verifies candidate skills on pass (only verification path). |

## Institutions — `/api/v1/institutions`

| Method         | Path                                               | Access        | Notes                                                                                         |
| -------------- | -------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------- |
| POST           | `/`                                                | institute     | create institution (owner membership `pending`).                                              |
| GET            | `/mine`                                            | authenticated | institutions the user belongs to.                                                             |
| GET            | `/:institutionId`                                  | member        | details.                                                                                      |
| PATCH          | `/:institutionId`                                  | owner/admin   | update.                                                                                       |
| GET            | `/:institutionId/members`                          | member        | staff list.                                                                                   |
| POST           | `/:institutionId/members`                          | owner/admin   | add staff.                                                                                    |
| PATCH / DELETE | `/:institutionId/members/:userId`                  | owner/admin   | self-modification blocked; last active owner protected.                                       |
| GET            | `/:institutionId/memberships`                      | owner/admin   | student roster (filters + pagination).                                                        |
| POST           | `/:institutionId/memberships`                      | owner/admin   | create membership row.                                                                        |
| PATCH          | `/:institutionId/memberships/:membershipId`        | owner/admin   | update.                                                                                       |
| DELETE         | `/:institutionId/memberships/:membershipId`        | owner/admin   | remove.                                                                                       |
| POST           | `/:institutionId/memberships/:membershipId/verify` | owner/admin   | institute-side verification (`source: institute`).                                            |
| POST           | `/:institutionId/imports`                          | owner/admin   | bulk roster import (≤500 rows); per-row resilient; status `completed` / `partial` / `failed`. |
| GET            | `/:institutionId/imports`                          | owner/admin   | import history.                                                                               |
| POST           | `/:institutionId/drives`                           | owner/admin   | create placement drive.                                                                       |
| GET            | `/:institutionId/drives`                           | member        | list drives.                                                                                  |

## Membership claims — `/api/v1/membership-claims`

| Method | Path               | Access                      | Notes                                                                                                                 |
| ------ | ------------------ | --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| GET    | `/mine`            | authenticated               | own claims.                                                                                                           |
| POST   | `/`                | candidate                   | request OTP (emailed via configured mailer) for `institution_id` + `enrollment_id`; replaces any pending claim.       |
| POST   | `/:claimId/verify` | authenticated (claim owner) | verify code; expiry → 410; wrong code locks after `OTP_MAX_ATTEMPTS`. Success links membership (`source: email_otp`). |

## Drives — `/api/v1/drives`

| Method | Path                                           | Access                                       | Notes                                                                                                           |
| ------ | ---------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| GET    | `/mine`                                        | candidate                                    | drives the student applied to / is eligible for.                                                                |
| GET    | `/`                                            | candidate                                    | open, in-window drives of the caller's verified memberships with computed `eligibility: { eligible, reasons }`. |
| GET    | `/:driveId`                                    | admin / institution staff / enrolled members | others get `404`; candidate members receive an `eligibility` block.                                             |
| POST   | `/:driveId/applications`                       | candidate                                    | apply during window; ineligible candidates are accepted but flagged `not_eligible`.                             |
| POST   | `/drive-candidates/:driveCandidateId/withdraw` | candidate                                    | allowed from `applied` / `shortlisted`.                                                                         |
| PATCH  | `/:driveId`                                    | owner/admin                                  | update criteria/details.                                                                                        |
| POST   | `/:driveId/open` / `/:driveId/close`           | owner/admin                                  | status transitions.                                                                                             |
| PUT    | `/:driveId/departments`                        | owner/admin                                  | replace departments set.                                                                                        |
| PUT    | `/:driveId/jobs`                               | owner/admin                                  | replace attached jobs.                                                                                          |
| PUT    | `/:driveId/assessments`                        | owner/admin                                  | replace attached assessments.                                                                                   |
| GET    | `/:driveId/candidates`                         | member                                       | pipeline.                                                                                                       |
| PATCH  | `/drive-candidates/:driveCandidateId/status`   | owner/admin                                  | `applied → shortlisted/rejected`, `shortlisted → selected/rejected`; stamps `shortlisted_at` / `selected_at`.   |

## Admin — `/api/v1/admin` (role `admin`)

| Method | Path                                     | Notes                                                                    |
| ------ | ---------------------------------------- | ------------------------------------------------------------------------ |
| GET    | `/users`                                 | list/filter users.                                                       |
| PATCH  | `/users/:userId/status`                  | activate/suspend; suspending revokes sessions; self-status change → 400. |
| GET    | `/organizations`                         | list organizations.                                                      |
| POST   | `/organizations/:organizationId/verify`  | activate org + pending owner memberships.                                |
| POST   | `/organizations/:organizationId/suspend` | suspend org (locks all tenant surfaces).                                 |
| GET    | `/institutions`                          | list institutions.                                                       |
| POST   | `/institutions/:institutionId/verify`    | activate institution + pending owner memberships.                        |
| POST   | `/institutions/:institutionId/suspend`   | suspend institution.                                                     |

## Rate limits

`apiLimiter` applies to all API routes; `/auth` and the OTP send/verify
endpoints have stricter limits. Limiters are disabled under `NODE_ENV=test`.

## Assessment engine (multiple choice)

Assessments that have questions are run by the built-in engine. (Assessments
without questions keep the older external-engine flow: `submit`, then
`evaluate`.) Answer keys never leave the server until an attempt is submitted.

| Method | Path                                   | Access            | Notes                                                                                                                                                                                              |
| ------ | -------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/assessments`                         | authenticated     | Each item adds `question_count` (questions in a test) and, for candidates, `my_status` (`open_attempt_id`, `last_result`, `best_score`, `retry_at`) and `skills[].mine` (own verification state). |
| POST   | `/assessments/:id/attempts`            | candidate         | Draws `ASSESSMENT_QUESTIONS_PER_TIER` random questions per difficulty, shuffles options, sets `expires_at` (server clock). `409` with `error[0].path = retry_at` during the retake cooldown.       |
| GET    | `/assessments/attempts/:id`            | owner / admin     | `{ attempt, questions }`. Questions carry only `id, position, prompt, options[{id,text}], selected_option_id` until submitted; then also `correct_option_id, is_correct, difficulty, explanation`. |
| PUT    | `/assessments/attempts/:id/answer`     | owner             | `{ question_id, option_id }`: autosave. `409` once submitted or expired.                                                                                                                           |
| POST   | `/assessments/attempts/:id/focus-loss` | owner             | Records that the candidate left the tab/window (integrity signal shown to employers).                                                                                                              |
| POST   | `/assessments/attempts/:id/submit`     | owner             | Grades on the server (difficulty-weighted score), verifies skills on a pass, returns the reviewed `{ attempt, questions }`. Attempts past their deadline are graded automatically.                |

Scoring: beginner/intermediate/advanced questions weigh 1/2/3. Level:
`< 50` beginner, `50-79` intermediate, `>= 80` advanced. An attempt passes when
the score reaches `ASSESSMENT_PASS_MARK` (default 40) and the level reaches
every skill's `target_level`; the skill is verified at the level achieved.

## Talent discovery — `/api/v1/talent`

| Method | Path                      | Access                       | Notes                                                                                                                                                                                                                |
| ------ | ------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/talent`                 | employer (verified org), admin | Query: `skills=skillId:level,...`, `location`, `search`, `min_match`, `page`, `limit`. Ranks candidates by the share of requested skills they have **verified** at or above the level (`match_percent`, `gaps`). |
| GET    | `/talent/:candidateProfileId` | employer (verified org), admin | Profile plus `assessment_evidence` (graded attempts: score, level, correct/total, focus losses). Private profiles return `404`.                                                                                  |

## Admin — additions

| Method | Path           | Access | Notes                                                                                   |
| ------ | -------------- | ------ | --------------------------------------------------------------------------------------- |
| GET    | `/admin/stats` | admin  | Platform overview: users by role, pending/active organizations and institutions, etc.   |

## Demo data

`npm run db:seed-demo` (from `server/`) is idempotent and
creates accounts for every role, the skill catalogue, six MCQ assessments
(126 questions in `seed/questions/`), verified candidates, an employer with
jobs and applicants, an institute with students and a drive, and pending
organizations/institutions for the admin approval queue. The demo accounts (`*@talentgrid.demo`) get fixed passwords, one per role, listed in `docs/DEMO.md`; override them with `DEMO_ADMIN_PASSWORD` and `DEMO_PASSWORD`.

## Institute readiness — additions

| Method | Path                                    | Access      | Notes                                                                                                                                                                                  |
| ------ | --------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/institutions/:id/memberships`         | owner/admin | Each item now includes `skills: { profile_id, verified_count, verified: [{ name, level }] }`. `profile_id` is `null` for students without a linked candidate account.                |
| GET    | `/institutions/:id/skills-summary`      | owner/admin | `{ students, linked, with_verified, job_ready, top_skills: [{ name, verified_students }] }` over active students. Job-ready = at least 2 skills verified through graded assessments. |
