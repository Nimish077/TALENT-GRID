// Sidebar navigation per role. `to` values are real routes in App.jsx.
export const PORTALS = {
  candidate: {
    label: "Candidate Portal",
    items: [
      { label: "Dashboard", to: "/dashboard", icon: "dashboard" },
      { label: "My Skills", to: "/skills", icon: "skills" },
      { label: "Skill Assessments", to: "/assessments", icon: "assessments" },
      { label: "Jobs", to: "/jobs", icon: "jobs" },
      { label: "Applications", to: "/applications", icon: "applications" },
    ],
  },
  employer: {
    label: "Employer Portal",
    items: [
      { label: "Dashboard", to: "/dashboard", icon: "dashboard" },
      { label: "Talent Search", to: "/employer/talent", icon: "talent" },
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
    label: "Admin Portal",
    items: [
      { label: "Dashboard", to: "/dashboard", icon: "dashboard" },
      { label: "Approvals", to: "/admin/approvals", icon: "shield" },
      { label: "Users", to: "/admin/users", icon: "students" },
    ],
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
