// One-time, guarded reconciliation of the pre-rebuild development database.
//
// The development database contains three empty scaffold tables ("User",
// "Role", "UserRole") and one stale _prisma_migrations row from a migration
// whose files no longer exist in this repository. This script removes ONLY
// those objects after backing up the Role rows to disk. It is a no-op when the
// database has already been reconciled, and it aborts on any unexpected state.
//
// Usage:
//   node scripts/reconcile-legacy-db.js            # dry run (default)
//   node scripts/reconcile-legacy-db.js --apply    # back up, then remove legacy objects

import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const LEGACY_TABLES = ["User", "Role", "UserRole"];
const STALE_MIGRATION = "20261006171639_init_users_roles";
const MAX_BACKUP_ROLE_ROWS = 10;
const APPLY = process.argv.includes("--apply");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.join(__dirname, "..", "backups");

function abort(message) {
  console.error(`\nABORTED: ${message}\nNo changes were made.`);
  process.exit(1);
}

async function tableExists(client, name) {
  const result = await client.query(
    "SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = $1",
    [name]
  );
  return result.rowCount > 0;
}

async function main() {
  const connectionString = process.env.DATABASE_URI;
  if (!connectionString) abort("DATABASE_URI is not set.");

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    const database = (await client.query("SELECT current_database() AS db"))
      .rows[0].db;

    const legacyPresent = {};
    for (const table of LEGACY_TABLES) {
      legacyPresent[table] = await tableExists(client, table);
    }
    const presentLegacy = LEGACY_TABLES.filter((t) => legacyPresent[t]);
    const migrationsTableExists = await tableExists(
      client,
      "_prisma_migrations"
    );

    let staleRows = [];
    if (migrationsTableExists) {
      staleRows = (
        await client.query(
          "SELECT migration_name FROM _prisma_migrations ORDER BY migration_name"
        )
      ).rows;
    }

    console.log(`Database: ${database}`);
    console.log(
      `Legacy tables present: ${presentLegacy.length ? presentLegacy.join(", ") : "(none)"}`
    );
    console.log(
      `_prisma_migrations rows: ${staleRows.map((r) => r.migration_name).join(", ") || "(none)"}`
    );

    // ------- State detection -------------------------------------------------
    const alreadyReconciled =
      presentLegacy.length === 0 &&
      !staleRows.some((r) => r.migration_name === STALE_MIGRATION);

    if (alreadyReconciled) {
      console.log(
        "\nAlready reconciled: legacy objects are absent. Nothing to do."
      );
      return;
    }

    const exactLegacyState =
      presentLegacy.length === LEGACY_TABLES.length &&
      staleRows.length === 1 &&
      staleRows[0].migration_name === STALE_MIGRATION;

    if (!exactLegacyState) {
      abort(
        "database is in an unexpected state (legacy tables and migration rows do not match " +
          "the known pre-rebuild layout). Refusing to touch anything."
      );
    }

    const newTableProbe = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN " +
        "('users','sessions','institutions','jobs') ORDER BY tablename"
    );
    if (newTableProbe.rowCount > 0) {
      abort(
        `new-schema tables already exist (${newTableProbe.rows.map((r) => r.tablename).join(", ")}); ` +
          "this looks like a partially rebuilt database. Refusing to touch anything."
      );
    }

    // ------- Safety checks ---------------------------------------------------
    const counts = {};
    for (const table of LEGACY_TABLES) {
      counts[table] = Number(
        (await client.query(`SELECT count(*)::int AS count FROM "${table}"`))
          .rows[0].count
      );
    }
    console.log(
      `Row counts: User=${counts.User}, Role=${counts.Role}, UserRole=${counts.UserRole}`
    );

    if (counts.User !== 0 || counts.UserRole !== 0) {
      abort(
        "User / UserRole contain rows; this database may hold valuable data."
      );
    }
    if (counts.Role > MAX_BACKUP_ROLE_ROWS) {
      abort(
        `Role contains ${counts.Role} rows (more than expected seed data).`
      );
    }

    if (!APPLY) {
      console.log("\nDRY RUN. --apply would now:");
      console.log(
        `  1. back up ${counts.Role} "Role" row(s) to backups/ (with sha256 manifest)`
      );
      console.log(
        `  2. DROP TABLE "UserRole", "Role", "User" (RESTRICT, no CASCADE)`
      );
      console.log(
        `  3. DELETE the single _prisma_migrations row '${STALE_MIGRATION}'`
      );
      console.log("Re-run with --apply to perform these steps.");
      return;
    }

    // ------- Backup-first ----------------------------------------------------
    const roleRows = (await client.query('SELECT * FROM "Role" ORDER BY id'))
      .rows;
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(BACKUP_DIR, `legacy-role-rows-${stamp}.json`);
    const payload = {
      metadata: {
        database,
        captured_at: new Date().toISOString(),
        table: "Role",
        row_count: roleRows.length,
        source: "scripts/reconcile-legacy-db.js",
      },
      rows: roleRows,
    };
    const serialized = JSON.stringify(payload, null, 2);
    fs.writeFileSync(backupPath, serialized, "utf8");

    const readBack = JSON.parse(fs.readFileSync(backupPath, "utf8"));
    if (readBack.rows.length !== roleRows.length) {
      abort(
        `backup verification failed at ${backupPath}; refusing to drop anything.`
      );
    }
    const sha256 = crypto.createHash("sha256").update(serialized).digest("hex");
    fs.writeFileSync(
      `${backupPath}.sha256`,
      `${sha256}  ${path.basename(backupPath)}\n`,
      "utf8"
    );
    console.log(
      `Backed up ${roleRows.length} "Role" row(s) to ${backupPath} (sha256 ${sha256})`
    );

    // ------- Apply (single transaction, only the identified objects) ---------
    await client.query("BEGIN");
    try {
      await client.query('DROP TABLE "UserRole", "Role", "User"');
      const deleted = await client.query(
        "DELETE FROM _prisma_migrations WHERE migration_name = $1",
        [STALE_MIGRATION]
      );
      if (deleted.rowCount !== 1) {
        throw new Error(
          `expected to delete exactly 1 stale migration row, deleted ${deleted.rowCount}`
        );
      }
      await client.query("COMMIT");
      console.log(
        'Dropped legacy tables "UserRole", "Role", "User" and removed the stale migration row.'
      );
    } catch (error) {
      await client.query("ROLLBACK");
      abort(`cleanup transaction rolled back: ${error.message}`);
    }

    // ------- Post-check ------------------------------------------------------
    for (const table of LEGACY_TABLES) {
      if (await tableExists(client, table))
        abort(`legacy table ${table} still exists after cleanup.`);
    }
    const remaining = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
    );
    console.log(
      `Remaining tables: ${remaining.rows.map((r) => r.tablename).join(", ") || "(none)"}`
    );
    const migrations = await client.query(
      "SELECT migration_name FROM _prisma_migrations"
    );
    console.log(
      `Remaining migrations: ${migrations.rows.map((r) => r.migration_name).join(", ") || "(none)"}`
    );
    console.log(
      "\nReconciliation complete. Run `npm run prisma:deploy` to apply the new migrations."
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
