// Seeds a complete demo dataset: accounts for every role, the skill catalogue,
// one MCQ assessment per skill (from seed/questions/*.json), candidates with
// verified skills and assessment evidence, an employer with jobs and
// applicants, an institute with students and a drive, and pending
// organizations/institutions for the admin approval queue.
//
// Idempotent: safe to run repeatedly. It never deletes existing data.
//
// Usage (from server/):
//   DEMO_PASSWORD='Choose-A-Password' npm run db:seed-demo
// If DEMO_PASSWORD is not set, a random one is generated and printed once.

import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

if (!process.env.DATABASE_URI) {
  console.error("DATABASE_URI is not set.");
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const QUESTION_DIR = path.join(here, "..", "seed", "questions");
const DOMAIN = "talentgrid.demo";

const password =
  process.env.DEMO_PASSWORD ||
  `Td-${crypto.randomBytes(8).toString("base64url")}`;
if (password.length < 8) {
  console.error("DEMO_PASSWORD must be at least 8 characters long.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URI }),
});

const SKILLS = [
  ["JavaScript", "Programming Language"],
  ["Python", "Programming Language"],
  ["React", "Frontend"],
  ["Node.js", "Backend"],
  ["SQL", "Database"],
  ["Machine Learning", "Data"],
  ["TypeScript", "Programming Language"],
  ["Docker", "DevOps"],
];

const QUESTION_FILES = {
  JavaScript: "javascript.json",
  Python: "python.json",
  React: "react.json",
  "Node.js": "nodejs.json",
  SQL: "sql.json",
  "Machine Learning": "machine-learning.json",
};

const LEVEL_SCORE = { beginner: 42, intermediate: 66, advanced: 91 };

// name, headline, location, [skill, declared, verified|null]
const CANDIDATES = [
  ["Arjun Sharma", "Full Stack Developer", "Bengaluru", [["JavaScript", "advanced", "advanced"], ["React", "advanced", "advanced"], ["Node.js", "intermediate", "intermediate"], ["SQL", "intermediate", "intermediate"], ["TypeScript", "intermediate", null]]],
  ["Priya Mehta", "Machine Learning Engineer", "Mumbai", [["Python", "advanced", "advanced"], ["Machine Learning", "intermediate", "intermediate"], ["SQL", "intermediate", "intermediate"]]],
  ["Vikram Nair", "Backend Engineer", "Hyderabad", [["Node.js", "advanced", "advanced"], ["SQL", "advanced", "advanced"], ["Python", "intermediate", "intermediate"], ["Docker", "beginner", null]]],
  ["Sneha Iyer", "Frontend Developer", "Bengaluru", [["React", "intermediate", "intermediate"], ["JavaScript", "intermediate", "intermediate"], ["TypeScript", "beginner", null]]],
  ["Kavya Reddy", "Data Scientist", "Pune", [["Machine Learning", "advanced", "advanced"], ["Python", "advanced", "advanced"]]],
  ["Rohan Verma", "Final-year Computer Science student", "Bengaluru", [["JavaScript", "beginner", "beginner"], ["Python", "beginner", "beginner"]]],
  ["Anjali Singh", "B.Tech IT student", "Delhi", [["Python", "intermediate", "intermediate"], ["SQL", "intermediate", "intermediate"]]],
  ["Deepika Patel", "Aspiring web developer", "Ahmedabad", [["JavaScript", "intermediate", null], ["React", "beginner", null]]],
];

const JOBS = [
  { title: "Senior React Developer", location: "Bengaluru", work_mode: "hybrid", employment_type: "full_time", experience_level: "senior", salary: [2500000, 4000000], description: "Own the candidate-facing web app: component architecture, performance and accessibility.", skills: [["React", "advanced"], ["JavaScript", "advanced"], ["TypeScript", "intermediate"]] },
  { title: "Backend Engineer, Platform", location: "Mumbai", work_mode: "onsite", employment_type: "full_time", experience_level: "mid", salary: [1800000, 2800000], description: "Design and scale the APIs behind our hiring platform.", skills: [["Node.js", "intermediate"], ["SQL", "intermediate"], ["Docker", "beginner"]] },
  { title: "Machine Learning Engineer", location: "Remote", work_mode: "remote", employment_type: "full_time", experience_level: "mid", salary: [2000000, 3500000], description: "Build ranking and matching models that connect verified talent with roles.", skills: [["Python", "advanced"], ["Machine Learning", "intermediate"], ["SQL", "intermediate"]] },
  { title: "Junior Web Developer", location: "Bengaluru", work_mode: "hybrid", employment_type: "full_time", experience_level: "entry", salary: [600000, 1000000], description: "Join the product team and grow into a full stack role.", skills: [["JavaScript", "beginner"], ["React", "beginner"]] },
];

const STUDENTS = [
  ["E2201", "Rohan Verma", "Computer Science", "B.Tech", "2027", 8.4, 0, "rohan@talentgrid.demo"],
  ["E2202", "Anjali Singh", "Information Technology", "B.Tech", "2027", 9.1, 0, "anjali@talentgrid.demo"],
  ["E2203", "Karan Malhotra", "Computer Science", "B.Tech", "2027", 7.6, 1, null],
  ["E2204", "Meera Joshi", "Electronics", "B.Tech", "2027", 8.0, 0, null],
  ["E2205", "Dev Kapoor", "Computer Science", "B.Tech", "2026", 6.9, 2, null],
  ["E2206", "Ishita Rao", "Data Science", "M.Tech", "2026", 9.4, 0, null],
  ["E2207", "Nikhil Bansal", "Information Technology", "B.Tech", "2027", 7.2, 0, null],
  ["E2208", "Tara Menon", "Computer Science", "B.Tech", "2027", 8.7, 0, null],
  ["E2209", "Sneha Iyer", "Computer Science", "B.Tech", "2027", 8.2, 0, "sneha@talentgrid.demo"],
  ["E2210", "Kavya Reddy", "Data Science", "M.Tech", "2026", 9.0, 0, "kavya@talentgrid.demo"],
];

const hash = await bcrypt.hash(password, 10);
const emailFor = (name) => `${name.toLowerCase().split(" ")[0]}@${DOMAIN}`;

async function ensureUser({ email, full_name, role }) {
  return prisma.user.upsert({
    where: { email },
    update: { full_name, status: "active" },
    create: { email, full_name, role, password_hash: hash, email_verified_at: new Date() },
  });
}

async function main() {
  const host = new URL(process.env.DATABASE_URI).host;
  console.log(`Seeding demo data into ${host} ...`);

  // --- skills -----------------------------------------------------------
  const skill = {};
  for (const [name, category] of SKILLS) {
    skill[name] = await prisma.skill.upsert({
      where: { name },
      update: { category },
      create: { name, category },
    });
  }

  // --- assessments + question banks -------------------------------------
  const assessment = {};
  let questionCount = 0;
  for (const [skillName, file] of Object.entries(QUESTION_FILES)) {
    const bank = JSON.parse(fs.readFileSync(path.join(QUESTION_DIR, file), "utf8"));
    const title = `${skillName} Skill Assessment`;
    let row = await prisma.assessment.findFirst({ where: { title } });
    if (!row) {
      row = await prisma.assessment.create({
        data: {
          title,
          description: `A timed multiple-choice test that verifies your ${skillName} level. Questions span beginner to advanced; harder questions count for more.`,
          assessment_type: "skill",
          difficulty: "intermediate",
          duration_minutes: 15,
          status: "active",
          skills: { create: [{ skill_id: skill[skillName].id, target_level: "beginner" }] },
        },
      });
    }
    const hasAttemptQuestions = await prisma.assessmentAttemptQuestion.count({
      where: { question: { assessment_id: row.id } },
    });
    if (hasAttemptQuestions === 0) {
      await prisma.assessmentQuestion.deleteMany({ where: { assessment_id: row.id } });
      for (const q of bank.questions) {
        await prisma.assessmentQuestion.create({
          data: {
            assessment_id: row.id,
            difficulty: q.difficulty,
            prompt: q.prompt,
            explanation: q.explanation,
            options: {
              create: q.options.map((text, index) => ({
                text,
                is_correct: index === q.correct_index,
                position: index,
              })),
            },
          },
        });
      }
    }
    assessment[skillName] = row;
    questionCount += bank.questions.length;
  }

  // --- admin ------------------------------------------------------------
  await ensureUser({ email: `admin@${DOMAIN}`, full_name: "Platform Admin", role: "admin" });

  // --- candidates (with verified skills and assessment evidence) ---------
  const profile = {};
  const candidateUser = {};
  for (const [name, headline, location, skills] of CANDIDATES) {
    const user = await ensureUser({ email: emailFor(name), full_name: name, role: "candidate" });
    candidateUser[name] = user;
    const p = await prisma.candidateProfile.upsert({
      where: { user_id: user.id },
      update: { headline, location, open_to_work: true, profile_visibility: "public" },
      create: {
        user_id: user.id,
        headline,
        location,
        bio: `${headline} based in ${location}. Open to new opportunities.`,
      },
    });
    profile[name] = p;

    for (const [skillName, declared, verified] of skills) {
      await prisma.candidateSkill.upsert({
        where: { candidate_profile_id_skill_id: { candidate_profile_id: p.id, skill_id: skill[skillName].id } },
        update: {},
        create: {
          candidate_profile_id: p.id,
          skill_id: skill[skillName].id,
          declared_level: declared,
          verification_status: verified ? "verified" : "unverified",
          verified_level: verified,
          verified_at: verified ? new Date() : null,
        },
      });
      if (verified && assessment[skillName]) {
        const exists = await prisma.assessmentAttempt.findFirst({
          where: { assessment_id: assessment[skillName].id, candidate_profile_id: p.id },
        });
        if (!exists) {
          const score = LEVEL_SCORE[verified];
          const when = new Date(Date.now() - (2 + Math.floor(Math.random() * 20)) * 86400000);
          await prisma.assessmentAttempt.create({
            data: {
              assessment_id: assessment[skillName].id,
              candidate_profile_id: p.id,
              attempt_number: 1,
              result_status: "passed",
              score,
              level: verified,
              question_count: 12,
              correct_count: Math.round((score / 100) * 12),
              started_at: when,
              submitted_at: when,
              evaluated_at: when,
            },
          });
        }
      }
    }
  }

  // The live-demo candidate: claims skills, has verified nothing yet.
  const demoUser = await ensureUser({ email: `candidate@${DOMAIN}`, full_name: "Demo Candidate", role: "candidate" });
  const demoProfile = await prisma.candidateProfile.upsert({
    where: { user_id: demoUser.id },
    update: {},
    create: { user_id: demoUser.id, headline: "Aspiring full stack developer", location: "Bengaluru", bio: "Ready to prove my skills." },
  });
  for (const [skillName, level] of [["JavaScript", "intermediate"], ["React", "intermediate"], ["SQL", "beginner"]]) {
    await prisma.candidateSkill.upsert({
      where: { candidate_profile_id_skill_id: { candidate_profile_id: demoProfile.id, skill_id: skill[skillName].id } },
      update: {},
      create: { candidate_profile_id: demoProfile.id, skill_id: skill[skillName].id, declared_level: level },
    });
  }

  // --- employer: active organization, jobs, applications -----------------
  const employer = await ensureUser({ email: `employer@${DOMAIN}`, full_name: "Neha Kapoor", role: "employer" });
  let org = await prisma.organization.findFirst({ where: { name: "Zephyr Labs" } });
  if (!org) {
    org = await prisma.organization.create({
      data: { name: "Zephyr Labs", industry: "Software", location: "Bengaluru", website: "https://zephyr.example.com", description: "Product engineering for fast-growing teams.", status: "active" },
    });
  }
  await prisma.organizationUser.upsert({
    where: { organization_id_user_id: { organization_id: org.id, user_id: employer.id } },
    update: { status: "active", role: "owner" },
    create: { organization_id: org.id, user_id: employer.id, role: "owner", status: "active" },
  });

  const jobRow = {};
  for (const j of JOBS) {
    let job = await prisma.job.findFirst({ where: { organization_id: org.id, title: j.title } });
    if (!job) {
      job = await prisma.job.create({
        data: {
          organization_id: org.id,
          created_by_user_id: employer.id,
          title: j.title,
          description: j.description,
          location: j.location,
          work_mode: j.work_mode,
          employment_type: j.employment_type,
          experience_level: j.experience_level,
          salary_min: j.salary[0],
          salary_max: j.salary[1],
          status: "published",
          published_at: new Date(),
          skills: { create: j.skills.map(([name, level]) => ({ skill_id: skill[name].id, required_level: level })) },
        },
      });
    }
    jobRow[j.title] = job;
  }

  const APPLICATIONS = [
    ["Senior React Developer", "Arjun Sharma", "shortlisted"],
    ["Senior React Developer", "Sneha Iyer", "applied"],
    ["Backend Engineer, Platform", "Vikram Nair", "selected"],
    ["Backend Engineer, Platform", "Arjun Sharma", "applied"],
    ["Machine Learning Engineer", "Priya Mehta", "shortlisted"],
    ["Machine Learning Engineer", "Kavya Reddy", "applied"],
    ["Junior Web Developer", "Deepika Patel", "applied"],
    ["Junior Web Developer", "Rohan Verma", "applied"],
  ];
  for (const [title, name, status] of APPLICATIONS) {
    await prisma.jobApplication.upsert({
      where: { job_id_candidate_profile_id: { job_id: jobRow[title].id, candidate_profile_id: profile[name].id } },
      update: {},
      create: { job_id: jobRow[title].id, candidate_profile_id: profile[name].id, source: "self_applied", status },
    });
  }

  // --- institute: active institution, students, a drive -------------------
  const instUser = await ensureUser({ email: `institute@${DOMAIN}`, full_name: "Dr. Ramesh Iyer", role: "institute" });
  let institution = await prisma.institution.findUnique({ where: { code: "LIT-DEMO" } });
  if (!institution) {
    institution = await prisma.institution.create({
      data: { name: "Lakeview Institute of Technology", code: "LIT-DEMO", city: "Bengaluru", state: "Karnataka", country: "India", email: "placements@lakeview.example.com", status: "active" },
    });
  }
  await prisma.institutionUser.upsert({
    where: { institution_id_user_id: { institution_id: institution.id, user_id: instUser.id } },
    update: { status: "active", role: "owner" },
    create: { institution_id: institution.id, user_id: instUser.id, role: "owner", status: "active" },
  });
  for (const [enrollment, name, department, program, batch, cgpa, backlogs, linkEmail] of STUDENTS) {
    const linked = linkEmail ? await prisma.user.findUnique({ where: { email: linkEmail } }) : null;
    const verified = Boolean(linked) || cgpa >= 8;
    await prisma.institutionMembership.upsert({
      where: { institution_id_enrollment_id: { institution_id: institution.id, enrollment_id: enrollment } },
      update: {},
      create: {
        institution_id: institution.id,
        enrollment_id: enrollment,
        full_name: name,
        institutional_email: linkEmail ?? `${enrollment.toLowerCase()}@lakeview.example.com`,
        department,
        program,
        batch,
        graduation_year: Number(batch),
        cgpa,
        backlog_count: backlogs,
        membership_status: "active",
        verification_status: verified ? "verified" : "unverified",
        verification_source: verified ? "institute" : null,
        verified_at: verified ? new Date() : null,
        joined_at: new Date(),
        user_id: linked?.id ?? null,
      },
    });
  }
  let drive = await prisma.placementDrive.findFirst({ where: { institution_id: institution.id, title: "Campus Hiring 2027" } });
  if (!drive) {
    drive = await prisma.placementDrive.create({
      data: {
        institution_id: institution.id,
        created_by_user_id: instUser.id,
        title: "Campus Hiring 2027",
        description: "On-campus recruitment for the 2027 batch.",
        status: "open",
        application_open_at: new Date(Date.now() - 86400000),
        application_deadline: new Date(Date.now() + 30 * 86400000),
        min_cgpa: 7.5,
        max_backlogs: 1,
        eligible_batch: "2027",
      },
    });
  }

  // --- pending items for the admin approval queue ------------------------
  const pendingEmployer = await ensureUser({ email: `pending-employer@${DOMAIN}`, full_name: "Aditya Rao", role: "employer" });
  let pendingOrg = await prisma.organization.findFirst({ where: { name: "Orbit Systems" } });
  if (!pendingOrg) {
    pendingOrg = await prisma.organization.create({ data: { name: "Orbit Systems", industry: "Cloud services", location: "Chennai", status: "pending" } });
  }
  await prisma.organizationUser.upsert({
    where: { organization_id_user_id: { organization_id: pendingOrg.id, user_id: pendingEmployer.id } },
    update: {},
    create: { organization_id: pendingOrg.id, user_id: pendingEmployer.id, role: "owner", status: "pending" },
  });

  const pendingInstUser = await ensureUser({ email: `pending-institute@${DOMAIN}`, full_name: "Prof. Sunita Desai", role: "institute" });
  let pendingInst = await prisma.institution.findUnique({ where: { code: "RIT-DEMO" } });
  if (!pendingInst) {
    pendingInst = await prisma.institution.create({ data: { name: "Riverside Institute of Technology", code: "RIT-DEMO", city: "Pune", state: "Maharashtra", country: "India", status: "pending" } });
  }
  await prisma.institutionUser.upsert({
    where: { institution_id_user_id: { institution_id: pendingInst.id, user_id: pendingInstUser.id } },
    update: {},
    create: { institution_id: pendingInst.id, user_id: pendingInstUser.id, role: "owner", status: "pending" },
  });

  // --- summary -------------------------------------------------------------
  console.log(`\nSkills: ${SKILLS.length}, assessments: ${Object.keys(assessment).length}, questions: ${questionCount}`);
  console.log(`Candidates: ${CANDIDATES.length + 1}, jobs: ${JOBS.length}, students: ${STUDENTS.length}`);
  console.log("\nDemo accounts (same password for all):");
  const rows = [
    ["Admin", `admin@${DOMAIN}`],
    ["Candidate (nothing verified yet)", `candidate@${DOMAIN}`],
    ["Candidate (verified skills)", emailFor("Arjun Sharma")],
    ["Employer (active)", `employer@${DOMAIN}`],
    ["Institute (active)", `institute@${DOMAIN}`],
    ["Employer awaiting approval", `pending-employer@${DOMAIN}`],
    ["Institute awaiting approval", `pending-institute@${DOMAIN}`],
  ];
  for (const [label, email] of rows) console.log(`  ${label.padEnd(34)} ${email}`);
  console.log(`\nPassword: ${password}`);
  if (!process.env.DEMO_PASSWORD) {
    console.log("(generated just now: note it down, it is not stored anywhere)");
  }
  console.log("\nExisting accounts keep their current password; only new accounts get the one above.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
