import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assessmentsApi } from "../../lib/endpoints.js";
import AssessmentsPage from "./assessments-page.jsx";

vi.mock("../../lib/endpoints.js", () => ({
  assessmentsApi: { list: vi.fn(), attemptsMine: vi.fn(), startAttempt: vi.fn() },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const base = {
  id: "as1",
  title: "React Fundamentals",
  question_count: 12,
  duration_minutes: 15,
  skills: [{ id: "l1", target_level: "intermediate", skill: { name: "React" }, mine: { declared_level: "advanced", verification_status: "unverified", verified_level: null } }],
  my_status: { open_attempt_id: null, last_result: null, best_score: null, attempts: 0, retry_at: null },
};

function setup(assessment = base, attempts = []) {
  assessmentsApi.list.mockResolvedValue({ items: [assessment] });
  assessmentsApi.attemptsMine.mockResolvedValue({ attempts });
  return render(
    <MemoryRouter initialEntries={["/assessments"]}>
      <Routes>
        <Route path="/assessments" element={<AssessmentsPage />} />
        <Route path="/assessments/attempts/:id" element={<p>attempt page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("assessments page", () => {
  it("shows the rules, then starts and navigates to the attempt", async () => {
    assessmentsApi.startAttempt.mockResolvedValue({ attempt: { id: "t9" } });
    const user = userEvent.setup();
    setup();
    expect(await screen.findByText("12 questions · 15 minutes")).toBeInTheDocument();
    expect(screen.getByText("Not verified")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Start" }));
    expect(assessmentsApi.startAttempt).not.toHaveBeenCalled();
    expect(screen.getByText(/cannot be paused/i)).toBeInTheDocument();
    expect(screen.getByText(/recorded and shown to employers/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /begin test/i }));
    expect(assessmentsApi.startAttempt).toHaveBeenCalledWith("as1");
    expect(await screen.findByText("attempt page")).toBeInTheDocument();
  });

  it("navigates to the open attempt when the server reports one", async () => {
    const err = Object.assign(new Error("already open"), { status: 409, details: [{ path: "attempt_id", message: "t5" }] });
    assessmentsApi.startAttempt.mockRejectedValue(err);
    const user = userEvent.setup();
    setup();
    await user.click(await screen.findByRole("button", { name: "Start" }));
    await user.click(screen.getByRole("button", { name: /begin test/i }));
    expect(await screen.findByText("attempt page")).toBeInTheDocument();
  });

  it("shows the cooldown message when a retake is too early", async () => {
    const err = Object.assign(new Error("You can retake this assessment in 5 minutes"), { status: 409, details: [{ path: "retry_at", message: new Date(Date.now() + 300000).toISOString() }] });
    assessmentsApi.startAttempt.mockRejectedValue(err);
    const user = userEvent.setup();
    setup();
    await user.click(await screen.findByRole("button", { name: "Start" }));
    await user.click(screen.getByRole("button", { name: /begin test/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/retake this assessment in 5 minutes/);
  });

  it("offers Resume for an open attempt", async () => {
    setup({ ...base, my_status: { ...base.my_status, open_attempt_id: "t1", attempts: 1 } });
    expect(await screen.findByRole("link", { name: "Resume" })).toHaveAttribute("href", "/assessments/attempts/t1");
  });

  it("disables the action with a live countdown during cooldown", async () => {
    setup({
      ...base,
      skills: [{ ...base.skills[0], mine: { declared_level: "advanced", verification_status: "verified", verified_level: "intermediate" } }],
      my_status: { open_attempt_id: null, attempts: 1, best_score: 45, retry_at: new Date(Date.now() + 12.5 * 60000).toISOString(), last_result: { result_status: "failed", score: 45, submitted_at: new Date().toISOString() } },
    });
    const button = await screen.findByRole("button", { name: /retake available in/i });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(/Retake in 1[23]:\d\d/);
    expect(screen.getByText("✓ Verified at Intermediate")).toBeInTheDocument();
    expect(screen.getByText(/Best score 45%/)).toBeInTheDocument();
  });

  it("links finished attempts to their result", async () => {
    setup(base, [
      { id: "t1", assessment: { title: "React Fundamentals" }, result_status: "passed", score: 82, level: "advanced", submitted_at: "2026-01-02T00:00:00Z" },
      { id: "t2", assessment: { title: "Old" }, result_status: "abandoned" },
    ]);
    expect(await screen.findByRole("link", { name: "View result" })).toHaveAttribute("href", "/assessments/attempts/t1");
    expect(screen.getAllByRole("link", { name: "View result" })).toHaveLength(1);
  });

  it("shows an empty state", async () => {
    assessmentsApi.list.mockResolvedValue({ items: [] });
    assessmentsApi.attemptsMine.mockResolvedValue({ attempts: [] });
    render(<MemoryRouter><AssessmentsPage /></MemoryRouter>);
    expect(await screen.findByText(/no assessments are open/i)).toBeInTheDocument();
  });
});
