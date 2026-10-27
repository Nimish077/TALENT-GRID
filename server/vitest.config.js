import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
    env: {
      NODE_ENV: "test",
      MAILER: "test",
      BCRYPT_ROUNDS: "4",
      ASSESSMENT_ENGINE_TOKEN: "test-engine-token",
    },
    fileParallelism: false,
    setupFiles: ["tests/setup.js"],
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
