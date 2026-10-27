// Bootstraps a platform admin account (there is no public admin registration).
//
// Usage:
//   node scripts/create-admin.js <email> <password> "<Full Name>"

import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const [email, password, ...nameParts] = process.argv.slice(2);
const fullName = nameParts.join(" ").trim();

if (!email || !password || !fullName) {
  console.error(
    'Usage: node scripts/create-admin.js <email> <password> "<Full Name>"'
  );
  process.exit(1);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("A valid email address is required.");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password must be at least 8 characters long.");
  process.exit(1);
}
if (!process.env.DATABASE_URI) {
  console.error("DATABASE_URI is not set.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URI }),
});

async function main() {
  const normalizedEmail = email.trim().toLowerCase();
  const password_hash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {
      role: "admin",
      password_hash,
      full_name: fullName,
      status: "active",
    },
    create: {
      email: normalizedEmail,
      password_hash,
      full_name: fullName,
      role: "admin",
      status: "active",
    },
  });
  console.log(`Admin ready: ${user.email} (id ${user.id})`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
