// Public demo accounts created by `npm run db:seed-demo` (see docs/DEMO.md).
// They are shown on the login pages so a demo can sign in with one click.
//
// The panel is behind a flag and OFF by default. Turn it on by building the
// client with VITE_DEMO_LOGIN=true (Vercel: Settings > Environment Variables,
// then redeploy; local: client/.env.local, then restart `npm run dev`).
// These credentials are public, so leave the flag off for a real deployment.

export const DEMO_ACCOUNTS = [
  { id: "candidate", role: "candidate", label: "Candidate", email: "candidate@talentgrid.demo", password: "Candidate@Demo2026", note: "Nothing verified yet: take a skill test" },
  { id: "candidate-verified", role: "candidate", label: "Candidate (verified)", email: "arjun@talentgrid.demo", password: "Candidate@Demo2026", note: "Verified skills and assessment evidence" },
  { id: "employer", role: "employer", label: "Employer", email: "employer@talentgrid.demo", password: "Employer@Demo2026", note: "Talent search, jobs and applicants" },
  { id: "institute", role: "institute", label: "Institute", email: "institute@talentgrid.demo", password: "Institute@Demo2026", note: "Students, skill readiness and drives" },
  { id: "pending-employer", role: "employer", label: "Employer awaiting approval", email: "pending-employer@talentgrid.demo", password: "Employer@Demo2026", note: "Locked until an admin approves", group: "pending" },
  { id: "pending-institute", role: "institute", label: "Institute awaiting approval", email: "pending-institute@talentgrid.demo", password: "Institute@Demo2026", note: "Locked until an admin approves", group: "pending" },
  { id: "admin", role: "admin", label: "Admin", email: "admin@talentgrid.demo", password: "Admin@Demo2026", note: "Approvals, users and statistics" },
];

// Read at call time so tests can switch it with vi.stubEnv.
export function isDemoLoginEnabled() {
  return import.meta.env?.VITE_DEMO_LOGIN === "true";
}

export const UNSEEDED_HINT =
  "This demo account does not exist on this server yet. Run the demo seed (see docs/DEMO.md) and try again.";
