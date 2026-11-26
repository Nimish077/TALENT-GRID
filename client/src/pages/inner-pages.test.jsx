import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "../context/auth-context.js";
import { applicationsApi, institutionsApi, jobsApi, organizationsApi, skillsApi } from "../lib/endpoints.js";
import RoleRoute from "../components/layout/role-route.jsx";
import NotificationsMenu from "../components/layout/notifications-menu.jsx";
import ApplicationsPage from "./candidate/applications-page.jsx";
import JobsPage from "./candidate/jobs-page.jsx";
import ApplicantsPage from "./employer/applicants-page.jsx";
import ManageJobsPage from "./employer/manage-jobs-page.jsx";
import PostJobPage from "./employer/post-job-page.jsx";
import StudentsPage from "./institute/students-page.jsx";

vi.mock("../lib/endpoints.js", () => ({
  candidateApi: {},
  jobsApi: { list: vi.fn(), apply: vi.fn(), applications: vi.fn(), setSkills: vi.fn(), publish: vi.fn(), close: vi.fn() },
  skillsApi: { list: vi.fn() },
  applicationsApi: { mine: vi.fn(), withdraw: vi.fn(), setStatus: vi.fn() },
  assessmentsApi: { list: vi.fn(), attemptsMine: vi.fn(), startAttempt: vi.fn(), abandonAttempt: vi.fn() },
  organizationsApi: { mine: vi.fn(), jobs: vi.fn(), createJob: vi.fn() },
  institutionsApi: { mine: vi.fn(), memberships: vi.fn(), drives: vi.fn() },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderAt(path, element, role = "candidate", routePath = path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={{ user: { id: "u", role, full_name: "Test User" }, loading: false, logout: vi.fn() }}>
        <Routes>
          <Route path={routePath} element={element} />
          <Route path="/dashboard" element={<p>dashboard home</p>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

const activeOrg = { memberships: [{ status: "active", role: "owner", organization: { id: "o1", name: "Acme", status: "active" } }] };
const pendingOrg = { memberships: [{ status: "pending", role: "owner", organization: { id: "o1", name: "Acme", status: "pending" } }] };

describe("role guard", () => {
  it("sends a user with the wrong role back to the dashboard", () => {
    render(
      <MemoryRouter initialEntries={["/jobs"]}>
        <AuthContext.Provider value={{ user: { role: "employer" } }}>
          <Routes>
            <Route element={<RoleRoute roles={["candidate"]} />}><Route path="/jobs" element={<p>jobs</p>} /></Route>
            <Route path="/dashboard" element={<p>dashboard home</p>} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    );
    expect(screen.getByText("dashboard home")).toBeInTheDocument();
  });
});

describe("notifications menu", () => {
  it("opens and closes instead of being a dead button", async () => {
    const user = userEvent.setup();
    renderAt("/x", <NotificationsMenu />);
    await user.click(screen.getByRole("button", { name: /notifications/i }));
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByText(/all caught up/i)).not.toBeInTheDocument();
  });
});

describe("candidate pages", () => {
  const job = { id: "j1", title: "Backend Engineer", location: "Mumbai", organization: { name: "Zepto" }, skills: [{ id: "r1", required_level: "advanced", skill: { name: "Node.js" } }] };

  it("lists jobs, searches, and applies", async () => {
    jobsApi.list.mockResolvedValue({ items: [job] });
    applicationsApi.mine.mockResolvedValue({ applications: [] });
    jobsApi.apply.mockResolvedValue({});
    const user = userEvent.setup();
    renderAt("/jobs", <JobsPage />);

    expect(await screen.findByText("Backend Engineer")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Search jobs"), "node");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(jobsApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ search: "node" })));

    await user.click(await screen.findByRole("button", { name: "Apply" }));
    expect(jobsApi.apply).toHaveBeenCalledWith("j1");
    expect(await screen.findByRole("button", { name: "Applied" })).toBeDisabled();
  });

  it("withdraws an application", async () => {
    applicationsApi.mine.mockResolvedValue({ applications: [{ id: "a1", status: "applied", job: { title: "Backend Engineer", organization: { name: "Zepto" } } }] });
    applicationsApi.withdraw.mockResolvedValue({});
    const user = userEvent.setup();
    renderAt("/applications", <ApplicationsPage />);

    await user.click(await screen.findByRole("button", { name: "Withdraw" }));
    expect(applicationsApi.withdraw).toHaveBeenCalledWith("a1");
  });
});

describe("employer pages", () => {
  it("shows the pending notice instead of the job form for unverified organizations", async () => {
    organizationsApi.mine.mockResolvedValue(pendingOrg);
    renderAt("/employer/jobs/new", <PostJobPage />, "employer");
    expect(await screen.findByText("Verification pending")).toBeInTheDocument();
    expect(screen.queryByLabelText(/job title/i)).not.toBeInTheDocument();
  });

  it("creates a job with skills and publishes it", async () => {
    organizationsApi.mine.mockResolvedValue(activeOrg);
    skillsApi.list.mockResolvedValue({ items: [{ id: "s1", name: "React" }] });
    organizationsApi.createJob.mockResolvedValue({ job: { id: "j9" } });
    jobsApi.setSkills.mockResolvedValue({});
    jobsApi.publish.mockResolvedValue({});
    const user = userEvent.setup();
    renderAt("/employer/jobs/new", <PostJobPage />, "employer");

    await user.type(await screen.findByLabelText(/job title/i), "Senior React Developer");
    await user.type(screen.getByLabelText(/min salary/i), "25");
    await user.type(screen.getByLabelText(/max salary/i), "40");
    await user.selectOptions(screen.getByLabelText("Skill 1"), "s1");
    await user.selectOptions(screen.getByLabelText("Level 1"), "advanced");
    await user.click(screen.getByRole("button", { name: /post job/i }));

    await waitFor(() => expect(jobsApi.publish).toHaveBeenCalledWith("j9"));
    expect(organizationsApi.createJob).toHaveBeenCalledWith("o1", expect.objectContaining({ title: "Senior React Developer", salary_min: 2500000, salary_max: 4000000 }));
    expect(jobsApi.setSkills).toHaveBeenCalledWith("j9", [{ skill_id: "s1", required_level: "advanced", is_required: true }]);
  });

  it("keeps the draft and explains when a later step fails", async () => {
    organizationsApi.mine.mockResolvedValue(activeOrg);
    skillsApi.list.mockResolvedValue({ items: [] });
    organizationsApi.createJob.mockResolvedValue({ job: { id: "j9" } });
    jobsApi.publish.mockRejectedValue(new Error("Organization is not active"));
    const user = userEvent.setup();
    renderAt("/employer/jobs/new", <PostJobPage />, "employer");

    await user.type(await screen.findByLabelText(/job title/i), "Role");
    await user.click(screen.getByRole("button", { name: /post job/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/saved as a draft/i);
  });

  it("publishes a draft and closes a published job", async () => {
    organizationsApi.mine.mockResolvedValue(activeOrg);
    organizationsApi.jobs.mockResolvedValue({ jobs: [
      { id: "d1", title: "Draft Role", status: "draft", _count: { applications: 0 } },
      { id: "p1", title: "Live Role", status: "published", _count: { applications: 3 } },
    ] });
    jobsApi.publish.mockResolvedValue({});
    jobsApi.close.mockResolvedValue({});
    const user = userEvent.setup();
    renderAt("/employer/jobs", <ManageJobsPage />, "employer");

    await user.click(await screen.findByRole("button", { name: "Publish" }));
    expect(jobsApi.publish).toHaveBeenCalledWith("d1");
    await user.click(await screen.findByRole("button", { name: "Close" }));
    expect(jobsApi.close).toHaveBeenCalledWith("p1");
    expect(await screen.findByRole("link", { name: "3 applicants" })).toHaveAttribute("href", "/employer/jobs/p1/applicants");
  });

  it("only offers valid status transitions for applicants", async () => {
    jobsApi.applications.mockResolvedValue({ applications: [
      { id: "a1", status: "applied", candidate_profile: { user: { full_name: "Priya Mehta" } } },
      { id: "a2", status: "shortlisted", candidate_profile: { user: { full_name: "Vikram Nair" } } },
      { id: "a3", status: "rejected", candidate_profile: { user: { full_name: "Done Person" } } },
    ] });
    applicationsApi.setStatus.mockResolvedValue({});
    const user = userEvent.setup();
    renderAt("/employer/jobs/j1/applicants", <ApplicantsPage />, "employer", "/employer/jobs/:jobId/applicants");

    expect(await screen.findByText("Priya Mehta")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Reject" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Shortlist" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Select" })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Shortlist" }));
    expect(applicationsApi.setStatus).toHaveBeenCalledWith("a1", "shortlisted");
  });
});

describe("institute students page", () => {
  const institution = { memberships: [{ status: "active", role: "owner", institution: { id: "i1", name: "BITS", status: "active" } }] };

  it("lists and filters the student roster", async () => {
    institutionsApi.mine.mockResolvedValue(institution);
    institutionsApi.memberships.mockResolvedValue({
      items: [{ id: "m1", full_name: "Anjali Singh", enrollment_id: "E1", program: "B.Tech", verification_status: "verified" }],
      pagination: { total: 1 },
    });
    const user = userEvent.setup();
    renderAt("/institute/students", <StudentsPage />, "institute");

    expect(await screen.findByText("Anjali Singh")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Verification status"), "pending");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() =>
      expect(institutionsApi.memberships).toHaveBeenLastCalledWith("i1", expect.objectContaining({ verification_status: "pending", page: 1 })),
    );
  });

  it("explains pending institutions", async () => {
    institutionsApi.mine.mockResolvedValue({ memberships: [{ status: "pending", role: "owner", institution: { id: "i1", name: "BITS", status: "pending" } }] });
    renderAt("/institute/students", <StudentsPage />, "institute");
    expect(await screen.findByText("Verification pending")).toBeInTheDocument();
    expect(institutionsApi.memberships).not.toHaveBeenCalled();
  });
});
