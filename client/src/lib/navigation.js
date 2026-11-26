// Sidebar navigation per role. `to` values are real routes in App.jsx.
export const PORTALS = {
  candidate: {
    label: "Candidate Portal",
    items: [
      { label: "Dashboard", to: "/dashboard", icon: "dashboard" },
      { label: "Jobs", to: "/jobs", icon: "jobs" },
      { label: "Applications", to: "/applications", icon: "applications" },
      { label: "Skill Assessments", to: "/assessments", icon: "assessments" },
    ],
  },
  employer: {
    label: "Employer Portal",
    items: [
      { label: "Dashboard", to: "/dashboard", icon: "dashboard" },
      { label: "Jobs", to: "/employer/jobs", icon: "jobs" },
      { label: "Post a Job", to: "/employer/jobs/new", icon: "post" },
    ],
  },
  institute: {
    label: "Institute Portal",
    items: [
      { label: "Dashboard", to: "/dashboard", icon: "dashboard" },
      { label: "Students", to: "/institute/students", icon: "students" },
    ],
  },
  admin: {
    label: "Admin",
    items: [{ label: "Dashboard", to: "/dashboard", icon: "dashboard" }],
  },
};

export const portalFor = (role) => PORTALS[role] ?? PORTALS.admin;

// The most specific item whose path matches (so /employer/jobs/new highlights
// "Post a Job", while /employer/jobs/:id/applicants still highlights "Jobs").
export function activeNavItem(items, pathname) {
  return items
    .filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0];
}

export function pageTitle(role, pathname) {
  const item = activeNavItem(portalFor(role).items, pathname);
  return item ? `${item.label} · TalentGrid` : "TalentGrid";
}
