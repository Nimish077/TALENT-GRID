import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assessmentsApi } from "../../lib/endpoints.js";
import TakeAssessmentPage from "./take-assessment-page.jsx";

vi.mock("../../lib/endpoints.js", () => ({
  assessmentsApi: { getAttempt: vi.fn(), saveAnswer: vi.fn(), focusLoss: vi.fn(), submit: vi.fn(), list: vi.fn() },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/attempts/t1"]}>
      <Routes>
        <Route path="/assessments/attempts/:attemptId" element={<TakeAssessmentPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const iso = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();

function pendingAttempt({ expiresIn = 10 * 60_000, serverOffset = 0 } = {}) {
  return {
    attempt: {
      id: "t1",
      result_status: "pending",
      expires_at: iso(expiresIn + serverOffset),
      server_time: iso(serverOffset),
      assessment: { id: "as1", title: "React Fundamentals", duration_minutes: 15 },
    },
    questions: [
      { id: "q1", position: 1, prompt: "What is JSX?", selected_option_id: null, options: [{ id: "o1", text: "A syntax extension" }, { id: "o2", text: "A database" }] },
      { id: "q2", position: 2, prompt: "What is a hook?", selected_option_id: "p2", options: [{ id: "p1", text: "A class" }, { id: "p2", text: "A function" }] },
    ],
  };
}

const gradedView = (status, extra = {}) => ({
  attempt: {
    id: "t1",
    result_status: status,
    score: status === "passed" ? 72 : 30,
    level: status === "passed" ? "intermediate" : "beginner",
    correct_count: 1,
    question_count: 2,
    focus_losses: 2,
    assessment: { id: "as1", title: "React Fundamentals" },
    ...extra,
  },
  questions: [
    { id: "q1", prompt: "What is JSX?", difficulty: "beginner", selected_option_id: "o2", correct_option_id: "o1", is_correct: false, explanation: "JSX is syntax sugar.", options: [{ id: "o1", text: "A syntax extension" }, { id: "o2", text: "A database" }] },
    { id: "q2", prompt: "What is a hook?", difficulty: "advanced", selected_option_id: "p2", correct_option_id: "p2", is_correct: true, explanation: "Hooks are functions.", options: [{ id: "p1", text: "A class" }, { id: "p2", text: "A function" }] },
  ],
});

describe("taking a test", () => {
  it("shows one question at a time, autosaves, and navigates", async () => {
    assessmentsApi.getAttempt.mockResolvedValue(pendingAttempt());
    assessmentsApi.saveAnswer.mockResolvedValue({});
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("What is JSX?")).toBeInTheDocument();
    expect(screen.queryByText("What is a hook?")).not.toBeInTheDocument();
    expect(screen.getByText("Answered 1 of 2")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "What is JSX?" })).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveTextContent(/^(09:5\d|10:00)$/);

    await user.click(screen.getByRole("radio", { name: "A syntax extension" }));
    expect(assessmentsApi.saveAnswer).toHaveBeenCalledWith("t1", "q1", "o1");
    expect(screen.getByText("Answered 2 of 2")).toBeInTheDocument();
    expect(await screen.findByText("Saved")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("What is a hook?")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "A function" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Question 1, answered" }));
    expect(screen.getByText("What is JSX?")).toBeInTheDocument();
  });

  it("offers a retry when saving fails", async () => {
    assessmentsApi.getAttempt.mockResolvedValue(pendingAttempt());
    assessmentsApi.saveAnswer.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({});
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("radio", { name: "A database" }));
    expect(await screen.findByText(/could not save/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "retry" }));
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(assessmentsApi.saveAnswer).toHaveBeenCalledTimes(2);
  });

  it("uses the server clock, not the client clock, for the countdown", async () => {
    // Server is 5 minutes ahead of this machine; 50s remain on the server clock.
    assessmentsApi.getAttempt.mockResolvedValue(pendingAttempt({ expiresIn: 50_000, serverOffset: 5 * 60_000 }));
    renderPage();
    expect(await screen.findByRole("timer")).toHaveTextContent(/^00:(4\d|50)$/);
    expect(screen.getByText("1 minute remaining")).toBeInTheDocument();
  });

  it("confirms submission, stating how many questions are unanswered", async () => {
    assessmentsApi.getAttempt.mockResolvedValue(pendingAttempt());
    assessmentsApi.submit.mockResolvedValue(gradedView("passed"));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Submit test" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("You have 1 unanswered question");
    expect(assessmentsApi.submit).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Submit now" }));
    expect(assessmentsApi.submit).toHaveBeenCalledWith("t1");
    expect(await screen.findByText("✓ Skill verified at Intermediate level")).toBeInTheDocument();
    expect(screen.getByText("72%")).toBeInTheDocument();
  });

  it("records leaving the page at most once per 3 seconds", async () => {
    assessmentsApi.getAttempt.mockResolvedValue(pendingAttempt());
    assessmentsApi.focusLoss.mockResolvedValue({});
    renderPage();
    await screen.findByText("What is JSX?");
    act(() => { window.dispatchEvent(new Event("blur")); });
    act(() => { window.dispatchEvent(new Event("blur")); });
    expect(assessmentsApi.focusLoss).toHaveBeenCalledTimes(1);
    expect(assessmentsApi.focusLoss).toHaveBeenCalledWith("t1");
    expect(await screen.findByText(/leaving this page is recorded/i)).toBeInTheDocument();
  });

  it("warns before unload while pending", async () => {
    assessmentsApi.getAttempt.mockResolvedValue(pendingAttempt());
    renderPage();
    await screen.findByText("What is JSX?");
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("auto-submits when the timer reaches zero", async () => {
    assessmentsApi.getAttempt.mockResolvedValue(pendingAttempt({ expiresIn: 1200 }));
    assessmentsApi.submit.mockResolvedValue(gradedView("failed"));
    renderPage();
    await screen.findByText("What is JSX?");
    await waitFor(() => expect(assessmentsApi.submit).toHaveBeenCalledWith("t1"), { timeout: 4000 });
    expect(await screen.findByText(/Not passed this time/)).toBeInTheDocument();
  });

  it("reloads the attempt when auto-submit hits a 409", async () => {
    assessmentsApi.getAttempt.mockResolvedValueOnce(pendingAttempt({ expiresIn: 800 })).mockResolvedValue(gradedView("failed"));
    assessmentsApi.submit.mockRejectedValue(Object.assign(new Error("already graded"), { status: 409 }));
    renderPage();
    expect(await screen.findByText(/Not passed this time/, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(assessmentsApi.getAttempt).toHaveBeenCalledTimes(2);
  });
});

describe("results", () => {
  it("shows the verdict, focus-loss note, and per-question review", async () => {
    assessmentsApi.getAttempt.mockResolvedValue(gradedView("passed"));
    renderPage();
    expect(await screen.findByText("✓ Skill verified at Intermediate level")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 questions correct. Harder questions count for more.")).toBeInTheDocument();
    expect(screen.getByText(/left the test page 2 times/i)).toBeInTheDocument();
    expect(screen.getAllByText("Correct answer")).toHaveLength(2);
    expect(screen.getAllByText("Your answer")).toHaveLength(2);
    expect(screen.getByText("JSX is syntax sugar.", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to assessments" })).toHaveAttribute("href", "/assessments");
    expect(screen.getByRole("link", { name: "View my skills" })).toHaveAttribute("href", "/skills");
  });

  it("shows a retake countdown after failing", async () => {
    assessmentsApi.getAttempt.mockResolvedValue(gradedView("failed"));
    assessmentsApi.list.mockResolvedValue({ items: [{ id: "as1", my_status: { retry_at: iso(10 * 60_000) } }] });
    renderPage();
    expect(await screen.findByText(/retake in (09|10):\d\d/)).toBeInTheDocument();
  });

  it("shows a simple message for abandoned attempts", async () => {
    assessmentsApi.getAttempt.mockResolvedValue({ attempt: { id: "t1", result_status: "abandoned", assessment: { title: "X" } }, questions: [] });
    renderPage();
    expect(await screen.findByText(/attempt was abandoned/i)).toBeInTheDocument();
  });
});

describe("load errors", () => {
  it("handles an attempt that is not yours", async () => {
    assessmentsApi.getAttempt.mockRejectedValue(Object.assign(new Error("Attempt not found"), { status: 404 }));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not find that attempt/i);
  });

  it("shows other errors with retry", async () => {
    assessmentsApi.getAttempt.mockRejectedValueOnce(new Error("Server down")).mockResolvedValue(gradedView("passed"));
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Server down");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(/Skill verified/)).toBeInTheDocument();
  });
});
