# Repository Guidelines

## Project Structure & Module Organization

TalentGrid is a React single-page app (`client/`) backed by an Express + Prisma + PostgreSQL API (`server/`). Keep browser-facing code in `client/` and server-side code in `server/`. Place shared contracts, schemas, or utilities in a clearly named top-level directory only when both sides need them. Add tests next to the code they exercise (for example, `client/components/Button.test.*` or `server/routes/users.test.*`). Keep static assets with the client feature that owns them, unless they are genuinely shared.

## Build, Test, and Development Commands

Both packages use npm. Run commands from `client/` or `server/` (there is no root-level manifest):

```text
npm install       # install dependencies
npm run dev       # start the dev server (client: Vite, server: node --watch)
npm test          # run the test suite (Vitest)
npm run build     # client only: production build
npm run lint      # client only: ESLint (required before review)
```

Server-only database commands: `npm run prisma:deploy` (apply migrations), `npm run db:seed` (skill catalogue), `npm run db:seed-demo` / `npm run db:reset-demo` (demo data), `npm run admin:create` (first admin). Full details are in `readme.md`, `client/README.md` and `server/README.md`.

## Coding Style & Naming Conventions

Use two spaces for indentation unless the selected language's formatter requires otherwise, and commit formatted code. Use descriptive, lowercase kebab-case for directories and filenames (`user-profile/`, `api-client.ts`); use language-appropriate names inside code (for example, `camelCase` for JavaScript/TypeScript values and `PascalCase` for components/classes). Add a formatter and linter with the first substantial implementation, and treat their checks as required before review.

## Testing Guidelines

Tests use Vitest: Testing Library for the client (API modules are mocked) and Supertest against a real PostgreSQL test database for the server. Coverage is not measured yet. Add unit tests for business logic and route/component tests for externally visible behavior, and a regression test with every bug fix. Name tests after the behavior under test, keep fixtures local to the relevant suite, and ensure tests are deterministic.

## Commit & Pull Request Guidelines

Existing history uses short, broad messages such as `All files Uploaded`; improve this going forward with imperative, specific subjects (for example, `Add user profile API`). Keep commits focused.

Pull requests should explain the change, identify affected areas (`client/` or `server/`), include validation commands and results, link relevant issues, and attach screenshots or request/response examples for UI or API changes.

### Branching Rules

Every feature, bug fix, refactor, or significant change **must be developed on a new dedicated branch**.

Do not develop new features directly on `main`.

Use descriptive branch names such as:

```text
feature/candidate-profile
feature/job-search
feature/employer-dashboard
feature/assessment-engine
feature/institute-management

fix/application-status
fix/login-validation

refactor/api-client
```

Follow these rules:

* One branch should represent one logical feature, fix, refactor, or change.
* Create the branch before starting implementation.
* Do not reuse an old feature branch for an unrelated task.
* Do not modify another developer's branch unless explicitly instructed.
* Do not overwrite or discard another developer's uncommitted work.
* Keep feature branches focused and reasonably small.
* Do not commit unrelated changes to a feature branch.
* Do not force-push shared branches without explicit team approval.

Before starting work, inspect the current repository state:

```text
git status
git branch
```

Then create a new branch:

```text
git switch -c feature/<feature-name>
```

or:

```text
git checkout -b feature/<feature-name>
```

Before creating a pull request, review the diff and ensure that only changes related to the branch's purpose are included.

## Security & Configuration Tips

Do not commit secrets, credentials, local environment files, or generated binaries. Provide a safe `.env.example` when configuration is introduced, validate inputs at server boundaries, and document required environment variables without exposing their values.
