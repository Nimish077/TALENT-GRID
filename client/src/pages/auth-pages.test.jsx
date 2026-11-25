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

// The real dashboards are covered in dashboards.test.jsx; here we only need to
// know that an authenticated user reaches /dashboard.
vi.mock("./dashboard.jsx", async () => {
  const { useAuth } = await import("../context/auth-context.js");
  return {
    default: function DashboardStub() {
      const { user } = useAuth();
      return <h1>Welcome, {user.full_name}</h1>;
    },
  };
});

const candidate = { id: "1", email: "a@b.com", full_name: "Arjun Sharma", role: "candidate" };

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  authApi.me.mockRejectedValue(new ApiError(401, "Unauthorized"));
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("route guard", () => {
  it("redirects anonymous users from /dashboard to the login page", async () => {
    renderAt("/dashboard");
    expect(await screen.findByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
  });

  it("restores an existing session on load", async () => {
    authApi.me.mockResolvedValue({ user: candidate });
    renderAt("/dashboard");
    expect(await screen.findByRole("heading", { name: /welcome, arjun sharma/i })).toBeInTheDocument();
  });
});

describe("login", () => {
  it("signs in and lands on the dashboard", async () => {
    authApi.login.mockResolvedValue({ user: candidate });
    const user = userEvent.setup();
    renderAt("/login");

    await user.type(await screen.findByLabelText(/email address/i), "a@b.com");
    await user.type(screen.getByLabelText(/password/i), "secret123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(authApi.login).toHaveBeenCalledWith({ email: "a@b.com", password: "secret123" });
    expect(await screen.findByRole("heading", { name: /welcome, arjun sharma/i })).toBeInTheDocument();
  });

  it("shows the server error on bad credentials", async () => {
    authApi.login.mockRejectedValue(new ApiError(401, "Invalid email or password"));
    const user = userEvent.setup();
    renderAt("/login");

    await user.type(await screen.findByLabelText(/email address/i), "a@b.com");
    await user.type(screen.getByLabelText(/password/i), "wrongpass");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
  });
});

describe("register", () => {
  it("requires a role before continuing", async () => {
    renderAt("/register");
    expect(await screen.findByRole("button", { name: /continue/i })).toBeDisabled();
  });

  it("registers an employer with company details", async () => {
    authApi.register.mockResolvedValue({ user: { ...candidate, role: "employer" } });
    const user = userEvent.setup();
    renderAt("/register");

    await user.click(await screen.findByRole("radio", { name: /^employer/i }));
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await user.type(screen.getByLabelText(/full name/i), "Arjun Sharma");
    await user.type(screen.getByLabelText(/company name/i), "Acme Corp");
    await user.type(screen.getByLabelText(/work email/i), "a@acme.com");
    await user.type(screen.getByLabelText(/^password/i), "secret123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(authApi.register).toHaveBeenCalledWith({
        role: "employer",
        full_name: "Arjun Sharma",
        email: "a@acme.com",
        password: "secret123",
        organization: { name: "Acme Corp" },
      }),
    );
    expect(await screen.findByRole("heading", { name: /welcome, arjun sharma/i })).toBeInTheDocument();
  });

  it("preselects the role from the query string and can go back", async () => {
    const user = userEvent.setup();
    renderAt("/register?role=institute");

    expect(await screen.findByRole("radio", { name: /^institute/i })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    expect(screen.getByLabelText(/institution name/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByRole("heading", { name: /create your account/i })).toBeInTheDocument();
  });

  it("surfaces a duplicate-email conflict from the API", async () => {
    authApi.register.mockRejectedValue(new ApiError(409, "Email already registered"));
    const user = userEvent.setup();
    renderAt("/register?role=candidate");

    await user.click(await screen.findByRole("button", { name: /continue/i }));
    await user.type(screen.getByLabelText(/full name/i), "Arjun Sharma");
    await user.type(screen.getByLabelText(/email/i), "a@b.com");
    await user.type(screen.getByLabelText(/^password/i), "secret123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/already exists/i);
  });
});
