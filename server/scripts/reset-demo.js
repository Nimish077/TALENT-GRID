// Puts the demo data back to its starting state so the live demo can be
// rehearsed and presented again. Only touches the demo accounts created by
// scripts/seed-demo.js (emails ending in @talentgrid.demo).
//
//   * the "fresh" demo candidate loses their verified skills and attempts
//   * the two "awaiting approval" accounts go back to pending
//   * nothing else (jobs, other candidates, students) is changed
//
// Usage (from server/):  npm run db:reset-demo

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

if (!process.env.DATABASE_URI) {
  console.error("DATABASE_URI is not set.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URI }),
});

const DOMAIN = "talentgrid.demo";

async function main() {
  console.log(`Resetting demo state in ${new URL(process.env.DATABASE_URI).host} ...`);

  // Fresh candidate: no attempts, nothing verified.
  const candidate = await prisma.user.findUnique({
    where: { email: `candidate@${DOMAIN}` },
    include: { candidate_profile: true },
  });
  if (candidate?.candidate_profile) {
    const profileId = candidate.candidate_profile.id;
    const attempts = await prisma.assessmentAttempt.deleteMany({
      where: { candidate_profile_id: profileId },
    });
    const skills = await prisma.candidateSkill.updateMany({
      where: { candidate_profile_id: profileId },
      data: { verification_status: "unverified", verified_level: null, verified_at: null },
    });
    await prisma.jobApplication.deleteMany({ where: { candidate_profile_id: profileId } });
    console.log(`  candidate@${DOMAIN}: ${attempts.count} attempts removed, ${skills.count} skills set to unverified`);
  } else {
    console.log(`  candidate@${DOMAIN} not found (run db:seed-demo first)`);
  }

  // Awaiting-approval accounts: back to pending.
  const org = await prisma.organization.findFirst({ where: { name: "Orbit Systems" } });
  if (org) {
    await prisma.organization.update({ where: { id: org.id }, data: { status: "pending" } });
    await prisma.organizationUser.updateMany({ where: { organization_id: org.id }, data: { status: "pending" } });
    console.log("  Orbit Systems: pending");
  }
  const institution = await prisma.institution.findUnique({ where: { code: "RIT-DEMO" } });
  if (institution) {
    await prisma.institution.update({ where: { id: institution.id }, data: { status: "pending" } });
    await prisma.institutionUser.updateMany({ where: { institution_id: institution.id }, data: { status: "pending" } });
    console.log("  Riverside Institute of Technology: pending");
  }
  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
