# Repository Guidelines

## Project Structure & Module Organization

TalentGrid is currently a minimal scaffold. Keep browser-facing code in `client/` and server-side code in `server/`. Place shared contracts, schemas, or utilities in a clearly named top-level directory only when both sides need them. Add tests next to the code they exercise (for example, `client/components/Button.test.*` or `server/routes/users.test.*`). Keep static assets with the client feature that owns them, unless they are genuinely shared.

## Build, Test, and Development Commands

No build system, package manifest, or test runner is configured yet. When introducing a stack, add the corresponding manifest and document the exact commands in `readme.md` and here. Prefer conventional scripts such as:

```text
npm install       # install dependencies
npm run dev       # start local development services
npm test          # run the test suite
npm run build     # create a production build
```

Run commands from the directory containing the relevant manifest, or provide a root-level script that coordinates `client/` and `server/`.

## Coding Style & Naming Conventions

Use two spaces for indentation unless the selected language's formatter requires otherwise, and commit formatted code. Use descriptive, lowercase kebab-case for directories and filenames (`user-profile/`, `api-client.ts`); use language-appropriate names inside code (for example, `camelCase` for JavaScript/TypeScript values and `PascalCase` for components/classes). Add a formatter and linter with the first substantial implementation, and treat their checks as required before review.

## Testing Guidelines

There are no tests or coverage thresholds yet. Add unit tests for business logic and route/component tests for externally visible behavior. Name tests after the behavior under test, keep fixtures local to the relevant suite, and ensure tests are deterministic. Record the chosen framework and coverage command when the test setup is added.

## Commit & Pull Request Guidelines

Existing history uses short, broad messages such as `All files Uploaded`; improve this going forward with imperative, specific subjects (for example, `Add user profile API`). Keep commits focused. Pull requests should explain the change, identify affected areas (`client/` or `server/`), include validation commands and results, link relevant issues, and attach screenshots or request/response examples for UI or API changes.

## Security & Configuration Tips

Do not commit secrets, credentials, local environment files, or generated binaries. Provide a safe `.env.example` when configuration is introduced, validate inputs at server boundaries, and document required environment variables without exposing their values.
