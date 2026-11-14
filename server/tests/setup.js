// Test bootstrap. Guard: the suite can only ever touch a *test* database.
// (src/config/env.js enforces the same rules, this is the explicit last line
// of defense before any helper is imported.)

import { afterAll } from "vitest";
import { prisma } from "./helpers/index.js";

const testUri = process.env.TEST_DATABASE_URI;
if (!testUri) {
  throw new Error("TEST_DATABASE_URI is not set — refusing to run tests");
}
if (testUri === process.env.DATABASE_URI) {
  throw new Error(
    "TEST_DATABASE_URI equals DATABASE_URI — refusing to run tests"
  );
}
const dbName = new URL(testUri).pathname;
if (!/test/i.test(dbName)) {
  throw new Error(
    `TEST_DATABASE_URI must reference a test database (got ${dbName})`
  );
}

afterAll(async () => {
  await prisma.$disconnect();
});
