import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "../../context/auth-context.js";
import { activeNavItem, pageTitle, portalFor } from "../../lib/navigation.js";
import PortalLayout from "./portal-layout.jsx";

afterEach(cleanup);

const people = {
  candidate: { id: "1", role: "candidate", full_name: "Arjun Sharma", email: "arjun@example.com" },
  employer: { id: "2", role: "employer", full_name: "Priya Mehta", email: "priya@acme.com" },
  institute: { id: "3", role: "institute", full_name: "Rohan Verma", email: "rohan@bits.edu" },
};

function renderAt(path, user, logout = vi.fn()) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={{ user, loading: false, logout }}>
        <Routes>
          <Route element={<PortalLayout />}>
            <Route path="*" element={<p>page body</p>} />
          </Route>
          <Route path="/" element={<p>landing</p>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
  return { logout };
}

// The desktop sidebar is the first "Main" navigation landmark.
const sidebar = () => screen.getAllByRole("navigation", { name: "Main" })[0];

describe("navigation helpers", () => {
  it("picks the most specific item for nested paths", () => {
    const { items } = portalFor("employer");
    expect(activeNavItem(items, "/employer/jobs/new").label).toBe("Post a Job");
    expect(activeNavItem(items, "/employer/jobs/abc/applicants").label).toBe("Jobs");
    expect(activeNavItem(items, "/employer/jobs").label).toBe("Jobs");
    expect(activeNavItem(items, "/nowhere")).toBeUndefined();
  });

  it("derives a page title and falls back for unknown roles", () => {
    expect(pageTitle("candidate", "/applications")).toBe("Applications · TalentGrid");
    expect(portalFor("something-else").label).toBe("Admin");
  });
});

describe("portal layout", () => {
  it.each([
    ["candidate", "Candidate Portal", ["Dashboard", "Jobs", "Applications", "Skill Assessments"]],
    ["employer", "Employer Portal", ["Dashboard", "Jobs", "Post a Job"]],
    ["institute", "Institute Portal", ["Dashboard", "Students"]],
  ])("shows the %s navigation", (role, label, items) => {
    renderAt("/dashboard", people[role]);

    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    const links = within(sidebar()).getAllByRole("link").map((link) => link.textContent);
    expect(links).toEqual(items);
    expect(screen.getByText("page body")).toBeInTheDocument();
  });

  it("marks the current page and sets the document title", () => {
    renderAt("/applications", people.candidate);

    expect(within(sidebar()).getByRole("link", { name: "Applications" })).toHaveAttribute("aria-current", "page");
    expect(within(sidebar()).getByRole("link", { name: "Jobs" })).not.toHaveAttribute("aria-current");
    expect(document.title).toBe("Applications · TalentGrid");
  });

  it("shows who is signed in and logs out to the landing page", async () => {
    const user = userEvent.setup();
    const { logout } = renderAt("/dashboard", people.candidate);

    expect(screen.getAllByText("arjun@example.com").length).toBeGreaterThan(0);
    await user.click(screen.getAllByRole("button", { name: "Log out" })[0]);

    expect(logout).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("landing")).toBeInTheDocument();
  });

  it("opens the mobile drawer, closes it on Escape, and when a link is chosen", async () => {
    const user = userEvent.setup();
    renderAt("/dashboard", people.candidate);

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    const dialog = screen.getByRole("dialog", { name: "Navigation menu" });
    expect(dialog).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("link", { name: "Jobs" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.title).toBe("Jobs · TalentGrid");
  });

  it("offers a skip link to the main content", () => {
    renderAt("/dashboard", people.candidate);
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#content");
  });
});
