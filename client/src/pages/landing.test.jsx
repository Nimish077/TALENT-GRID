import { cleanup, render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import Landing from "../components/landing/landing-page.jsx";

afterEach(cleanup);

function renderLanding() {
  return render(
    <BrowserRouter>
      <Landing />
    </BrowserRouter>,
  );
}

describe("Landing", () => {
  it("renders the essential landing-page content", () => {
    renderLanding();

    expect(screen.getByRole("heading", { name: /your skills should speak/i })).toBeInTheDocument();
    expect(screen.getByText("Build your profile")).toBeInTheDocument();
    expect(screen.getByText("Verify your skills")).toBeInTheDocument();
    expect(screen.getByText("Connect with opportunity")).toBeInTheDocument();
    expect(screen.getAllByText("Assessment score")).toHaveLength(6);
    expect(screen.getByText("Candidates")).toBeInTheDocument();
    expect(screen.getByText("Employers")).toBeInTheDocument();
    expect(screen.getByText("Institutes")).toBeInTheDocument();
  });

  it("provides same-page audience targets and non-navigating CTAs", () => {
    const { container } = renderLanding();

    expect(container.querySelector("#candidates")).toBeInTheDocument();
    expect(container.querySelector("#employers")).toBeInTheDocument();
    expect(container.querySelector("#institutes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /find opportunities/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create your account/i })).toBeInTheDocument();
  });
});
