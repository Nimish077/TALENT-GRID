import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "../../context/auth-context.js";
import { adminApi } from "../../lib/endpoints.js";
import AdminDashboard from "../dashboards/admin-dashboard.jsx";
import ApprovalsPage from "./approvals-page.jsx";
import UsersPage from "./users-page.jsx";

vi.mock("../../lib/endpoints.js", () => ({
  adminApi: {
    stats: vi.fn(),
    organizations: vi.fn(),
    verifyOrganization: vi.fn(),
    suspendOrganization: vi.fn(),
    institutions: vi.fn(),
    verifyInstitution: vi.fn(),
    suspendInstitution: vi.fn(),
    users: vi.fn(),
    setUserStatus: vi.fn(),
  },
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const page = (items, total = items.length, limit = 20) => ({
  items,
  pagination: { page: 1, limit, total, total_pages: Math.ceil(total / limit) || 1 },
});

function renderPage(element) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{ user: { id: "me", role: "admin", full_name: "Admin" }, loading: false, logout: vi.fn() }}>
        {element}
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

const stats = (over = {}) => ({
  users: { total: 120, candidates: 90, employers: 20, institutes: 10 },
  organizations: { pending: 2, active: 7 },
  institutions: { pending: 1, active: 3 },
  verified_skills: 340,
  assessments: { completed: 50, passed: 35 },
  published_jobs: 12,
  applications: 80,
  ...over,
});

describe("admin dashboard", () => {
  it("shows stats and the attention card linking to approvals", async () => {
    adminApi.stats.mockResolvedValue(stats());
    renderPage(<AdminDashboard />);
    expect(await screen.findByRole("heading", { name: "Admin Dashboard" })).toBeInTheDocument();
    expect(await screen.findByText("2 organizations and 1 institution are waiting for approval")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /review approvals/i })).toHaveAttribute("href", "/admin/approvals");
    expect(screen.getByText("Total users")).toBeInTheDocument();
    expect(screen.getByText("90 candidates · 20 employers · 10 institutes")).toBeInTheDocument();
    expect(screen.getByText("70% pass rate")).toBeInTheDocument();
    expect(screen.getByText("Active organizations")).toBeInTheDocument();
  });

  it("shows a calm state when nothing is pending", async () => {
    adminApi.stats.mockResolvedValue(stats({ organizations: { pending: 0, active: 1 }, institutions: { pending: 0, active: 1 } }));
    renderPage(<AdminDashboard />);
    expect(await screen.findByText("All caught up")).toBeInTheDocument();
    expect(screen.queryByText("Needs your attention")).not.toBeInTheDocument();
  });

  it("shows an error with retry", async () => {
    adminApi.stats.mockRejectedValueOnce(new Error("boom")).mockResolvedValue(stats());
    renderPage(<AdminDashboard />);
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("Total users")).toBeInTheDocument();
  });
});

describe("approvals page", () => {
  const org = { id: "o1", name: "Acme Corp", industry: "Software", location: "Pune", status: "pending", created_at: "2026-01-05T00:00:00Z", _count: { users: 2, jobs: 0 } };
  const inst = { id: "i1", name: "City College", code: "CC01", city: "Pune", status: "pending", created_at: "2026-01-06T00:00:00Z", _count: { memberships: 4, drives: 1 } };

  beforeEach(() => {
    adminApi.organizations.mockImplementation(async (p) => (p.limit === 1 ? page([], 2) : page([org])));
    adminApi.institutions.mockImplementation(async (p) => (p.limit === 1 ? page([], 1) : page([inst])));
  });

  it("lists pending employers with counts and badges per tab", async () => {
    renderPage(<ApprovalsPage />);
    expect(await screen.findByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Software · Pune")).toBeInTheDocument();
    expect(screen.getByText(/2 members · 0 jobs/)).toBeInTheDocument();
    expect(await screen.findByTestId("pending-employers")).toHaveTextContent("2");
    expect(screen.getByTestId("pending-institutes")).toHaveTextContent("1");
    expect(adminApi.organizations).toHaveBeenCalledWith(expect.objectContaining({ status: "pending", limit: 20 }));
  });

  it("switches tabs with arrow keys", async () => {
    const user = userEvent.setup();
    renderPage(<ApprovalsPage />);
    await screen.findByText("Acme Corp");
    const employers = screen.getByRole("tab", { name: /employers/i });
    expect(employers).toHaveAttribute("aria-selected", "true");
    employers.focus();
    await user.keyboard("{ArrowRight}");
    const institutes = screen.getByRole("tab", { name: /institutes/i });
    expect(institutes).toHaveAttribute("aria-selected", "true");
    expect(institutes).toHaveFocus();
    expect(await screen.findByText("City College")).toBeInTheDocument();
    expect(screen.getByText("CC01 · Pune")).toBeInTheDocument();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: /employers/i })).toHaveAttribute("aria-selected", "true");
  });

  it("confirms before approving, then refreshes", async () => {
    const user = userEvent.setup();
    adminApi.verifyOrganization.mockResolvedValue({});
    renderPage(<ApprovalsPage />);
    await user.click(await screen.findByRole("button", { name: "Approve Acme Corp" }));
    const dialog = screen.getByRole("dialog");
    expect(adminApi.verifyOrganization).not.toHaveBeenCalled();
    const callsBefore = adminApi.organizations.mock.calls.length;
    await user.click(within(dialog).getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(adminApi.verifyOrganization).toHaveBeenCalledWith("o1"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(adminApi.organizations.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it("shows an error in the dialog when the action fails and allows cancel", async () => {
    const user = userEvent.setup();
    adminApi.verifyOrganization.mockRejectedValue(new Error("Organization is already active"));
    renderPage(<ApprovalsPage />);
    await user.click(await screen.findByRole("button", { name: "Approve Acme Corp" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Approve" }));
    expect(await within(screen.getByRole("dialog")).findByRole("alert")).toHaveTextContent("already active");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("offers Suspend for active rows and filters by status", async () => {
    const user = userEvent.setup();
    adminApi.suspendOrganization.mockResolvedValue({});
    adminApi.organizations.mockImplementation(async (p) =>
      p.limit === 1 ? page([], 0) : page([{ ...org, status: p.status === "active" ? "active" : "pending" }]),
    );
    renderPage(<ApprovalsPage />);
    await screen.findByText("Acme Corp");
    await user.selectOptions(screen.getByLabelText("Status"), "Active");
    await user.click(await screen.findByRole("button", { name: "Suspend Acme Corp" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Suspend" }));
    await waitFor(() => expect(adminApi.suspendOrganization).toHaveBeenCalledWith("o1"));
  });

  it("shows empty and error states", async () => {
    adminApi.organizations.mockImplementation(async () => page([], 0));
    renderPage(<ApprovalsPage />);
    expect(await screen.findByText("No pending employers to review.")).toBeInTheDocument();
    cleanup();
    adminApi.organizations.mockRejectedValue(new Error("offline"));
    renderPage(<ApprovalsPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("offline");
  });

  it("paginates when total exceeds the page size", async () => {
    const user = userEvent.setup();
    adminApi.organizations.mockImplementation(async (p) => (p.limit === 1 ? page([], 45) : page([org], 45)));
    renderPage(<ApprovalsPage />);
    expect(await screen.findByText("Page 1 of 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(adminApi.organizations).toHaveBeenCalledWith(expect.objectContaining({ page: 2 })));
  });
});

describe("users page", () => {
  const users = [
    { id: "me", email: "admin@x.com", full_name: "Admin", role: "admin", status: "active", created_at: "2026-01-01T00:00:00Z" },
    { id: "u2", email: "sam@x.com", full_name: "Sam", role: "candidate", status: "active", created_at: "2026-01-02T00:00:00Z" },
    { id: "u3", email: "kim@x.com", full_name: "Kim", role: "employer", status: "suspended", created_at: "2026-01-03T00:00:00Z" },
  ];

  it("lists users, filters, and disables the action for the signed-in admin", async () => {
    const user = userEvent.setup();
    adminApi.users.mockResolvedValue(page(users));
    renderPage(<UsersPage />);
    expect((await screen.findAllByText("sam@x.com")).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /admin@x.com .*own account/ })[0]).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Reactivate kim@x.com" })[0]).toBeEnabled();

    await user.selectOptions(screen.getByLabelText("Role"), "employer");
    await waitFor(() => expect(adminApi.users).toHaveBeenLastCalledWith(expect.objectContaining({ role: "employer", page: 1 })));
    await user.type(screen.getByLabelText("Search by email"), "sam{Enter}");
    await waitFor(() => expect(adminApi.users).toHaveBeenLastCalledWith(expect.objectContaining({ search: "sam" })));
  });

  it("suspends after confirmation and reloads", async () => {
    const user = userEvent.setup();
    adminApi.users.mockResolvedValue(page(users));
    adminApi.setUserStatus.mockResolvedValue({});
    renderPage(<UsersPage />);
    await screen.findAllByText("sam@x.com");
    await user.click(screen.getAllByRole("button", { name: "Suspend sam@x.com" })[0]);
    expect(adminApi.setUserStatus).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Suspend" }));
    await waitFor(() => expect(adminApi.setUserStatus).toHaveBeenCalledWith("u2", "suspended"));
    await waitFor(() => expect(adminApi.users.mock.calls.length).toBeGreaterThan(1));
  });

  it("reactivates a suspended user and surfaces errors", async () => {
    const user = userEvent.setup();
    adminApi.users.mockResolvedValue(page(users));
    adminApi.setUserStatus.mockRejectedValue(new Error("nope"));
    renderPage(<UsersPage />);
    await screen.findAllByText("kim@x.com");
    await user.click(screen.getAllByRole("button", { name: "Reactivate kim@x.com" })[0]);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Reactivate" }));
    expect(adminApi.setUserStatus).toHaveBeenCalledWith("u3", "active");
    expect(await within(screen.getByRole("dialog")).findByRole("alert")).toHaveTextContent("nope");
  });

  it("shows empty and error states", async () => {
    adminApi.users.mockResolvedValue(page([]));
    renderPage(<UsersPage />);
    expect(await screen.findByText("No users found.")).toBeInTheDocument();
    cleanup();
    adminApi.users.mockRejectedValue(new Error("down"));
    renderPage(<UsersPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("down");
  });
});
