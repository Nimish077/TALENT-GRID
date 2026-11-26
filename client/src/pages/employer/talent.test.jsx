import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jobsApi, organizationsApi, skillsApi, talentApi } from "../../lib/endpoints.js";
import CandidateDetailPage from "./candidate-detail-page.jsx";
import TalentPage from "./talent-page.jsx";

vi.mock("../../lib/endpoints.js", () => ({
  talentApi: { search: vi.fn(), detail: vi.fn() },
  skillsApi: { list: vi.fn() },
  jobsApi: { invite: vi.fn() },
  organizationsApi: { mine: vi.fn(), jobs: vi.fn() },
}));

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  skillsApi.list.mockResolvedValue({ items: [{ id: "s1", name: "React", category: "frontend" }, { id: "s2", name: "Node.js", category: "backend" }] });
  organizationsApi.mine.mockResolvedValue({ memberships: [{ status: "active", organization: { id: "o1", name: "Acme", status: "active" } }] });
  organizationsApi.jobs.mockResolvedValue({ jobs: [{ id: "j1", title: "Frontend Engineer", status: "published" }, { id: "j2", title: "Draft Role", status: "draft" }] });
});

const item = {
  candidate_profile_id: "c1",
  full_name: "Asha Rao",
  avatar_url: null,
  headline: "Full-stack dev",
  location: "Pune",
  match_percent: 85,
  matched_skills: [{ skill_id: "s1", name: "React", required_level: "intermediate" }],
  gaps: [{ skill_id: "s2", name: "Node.js", required_level: "beginner", status: "claimed" }],
  verified_skill_count: 1,
  skills: [{ skill_id: "s1", name: "React", declared_level: "advanced", verification_status: "verified", verified_level: "intermediate" }],
};
const page = (items, total = items.length) => ({ items, pagination: { page: 1, limit: 12, total, total_pages: 1 }, requirements: [] });

function renderPage(element, path, route) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path={route} element={element} /></Routes>
    </MemoryRouter>,
  );
}

describe("talent search", () => {
  it("runs an initial search and renders match, chips and pagination text", async () => {
    talentApi.search.mockResolvedValue(page([item], 34));
    renderPage(<TalentPage />, "/employer/talent", "/employer/talent");
    expect(await screen.findByText("Asha Rao")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
    expect(screen.getByText(/claimed, not verified/)).toBeInTheDocument();
    expect(screen.getByText("Showing 1-1 of 34")).toBeInTheDocument();
    expect(screen.getByText(/counts verified skills only/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View profile" })).toHaveAttribute("href", "/employer/talent/c1");
    expect(talentApi.search).toHaveBeenCalledWith({ limit: "12" });
  });

  it("builds requirements and sends them in the query", async () => {
    const user = userEvent.setup();
    talentApi.search.mockResolvedValue(page([item]));
    renderPage(<TalentPage />, "/employer/talent", "/employer/talent");
    await screen.findByText("Asha Rao");
    await waitFor(() => expect(screen.getByRole("option", { name: "React" })).toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText("Skill"), "s1");
    await user.selectOptions(screen.getByLabelText("Minimum level"), "advanced");
    await user.click(screen.getByRole("button", { name: "Add requirement" }));
    expect(screen.getByText(/React · Advanced\+/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Location"), "Pune");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(talentApi.search).toHaveBeenLastCalledWith({ skills: "s1:advanced", location: "Pune", limit: "12" }));
    await user.click(screen.getByRole("button", { name: "Remove React" }));
    expect(screen.queryByText(/React · Advanced\+/)).not.toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    talentApi.search.mockResolvedValue(page([]));
    renderPage(<TalentPage />, "/employer/talent?skills=s1:advanced", "/employer/talent");
    expect(await screen.findByText(/try lowering a level/i)).toBeInTheDocument();
  });

  it("shows the unverified-organization message on 403", async () => {
    talentApi.search.mockRejectedValue(Object.assign(new Error("Your organization is not verified yet"), { status: 403 }));
    renderPage(<TalentPage />, "/employer/talent", "/employer/talent");
    expect(await screen.findByText("Your organization is not verified yet")).toBeInTheDocument();
    expect(screen.getByText("Verification pending")).toBeInTheDocument();
  });

  it("shows an error with retry", async () => {
    const user = userEvent.setup();
    talentApi.search.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(page([item]));
    renderPage(<TalentPage />, "/employer/talent", "/employer/talent");
    expect(await screen.findByText("boom")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Asha Rao")).toBeInTheDocument();
  });

  it("invites to a published job, and reports a 409", async () => {
    const user = userEvent.setup();
    talentApi.search.mockResolvedValue(page([item]));
    jobsApi.invite.mockResolvedValueOnce({}).mockRejectedValueOnce(Object.assign(new Error("conflict"), { status: 409 }));
    renderPage(<TalentPage />, "/employer/talent", "/employer/talent");
    await screen.findByText("Asha Rao");
    await user.click(screen.getByRole("button", { name: "Invite to job" }));
    expect(await screen.findByRole("menuitem", { name: "Frontend Engineer" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Draft Role" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Frontend Engineer" }));
    expect(jobsApi.invite).toHaveBeenCalledWith("j1", "c1");
    expect(await screen.findByText("Invited to Frontend Engineer")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Invite to job" }));
    await user.click(await screen.findByRole("menuitem", { name: "Frontend Engineer" }));
    expect(await screen.findByText(/already applied or invited/i)).toBeInTheDocument();
  });
});

describe("candidate detail", () => {
  const detail = {
    profile: {
      headline: "Full-stack dev", bio: "Builds things", location: "Pune", github_url: "https://github.com/asha",
      user: { full_name: "Asha Rao" },
      educations: [], experiences: [{ id: "e1", job_title: "Engineer", organization_name: "Zepto", is_current: true, start_date: "2022-01-01" }],
      projects: [], certifications: [],
      skills: [
        { declared_level: "advanced", verification_status: "verified", verified_level: "intermediate", skill: { name: "React" } },
        { declared_level: "beginner", verification_status: "claimed", verified_level: null, skill: { name: "Go" } },
      ],
    },
    assessment_evidence: [
      { attempt_id: "a1", assessment_title: "React Basics", skills: ["React"], result_status: "passed", score: 82, level: "intermediate", question_count: 10, correct_count: 8, focus_losses: 3, evaluated_at: "2026-01-05T00:00:00Z" },
    ],
  };
  const open = () => renderPage(<CandidateDetailPage />, "/employer/talent/c1", "/employer/talent/:candidateId");

  it("renders verified vs claimed skills, evidence, and only populated sections", async () => {
    talentApi.detail.mockResolvedValue(detail);
    open();
    expect(await screen.findByText("Asha Rao")).toBeInTheDocument();
    expect(talentApi.detail).toHaveBeenCalledWith("c1");
    expect(screen.getByText("Claimed skills (not verified)")).toBeInTheDocument();
    expect(screen.getByText(/Go · Beginner/)).toBeInTheDocument();
    expect(screen.getByText("React Basics")).toBeInTheDocument();
    expect(screen.getByText("Passed")).toBeInTheDocument();
    expect(screen.getByText(/Left the test window 3 times/)).toBeInTheDocument();
    expect(screen.getByText("Experience")).toBeInTheDocument();
    expect(screen.queryByText("Education")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Talent search/ })).toHaveAttribute("href", "/employer/talent");
    expect(screen.getByRole("button", { name: "Invite to job" })).toBeInTheDocument();
  });

  it("shows the empty evidence state", async () => {
    talentApi.detail.mockResolvedValue({ ...detail, assessment_evidence: [] });
    open();
    expect(await screen.findByText("No assessments taken yet")).toBeInTheDocument();
  });

  it("shows a friendly 404", async () => {
    talentApi.detail.mockRejectedValue(Object.assign(new Error("Not found"), { status: 404 }));
    open();
    expect(await screen.findByText(/not found or profile is private/i)).toBeInTheDocument();
  });
});
