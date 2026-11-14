// Creates an auxiliary local database (test / schema verification) if missing.
//
// Usage:
//   node scripts/create-db.js talentgrid_test
//   node scripts/create-db.js talentgrid_fresh_check
//
// The database name is strictly validated; only simple lowercase identifiers
// are accepted. Creation uses the same credentials as DATABASE_URI, connecting
// through the default `postgres` maintenance database.

import "dotenv/config";
import pg from "pg";

const dbName = process.argv[2];

if (!dbName || !/^[a-z][a-z0-9_]{0,60}$/.test(dbName)) {
  console.error("Usage: node scripts/create-db.js <lowercase_db_name>");
  process.exit(1);
}

const baseUri = process.env.DATABASE_URI;
if (!baseUri) {
  console.error("DATABASE_URI is not set.");
  process.exit(1);
}

function withDatabase(uri, name) {
  const url = new URL(uri);
  url.pathname = `/${name}`;
  return url.toString();
}

async function main() {
  const admin = new pg.Client({
    connectionString: withDatabase(baseUri, "postgres"),
  });
  await admin.connect();
  try {
    const exists = await admin.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );
    if (exists.rowCount > 0) {
      console.log(`Database "${dbName}" already exists.`);
      return;
    }
    await admin.query(`CREATE DATABASE "${dbName}"`);
    console.log(`Database "${dbName}" created.`);
  } finally {
    await admin.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
