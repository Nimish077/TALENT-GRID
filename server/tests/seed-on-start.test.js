import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts", "seed-on-start.js");

function run(env) {
  return spawnSync(process.execPath, [script], {
    encoding: "utf8",
    // Start from a clean environment so a developer's own SEED_DEMO is ignored.
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...env },
    timeout: 60000,
  });
}

describe("start-up demo seed (prestart hook)", () => {
  it("does nothing unless SEED_DEMO is exactly 'true'", () => {
    for (const value of [undefined, "", "false", "1", "yes", "TRUE"]) {
      const result = run(value === undefined ? {} : { SEED_DEMO: value });
      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(/skipping the demo seed/i);
    }
  });

  it("never blocks the API from starting when seeding fails", () => {
    const result = run({
      SEED_DEMO: "true",
      DATABASE_URI: "postgresql://nobody:nothing@127.0.0.1:1/none", // unreachable
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toMatch(/seed failed; starting the API anyway|seed failed \(exit/i);
  });

  it("is wired into npm start after the migrations", async () => {
    const { default: pkg } = await import("../package.json", { with: { type: "json" } });
    expect(pkg.scripts.prestart).toBe("prisma migrate deploy && node scripts/seed-on-start.js");
  });
});
