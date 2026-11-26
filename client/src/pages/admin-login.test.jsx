import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { ApiError, authApi } from "../lib/api.js";

vi.mock("../lib/api.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    authApi: { me: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn() },
  };
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

const admin = { id: "9", email: "admin@x.com", full_name: "Platform Admin", role: "admin" };
const candidate = { id: "1", email: "a@b.com", full_name: "Arjun Sharma", role: "candidate" };

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

async function fill(user, email, password) {
  await user.type(await screen.findByLabelText(/admin email/i), email);
  await user.type(screen.getByLabelText(/^password/i), password);
  await user.click(screen.getByRole("button", { name: /sign in as admin/i }));
}

beforeEach(() => {
  authApi.me.mockRejectedValue(new ApiError(401, "Unauthorized"));
  authApi.logout.mockResolvedValue(null);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("admin sign-in entry", () => {
  it("is linked from the regular login page, below the form", async () => {
    renderAt("/login");
    expect(await screen.findByRole("link", { name: /sign in as admin/i })).toHaveAttribute("href", "/admin/login");
  });

  it("links back to the regular sign in", async () => {
    renderAt("/admin/login");
    expect(await screen.findByRole("link", { name: /regular sign in/i })).toHaveAttribute("href", "/login");
  });
});

describe("admin sign-in", () => {
  it("lets an administrator in and lands on the dashboard", async () => {
    authApi.login.mockResolvedValue({ user: admin });
    const user = userEvent.setup();
    renderAt("/admin/login");

    await fill(user, "admin@x.com", "secret123");

    expect(authApi.login).toHaveBeenCalledWith({ email: "admin@x.com", password: "secret123" });
    expect(await screen.findByRole("heading", { name: /dashboard for admin/i })).toBeInTheDocument();
    expect(authApi.logout).not.toHaveBeenCalled();
  });

  it("turns a non-admin account away and signs it back out", async () => {
    authApi.login.mockResolvedValue({ user: candidate });
    const user = userEvent.setup();
    renderAt("/admin/login");

    await fill(user, "a@b.com", "secret123");

    expect(await screen.findByRole("alert")).toHaveTextContent(/not an administrator/i);
    await waitFor(() => expect(authApi.logout).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("heading", { name: /dashboard for/i })).not.toBeInTheDocument();
  });

  it("shows the server's message for wrong credentials", async () => {
    authApi.login.mockRejectedValue(new ApiError(401, "Invalid email or password"));
    const user = userEvent.setup();
    renderAt("/admin/login");

    await fill(user, "admin@x.com", "wrongpass");
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
  });

  it("sends an already signed-in administrator straight to the dashboard", async () => {
    authApi.me.mockResolvedValue({ user: admin });
    renderAt("/admin/login");
    expect(await screen.findByRole("heading", { name: /dashboard for admin/i })).toBeInTheDocument();
  });

  it("tells a signed-in non-admin that signing in replaces their session", async () => {
    authApi.me.mockResolvedValue({ user: candidate });
    renderAt("/admin/login");
    expect(await screen.findByRole("status")).toHaveTextContent(/signed in as arjun sharma/i);
  });
});
