// Runs from `npm start` (the `prestart` hook), after the database migrations.
//
// When SEED_DEMO=true it seeds the demo accounts and data, so a deployed
// environment (e.g. Render) can be made demo-ready by setting one environment
// variable, with no shell access to the production database.
//
// Safety:
//   * It does nothing unless SEED_DEMO is exactly "true" (opt-in only).
//   * A seeding failure is logged but never blocks the API from starting.
//   * The seed is idempotent and never deletes data; it does reset the
//     @talentgrid.demo accounts to their documented demo passwords.
//   * Turn SEED_DEMO off again once the demo is over (and rotate the passwords:
//     see docs/DEMO.md).

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.SEED_DEMO !== "true") {
  console.log("[seed] SEED_DEMO is not 'true': skipping the demo seed.");
  process.exit(0);
}

console.log("[seed] SEED_DEMO=true: seeding demo accounts and data ...");
const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "seed-demo.js");
const result = spawnSync(process.execPath, [script], { stdio: "inherit", env: process.env });

if (result.status === 0) {
  console.log("[seed] Demo data is ready.");
} else {
  console.error(
    `[seed] The demo seed failed (exit ${result.status ?? result.signal}); starting the API anyway.`
  );
}
process.exit(0);
