import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { ApiError, authApi } from "../lib/api.js";
import { DEMO_ACCOUNTS } from "../lib/demo-accounts.js";

vi.mock("../lib/api.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, authApi: { me: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn() } };
});

vi.mock("./dashboard.jsx", async () => {
  const { useAuth } = await import("../context/auth-context.js");
  return {
    default: function DashboardStub() {
      const { user } = useAuth();
      return <h1>Dashboard for {user.role}</h1>;
    },
  };
});

const user = (role) => ({ id: "1", role, email: `${role}@x.com`, full_name: "Demo" });

function renderAt(path) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  authApi.me.mockRejectedValue(new ApiError(401, "Unauthorized"));
  authApi.logout.mockResolvedValue(null);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

const emailButton = async (email) => (await screen.findByText(email)).closest("button");

describe("demo accounts are behind the VITE_DEMO_LOGIN flag", () => {
  it("are hidden by default", async () => {
    renderAt("/login");
    expect(await screen.findByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Demo accounts" })).not.toBeInTheDocument();
    expect(screen.queryByText("candidate@talentgrid.demo")).not.toBeInTheDocument();
  });

  it("stay hidden for any value other than exactly 'true'", async () => {
    for (const value of ["false", "1", "TRUE", ""]) {
      vi.stubEnv("VITE_DEMO_LOGIN", value);
      renderAt("/login");
      expect(await screen.findByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "Demo accounts" })).not.toBeInTheDocument();
      cleanup();
    }
  });

  it("do not appear on the admin sign-in page either", async () => {
    renderAt("/admin/login");
    expect(await screen.findByLabelText(/admin email/i)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Demo accounts" })).not.toBeInTheDocument();
  });
});

describe("with the flag on: login page", () => {
  beforeEach(() => vi.stubEnv("VITE_DEMO_LOGIN", "true"));

  it("lists the candidate, employer and institute demo accounts but not the admin", async () => {
    renderAt("/login");
    const panel = await screen.findByRole("region", { name: "Demo accounts" });

    for (const email of ["candidate@talentgrid.demo", "arjun@talentgrid.demo", "employer@talentgrid.demo", "institute@talentgrid.demo"]) {
      expect(within(panel).getByText(email)).toBeInTheDocument();
    }
    expect(within(panel).queryByText("admin@talentgrid.demo")).not.toBeInTheDocument();
    expect(within(panel).getByText(/accounts awaiting approval/i)).toBeInTheDocument();
  });

  it("signs in with one click using that account's credentials", async () => {
    authApi.login.mockResolvedValue({ user: user("employer") });
    const click = userEvent.setup();
    renderAt("/login");

    await click.click(await emailButton("employer@talentgrid.demo"));

    expect(authApi.login).toHaveBeenCalledWith({ email: "employer@talentgrid.demo", password: "Employer@Demo2026" });
    expect(await screen.findByRole("heading", { name: /dashboard for employer/i })).toBeInTheDocument();
  });

  it("explains when the demo accounts have not been seeded on this server", async () => {
    authApi.login.mockRejectedValue(new ApiError(401, "Invalid email or password"));
    const click = userEvent.setup();
    renderAt("/login");

    await click.click(await emailButton("candidate@talentgrid.demo"));

    expect(await screen.findByRole("alert")).toHaveTextContent(/does not exist on this server yet/i);
  });
});

describe("with the flag on: admin sign-in page", () => {
  beforeEach(() => vi.stubEnv("VITE_DEMO_LOGIN", "true"));

  it("offers only the admin account and signs in with one click", async () => {
    authApi.login.mockResolvedValue({ user: user("admin") });
    const click = userEvent.setup();
    renderAt("/admin/login");

    const panel = await screen.findByRole("region", { name: "Demo accounts" });
    expect(within(panel).getAllByRole("button")).toHaveLength(1);
    await click.click(within(panel).getByText("admin@talentgrid.demo").closest("button"));

    expect(authApi.login).toHaveBeenCalledWith({ email: "admin@talentgrid.demo", password: "Admin@Demo2026" });
    expect(await screen.findByRole("heading", { name: /dashboard for admin/i })).toBeInTheDocument();
  });
});

describe("demo account list stays in sync with the seed script", () => {
  it("uses the same emails and passwords that db:seed-demo sets", () => {
    const seed = fs.readFileSync(path.resolve(process.cwd(), "../server/scripts/seed-demo.js"), "utf8");
    const lower = seed.toLowerCase();
    for (const account of DEMO_ACCOUNTS) {
      expect(seed, `${account.email} password`).toContain(account.password);
      expect(lower, account.email).toContain(account.email.split("@")[0].toLowerCase());
    }
  });
});
