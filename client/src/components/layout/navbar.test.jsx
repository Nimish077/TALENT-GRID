import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { AuthContext } from "../../context/auth-context.js";
import Navbar from "./navbar.jsx";

afterEach(cleanup);

function renderNavbar(user) {
  render(
    <MemoryRouter>
      <AuthContext.Provider value={{ user, loading: false }}>
        <Navbar />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe("landing navbar (matches the Figma design)", () => {
  it.each([
    ["signed out", null],
    ["signed in", { id: "1", role: "candidate", full_name: "Arjun Sharma" }],
  ])("always shows Log In and Get Started when %s", (_label, user) => {
    renderNavbar(user);

    expect(screen.getByRole("link", { name: "Log In" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Get Started" })).toHaveAttribute("href", "/register");
    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
  });

  it("keeps the section links", () => {
    renderNavbar(null);
    for (const label of ["Candidates", "Employers", "Institutes", "How It Works"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });
});
