// Shared Prisma client built on the pg driver adapter (Prisma 7).
//
// In test mode the client is bound to TEST_DATABASE_URI (validated in
// src/config/env.js: must contain "test" and must differ from DATABASE_URI),
// so the dev database can never be reached by the test suite.

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../config/env.js";

const adapter = new PrismaPg({
  connectionString: env.activeDatabaseUri,
});

export const prisma = new PrismaClient({ adapter });

export async function disconnectPrisma() {
  await prisma.$disconnect();
}
