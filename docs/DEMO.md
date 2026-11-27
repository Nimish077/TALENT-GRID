# TalentGrid demo runbook

A 7-minute story: **a skill becomes verified, and an employer hires on it.**

## Before you present (do this 15 minutes earlier)

1. **Put the demo accounts and data on the live site.** Either way is safe to repeat:
   - **Easiest, no database access needed:** in the Render dashboard, add the environment variable `SEED_DEMO` = `true` to the API service and redeploy (or restart) it. The server seeds itself on start-up, right after the database migrations. When the demo is over, remove the variable.
   - **Or by hand:** from `server/`, with the production `DATABASE_URI`, run `npm run db:seed-demo`.

   Either way it creates the demo data and sets the fixed demo passwords below. The first start after turning it on takes a few seconds longer.
2. **Warm up the backend.** Render's free tier sleeps. Open the live site and sign in once, so the first request during the demo is not a 30-60 second wait.
3. **Reset to a clean demo state** (after any rehearsal), from `server/` with the production `DATABASE_URI`:
   ```bash
   npm run db:reset-demo
   ```
   It clears the fresh candidate's attempts and verified skills and puts the two "awaiting approval" accounts back to pending. It touches nothing else.
4. Keep a second browser window signed in as the **employer** and a third as the **admin**.
5. Have the assessments in mind: JavaScript, Python, React, Node.js, SQL, Machine Learning (12 questions, 15 minutes each).

## Demo accounts (fixed credentials)

One password per role, the same on every environment where `npm run db:seed-demo` has been run.

| Role | Email | Password | What it shows |
| --- | --- | --- | --- |
| Admin | `admin@talentgrid.demo` | `Admin@Demo2026` | Approval queue and platform statistics (sign in at `/admin/login`) |
| Candidate (fresh) | `candidate@talentgrid.demo` | `Candidate@Demo2026` | Nothing verified yet: take a test live |
| Candidate (verified) | `arjun@talentgrid.demo` | `Candidate@Demo2026` | A finished profile with verified skills |
| Employer | `employer@talentgrid.demo` | `Employer@Demo2026` | Active organization, jobs, applicants, talent search |
| Institute | `institute@talentgrid.demo` | `Institute@Demo2026` | Students, verified skills, a placement drive |
| Employer awaiting approval | `pending-employer@talentgrid.demo` | `Employer@Demo2026` | Locked out until the admin approves |
| Institute awaiting approval | `pending-institute@talentgrid.demo` | `Institute@Demo2026` | Same, for institutes |

Every other demo candidate (Priya, Vikram, Sneha, Kavya, Rohan, Anjali, Deepika) uses the candidate password.

> **These are public demo credentials.** They are in the repository, so anyone who can read it could sign in to a site seeded with them, including as admin. That is fine for a demo with demo data. Afterwards, either change them or lock the admin down:
> - Seed with your own values: `DEMO_ADMIN_PASSWORD='...' DEMO_PASSWORD='...' npm run db:seed-demo` (the second one replaces the candidate, employer and institute passwords).
> - Or reset just the admin: `npm run admin:create -- admin@talentgrid.demo "NewPassword" "Platform Admin"`.

## One-click demo sign-in (behind a flag)

The login page can show the demo accounts as buttons, so you sign in with one click instead of typing. It is **off by default**; turn it on with the build-time flag `VITE_DEMO_LOGIN=true`:

- **Live site (Vercel):** Settings > Environment Variables > add `VITE_DEMO_LOGIN` = `true` (Production), then redeploy. Remove it and redeploy to hide the panel again.
- **Local:** put `VITE_DEMO_LOGIN=true` in `client/.env.local` and restart `npm run dev`.

With the flag on, `/login` lists the candidate, employer and institute demo accounts (plus the two awaiting approval), and `/admin/login` shows the admin account. If a click says the account "does not exist on this server yet", run the demo seed (step 1 above). The credentials are public, so keep the flag off outside the demo.

## The story

1. **The problem (30s).** Resumes claim skills; nobody can check them. TalentGrid makes the skill the proof.
2. **Candidate: prove a skill (2 min).** Sign in as the fresh candidate → *My Skills* shows JavaScript and React as *claimed*. Open *Skill Assessments* → start **JavaScript**. Point out the rules panel, the countdown, the question navigator, autosave. Submit. Show the result: score, level, per-question review, and that the skill now shows **Verified**.
3. **Why you can trust it (1 min).** See "Trust model" below.
4. **Employer: hire on verified skills (2 min).** Switch to the employer → *Talent Search* → require **JavaScript (Advanced)** and **React (Advanced)**. Candidates are ranked by match %. The candidate who only *claims* React is not counted. Open a profile → *Assessment evidence* (score, level, correct/total, times they left the test window). Invite them to a job.
5. **Admin: keep it trustworthy (1 min).** Sign in as admin → the dashboard shows what needs attention → *Approvals*: approve the pending employer. Sign in as that employer: now unlocked.
6. **Institute (30s).** Students, verification status and a placement drive.

## Trust model (talking points)

- **Answer keys never reach the browser** until a test is submitted. Open the network tab: nothing to cheat with.
- **The server owns the clock.** The deadline is enforced with server timestamps; an expired test is graded automatically from whatever was saved.
- **Every attempt is different.** Random questions per difficulty tier, shuffled options, from a larger pool.
- **Harder questions count more** (1/2/3 weights). An *Advanced* level needs advanced answers, not just many easy ones.
- **A pass mark.** A score of 0 can never verify a skill.
- **Skills are verified at the level achieved**, and a later failure never removes a level already earned.
- **Retake cooldown** (15 minutes) and **one open attempt at a time**.
- **Integrity signal:** leaving the tab or window is counted and shown to employers.
- **Auditable:** each attempt stores the exact questions shown, the answers given, the score and time.
- **Only admins create assessments**; employers must be approved before they can search talent.

Be honest about the limits if asked: an unsupervised online test cannot stop someone searching for answers. The measures above make cheating costly and visible; proctoring (camera, lockdown browser) is future work.

## If something goes wrong

- *Slow first load or "server is having trouble":* Render is waking up; wait 30-60 s and retry.
- *Candidate cannot retake yet:* the cooldown is 15 minutes; use another skill or another candidate.
- *Backup plan:* run everything locally (`server`: `npm run dev`, `client`: `npm run dev`) with the same seed.

## Known gaps (not built yet)

Candidate profile sections (experience, education, projects), notifications, placement-drive management and bulk student import in the UI, password reset, a question-management screen for admins (questions are seeded from `server/seed/questions`), proctoring.

## Student profiles from a CSV (shadow profiles)

Institute → Students → **Import students from CSV** (template download included). Each valid row creates a profile that no account owns yet ("Awaiting claim"). A student claims theirs by registering with the **same email** the institute listed and confirming their **enrollment id** on the candidate dashboard; the profile then becomes verified. Try it: upload a row with `priya.nair@talentgrid.demo`, register that email as a candidate, claim.

## Skills, tests and applying

- A skill can be verified only if a platform test exists (HTML, CSS, JavaScript, TypeScript, React, Node.js, Python, SQL, Java, Git, Docker, Machine Learning). Other skills show "No test available yet".
- Score decides the tag: under 50 Beginner, 50-79 Intermediate, 80+ Advanced.
- A job's required skills must be on the candidate's profile before they can apply; the jobs page shows which ones are missing.
- The server demo switch: `GET /api/v1/config` returns `demo_login`, driven by `DEMO_LOGIN` (or `SEED_DEMO` when unset). No Vercel rebuild needed.
