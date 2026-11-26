import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "../context/auth-context.js";
import { applicationsApi, jobsApi, organizationsApi } from "../lib/endpoints.js";
import ApplicationsPage from "./candidate/applications-page.jsx";
import EmployerDashboard from "./dashboards/employer-dashboard.jsx";
import ApplicantsPage from "./employer/applicants-page.jsx";

vi.mock("../lib/endpoints.js", () => ({
  jobsApi: { applications: vi.fn() },
  applicationsApi: { mine: vi.fn(), withdraw: vi.fn(), setStatus: vi.fn() },
  organizationsApi: { mine: vi.fn(), jobs: vi.fn() },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderAt(path, routePath, element, role) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={{ user: { id: "u", role, full_name: "Test", email: "t@t.com" }, loading: false, logout: vi.fn() }}>
        <Routes>
          <Route path={routePath} element={element} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

const candidateProfile = (id, name) => ({ id, headline: `${name} headline`, user: { full_name: name } });

describe("employer: applicants lead to the candidate's evidence", () => {
  it("links each applicant to their profile and marks invited candidates", async () => {
    jobsApi.applications.mockResolvedValue({
      applications: [
        { id: "a1", status: "applied", source: "self_applied", candidate_profile_id: "p1", candidate_profile: candidateProfile("p1", "Priya Mehta") },
        { id: "a2", status: "applied", source: "invited", candidate_profile_id: "p2", candidate_profile: candidateProfile("p2", "Vikram Nair") },
      ],
    });
    renderAt("/employer/jobs/j1/applicants", "/employer/jobs/:jobId/applicants", <ApplicantsPage />, "employer");

    expect(await screen.findByRole("link", { name: "Priya Mehta" })).toHaveAttribute("href", "/employer/talent/p1");
    expect(screen.getByRole("link", { name: "Vikram Nair" })).toHaveAttribute("href", "/employer/talent/p2");
    expect(screen.getAllByRole("link", { name: /view profile & assessment evidence/i })).toHaveLength(2);
    expect(screen.getAllByText("Invited")).toHaveLength(1);
  });
});

describe("employer dashboard rows are clickable", () => {
  it("opens a job's applicants and a recent applicant's profile", async () => {
    organizationsApi.mine.mockResolvedValue({ memberships: [{ status: "active", organization: { id: "o1", name: "Acme", status: "active" } }] });
    organizationsApi.jobs.mockResolvedValue({ jobs: [{ id: "j1", title: "Senior React Developer", status: "published", location: "Bengaluru", employment_type: "full_time", _count: { applications: 1 } }] });
    jobsApi.applications.mockResolvedValue({
      applications: [{ id: "a1", status: "applied", applied_at: "2026-01-02", candidate_profile_id: "p1", candidate_profile: candidateProfile("p1", "Arjun Sharma") }],
    });
    renderAt("/dashboard", "/dashboard", <EmployerDashboard />, "employer");

    expect(await screen.findByRole("link", { name: "Senior React Developer" })).toHaveAttribute("href", "/employer/jobs/j1/applicants");
    expect(screen.getByRole("link", { name: "1 applicants for Senior React Developer" })).toHaveAttribute("href", "/employer/jobs/j1/applicants");
    expect(screen.getByRole("link", { name: "Arjun Sharma" })).toHaveAttribute("href", "/employer/talent/p1");
  });
});

describe("candidate: invitations are labelled", () => {
  it("shows 'Invited by employer' only on applications that came from an invitation", async () => {
    applicationsApi.mine.mockResolvedValue({
      applications: [
        { id: "a1", status: "applied", source: "self_applied", job: { title: "Backend Role", organization: { name: "Zepto" } } },
        { id: "a2", status: "applied", source: "invited", job: { title: "React Role", organization: { name: "Razorpay" } } },
      ],
    });
    renderAt("/applications", "/applications", <ApplicationsPage />, "candidate");

    expect(await screen.findByText("React Role")).toBeInTheDocument();
    expect(screen.getAllByText("Invited by employer")).toHaveLength(1);
  });
});
