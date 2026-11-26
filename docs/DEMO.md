# TalentGrid demo runbook

A 7-minute story: **a skill becomes verified, and an employer hires on it.**

## Before you present (do this 15 minutes earlier)

1. **Seed the live database** (once). From `server/`, with the production `DATABASE_URI`:
   ```bash
   DEMO_PASSWORD='choose-a-password' npm run db:seed-demo
   ```
   It is safe to run again. It prints the demo accounts. Use the same password for all of them.
2. **Warm up the backend.** Render's free tier sleeps. Open the live site and sign in once, so the first request during the demo is not a 30-60 second wait.
3. **Reset the live candidate** if you rehearsed: the candidate `candidate@talentgrid.demo` should have *no verified skills*. (Rehearse with a different account, for example `arjun@talentgrid.demo` for read-only screens.)
4. Keep a second browser window signed in as the **employer** and a third as the **admin**.
5. Have the assessments in mind: JavaScript, Python, React, Node.js, SQL, Machine Learning (12 questions, 15 minutes each).

## Demo accounts

| Role | Email | What it shows |
| --- | --- | --- |
| Candidate (fresh) | `candidate@talentgrid.demo` | Nothing verified yet: take a test live |
| Candidate (verified) | `arjun@talentgrid.demo` | A finished profile with verified skills |
| Employer | `employer@talentgrid.demo` | Active organization, jobs, applicants, talent search |
| Institute | `institute@talentgrid.demo` | Students, verification status, a placement drive |
| Admin | `admin@talentgrid.demo` | Approval queue and platform statistics |
| Employer awaiting approval | `pending-employer@talentgrid.demo` | Locked out until the admin approves |
| Institute awaiting approval | `pending-institute@talentgrid.demo` | Same, for institutes |

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
