// Seeds the skills catalog with a starter set. Idempotent: existing skills are
// updated in place by name.

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const SKILLS = [
  { name: "JavaScript", category: "Programming Language" },
  { name: "TypeScript", category: "Programming Language" },
  { name: "Python", category: "Programming Language" },
  { name: "Java", category: "Programming Language" },
  { name: "C++", category: "Programming Language" },
  { name: "SQL", category: "Database" },
  { name: "PostgreSQL", category: "Database" },
  { name: "MongoDB", category: "Database" },
  { name: "HTML", category: "Web" },
  { name: "CSS", category: "Web" },
  { name: "React", category: "Frontend" },
  { name: "Node.js", category: "Backend" },
  { name: "Express", category: "Backend" },
  { name: "REST APIs", category: "Backend" },
  { name: "Data Structures", category: "Computer Science" },
  { name: "Algorithms", category: "Computer Science" },
  { name: "Git", category: "Tooling" },
  { name: "Docker", category: "DevOps" },
  { name: "Kubernetes", category: "DevOps" },
  { name: "AWS", category: "Cloud" },
  { name: "Linux", category: "Tooling" },
  { name: "Machine Learning", category: "Data" },
  { name: "Problem Solving", category: "Soft Skill" },
  { name: "Communication", category: "Soft Skill" },
];

if (!process.env.DATABASE_URI) {
  console.error("DATABASE_URI is not set.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URI }),
});

async function main() {
  let count = 0;
  for (const skill of SKILLS) {
    await prisma.skill.upsert({
      where: { name: skill.name },
      update: { category: skill.category },
      create: skill,
    });
    count += 1;
  }
  console.log(`Seeded ${count} skills.`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
