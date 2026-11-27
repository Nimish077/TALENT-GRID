import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "../../context/auth-context.js";
import { ApiError } from "../../lib/api.js";
import { applicationsApi, assessmentsApi, candidateApi, institutionsApi, jobsApi, organizationsApi } from "../../lib/endpoints.js";
import { formatSalaryLpa, initials, profileCompleteness } from "../../lib/format.js";
import Dashboard from "../dashboard.jsx";
import { pipelineStages, rankJobs } from "../../lib/dashboard-data.js";

vi.mock("../../lib/endpoints.js", () => ({
  candidateApi: { profile: vi.fn(), skills: vi.fn() },
  jobsApi: { list: vi.fn(), apply: vi.fn(), applications: vi.fn() },
  applicationsApi: { mine: vi.fn() },
  assessmentsApi: { list: vi.fn() },
  claimsApi: { matches: vi.fn().mockResolvedValue({ matches: [] }), claim: vi.fn() },
  organizationsApi: { mine: vi.fn(), jobs: vi.fn() },
  institutionsApi: { mine: vi.fn(), memberships: vi.fn(), drives: vi.fn(), skillsSummary: vi.fn() },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderDashboard(user) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{ user, loading: false, logout: vi.fn() }}>
        <Dashboard />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe("format helpers", () => {
  it("formats salaries in LPA", () => {
    expect(formatSalaryLpa("2500000.00", "4000000.00")).toBe("₹25–40 LPA");
    expect(formatSalaryLpa("1850000", null)).toBe("₹18.5+ LPA");
    expect(formatSalaryLpa(null, null)).toBeNull();
  });

  it("computes initials and profile completeness", () => {
    expect(initials("Arjun Kumar Sharma")).toBe("AS");
    expect(profileCompleteness({}, {})).toEqual({ percent: 0, missing: "a headline" });
    const full = profileCompleteness(
      { headline: "h", bio: "b", location: "l", resume_url: "r" },
      { educations: 1, experiences: 1, projects: 1, skills: 1 },
    );
    expect(full).toEqual({ percent: 100, missing: null });
  });
});

describe("candidate dashboard", () => {
  const react = { id: "s1", name: "React" };
  const docker = { id: "s2", name: "Docker" };
  const skills = [
    { id: "cs1", skill_id: "s1", skill: react, declared_level: "advanced", verification_status: "verified", verified_level: "advanced" },
    { id: "cs2", skill_id: "s2", skill: docker, declared_level: "beginner", verification_status: "unverified", verified_level: null },
  ];
  const jobs = [
    { id: "j1", title: "Backend Role", location: "Mumbai", organization: { name: "Zepto" }, salary_min: "1800000", salary_max: "2800000", skills: [] },
    { id: "j2", title: "Senior React Developer", location: "Bengaluru", work_mode: "hybrid", organization: { name: "Razorpay" }, salary_min: "2500000", salary_max: "4000000", experience_level: "senior",
      skills: [{ id: "r1", skill_id: "s1", skill: react, required_level: "advanced" }, { id: "r2", skill_id: "s2", skill: docker, required_level: "intermediate" }] },
  ];

  function mockCandidate() {
    candidateApi.profile.mockResolvedValue({ profile: { headline: "Dev" }, counts: { skills: 2 } });
    candidateApi.skills.mockResolvedValue({ items: skills });
    jobsApi.list.mockResolvedValue({ items: jobs });
    applicationsApi.mine.mockResolvedValue({ applications: [{ id: "a1", job_id: "j9", status: "shortlisted", job: { title: "Full Stack Engineer", organization: { name: "Swiggy" } } }] });
    assessmentsApi.list.mockResolvedValue({ items: [], pagination: { total: 2 } });
  }

  it("ranks jobs by owned skills and marks verified requirements", () => {
    const [first] = rankJobs(jobs, skills);
    expect(first.job.id).toBe("j2");
    expect(first.requirements.map((r) => r.verified)).toEqual([true, false]);
  });

  it("renders stats, recommended jobs, skills and applications from the API", async () => {
    mockCandidate();
    renderDashboard({ id: "u", role: "candidate", full_name: "Test User" });

    expect(await screen.findByRole("heading", { name: /test/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByText("1 shortlisted")).toBeInTheDocument();
    expect(screen.getByText("1 awaiting assessment")).toBeInTheDocument();
    expect(screen.getByText("₹25–40 LPA")).toBeInTheDocument();
    const skillPanel = screen.getByRole("heading", { name: "Skill Verification" }).closest("section");
    expect(within(skillPanel).getByText("✓ Verified")).toBeInTheDocument();
    expect(within(skillPanel).getByText("Unverified")).toBeInTheDocument();
    expect(screen.getByText("Full Stack Engineer")).toBeInTheDocument();
  });

  it("applies to a job and shows it as applied", async () => {
    mockCandidate();
    jobsApi.apply.mockResolvedValue({});
    const user = userEvent.setup();
    renderDashboard({ id: "u", role: "candidate", full_name: "Test User" });

    const apply = (await screen.findAllByRole("button", { name: "Apply" }))[0];
    await user.click(apply);

    await waitFor(() => expect(jobsApi.apply).toHaveBeenCalledWith("j2"));
    expect((await screen.findAllByRole("button", { name: "Applied" }))[0]).toBeDisabled();
  });

  it("shows an error with retry when loading fails", async () => {
    candidateApi.profile.mockRejectedValue(new ApiError(500, "Server exploded"));
    candidateApi.skills.mockResolvedValue({ items: [] });
    jobsApi.list.mockResolvedValue({ items: [] });
    applicationsApi.mine.mockResolvedValue({ applications: [] });
    assessmentsApi.list.mockResolvedValue({ items: [], pagination: { total: 0 } });
    renderDashboard({ id: "u", role: "candidate", full_name: "Test User" });

    expect(await screen.findByRole("alert")).toHaveTextContent("Server exploded");
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});

describe("employer dashboard", () => {
  const user = { id: "u", role: "employer", full_name: "Test Employer" };

  it("shows a pending notice while the organization is unverified", async () => {
    organizationsApi.mine.mockResolvedValue({ memberships: [{ status: "pending", organization: { id: "o1", name: "Acme", status: "pending" } }] });
    renderDashboard(user);

    expect(await screen.findByText("Hiring Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Acme · Overview")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/verification pending/i);
    expect(organizationsApi.jobs).not.toHaveBeenCalled();
  });

  it("aggregates jobs and applicants for an active organization", async () => {
    organizationsApi.mine.mockResolvedValue({ memberships: [{ status: "active", organization: { id: "o1", name: "Acme", status: "active" } }] });
    organizationsApi.jobs.mockResolvedValue({ jobs: [
      { id: "j1", title: "Senior React Developer", status: "published", location: "Bengaluru", employment_type: "full_time", _count: { applications: 2 } },
      { id: "j2", title: "Draft Role", status: "draft", _count: { applications: 0 } },
    ] });
    jobsApi.applications.mockResolvedValue({ applications: [
      { id: "a1", status: "applied", applied_at: "2026-01-02", candidate_profile: { headline: "Full Stack Developer", user: { full_name: "Arjun Sharma" } } },
      { id: "a2", status: "shortlisted", applied_at: "2026-01-01", candidate_profile: { headline: null, user: { full_name: "Priya Mehta" } } },
    ] });
    renderDashboard(user);

    expect(await screen.findByText("Arjun Sharma")).toBeInTheDocument();
    expect(screen.getByText("Priya Mehta")).toBeInTheDocument();
    expect(jobsApi.applications).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("Senior React Developer").length).toBeGreaterThan(0);
    expect(screen.queryByText("Draft Role")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /post a job/i })).toHaveAttribute("href", "/employer/jobs/new");
  });

  it("builds pipeline stages from real statuses", () => {
    const stages = pipelineStages([{ status: "applied" }, { status: "shortlisted" }, { status: "selected" }, { status: "rejected" }]);
    expect(stages.map((s) => s.value)).toEqual([4, 2, 1, 1]);
  });
});

describe("institute dashboard", () => {
  const user = { id: "u", role: "institute", full_name: "Test Institute" };

  it("shows a pending notice while the institution is unverified", async () => {
    institutionsApi.mine.mockResolvedValue({ memberships: [{ status: "pending", institution: { id: "i1", name: "BITS", status: "pending" } }] });
    renderDashboard(user);

    expect(await screen.findByText("Institute Dashboard")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/verification pending/i);
    expect(institutionsApi.memberships).not.toHaveBeenCalled();
  });

  it("renders roster counts, drives and recent students", async () => {
    institutionsApi.mine.mockResolvedValue({ memberships: [{ status: "active", institution: { id: "i1", name: "BITS", status: "active" } }] });
    institutionsApi.memberships.mockImplementation((_id, params) => {
      if (params.limit === 5) {
        return Promise.resolve({ items: [{ id: "m1", full_name: "Anjali Singh", enrollment_id: "E1", program: "B.Tech", department: "IT", verification_status: "verified" }], pagination: { total: 10 } });
      }
      const totals = { verified: 6, pending: 1, rejected: 0 };
      return Promise.resolve({ items: [], pagination: { total: params.verification_status ? totals[params.verification_status] : 10 } });
    });
    institutionsApi.drives.mockResolvedValue({ drives: [{ id: "d1", status: "open" }, { id: "d2", status: "closed" }] });
    renderDashboard(user);

    expect(await screen.findByText("Anjali Singh")).toBeInTheDocument();
    expect(screen.getByText("B.Tech · IT")).toBeInTheDocument();
    expect(screen.getByText("6/10")).toBeInTheDocument();
    expect(screen.getByText("3/10")).toBeInTheDocument(); // unverified = 10 - 6 - 1 - 0
  });

  function mockActiveRoster() {
    institutionsApi.mine.mockResolvedValue({ memberships: [{ status: "active", role: "owner", institution: { id: "i1", name: "BITS", status: "active" } }] });
    institutionsApi.memberships.mockResolvedValue({ items: [], pagination: { total: 10 } });
    institutionsApi.drives.mockResolvedValue({ drives: [] });
  }

  it("shows student skill readiness", async () => {
    mockActiveRoster();
    institutionsApi.skillsSummary.mockResolvedValue({
      students: 10, linked: 7, with_verified: 4, job_ready: 2,
      top_skills: [{ name: "React", verified_students: 4 }, { name: "SQL", verified_students: 2 }],
    });
    renderDashboard(user);

    expect(await screen.findByText("Student skill readiness")).toBeInTheDocument();
    expect(screen.getByText("Linked students")).toBeInTheDocument();
    expect(screen.getByText("With a verified skill")).toBeInTheDocument();
    expect(screen.getByText("Job-ready")).toBeInTheDocument();
    expect(institutionsApi.skillsSummary).toHaveBeenCalledWith("i1");
    expect(screen.getByRole("progressbar", { name: "React verified students" })).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByRole("progressbar", { name: "SQL verified students" })).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByText(/at least 2 skills verified through TalentGrid assessments/i)).toBeInTheDocument();
  });

  it("keeps the dashboard working when skills summary fails", async () => {
    mockActiveRoster();
    institutionsApi.skillsSummary.mockRejectedValue(new Error("boom"));
    renderDashboard(user);

    expect(await screen.findByText(/skill readiness is unavailable/i)).toBeInTheDocument();
    expect(screen.getByText("Verification Status")).toBeInTheDocument();
  });

  it("does not request skills summary for pending institutions", async () => {
    institutionsApi.mine.mockResolvedValue({ memberships: [{ status: "pending", institution: { id: "i1", name: "BITS", status: "pending" } }] });
    renderDashboard(user);
    await screen.findByText("Institute Dashboard");
    expect(institutionsApi.skillsSummary).not.toHaveBeenCalled();
    expect(screen.queryByText("Student skill readiness")).not.toBeInTheDocument();
  });
});

describe("account state notices", () => {
  it("tells a suspended organization it is suspended, not pending", async () => {
    organizationsApi.mine.mockResolvedValue({ memberships: [{ status: "active", organization: { id: "o1", name: "Acme", status: "suspended" } }] });
    renderDashboard({ id: "u", role: "employer", full_name: "Test Employer" });

    expect(await screen.findByText(/account suspended/i)).toBeInTheDocument();
  });

  it("explains restricted access for institute staff members", async () => {
    institutionsApi.mine.mockResolvedValue({ memberships: [{ status: "active", role: "member", institution: { id: "i1", name: "BITS", status: "active" } }] });
    renderDashboard({ id: "u", role: "institute", full_name: "Staff" });

    expect(await screen.findByText(/only visible to institute owners and admins/i)).toBeInTheDocument();
    expect(institutionsApi.memberships).not.toHaveBeenCalled();
  });
});
