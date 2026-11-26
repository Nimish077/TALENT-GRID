import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { candidateApi, skillsApi } from "../../lib/endpoints.js";
import SkillsPage from "./skills-page.jsx";

vi.mock("../../lib/endpoints.js", () => ({
  candidateApi: { skills: vi.fn(), profile: vi.fn(), addSkill: vi.fn(), updateSkill: vi.fn(), removeSkill: vi.fn(), updateProfile: vi.fn() },
  skillsApi: { list: vi.fn() },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const items = [
  { id: "c1", skill: { id: "s1", name: "React" }, declared_level: "advanced", verification_status: "verified", verified_level: "intermediate" },
  { id: "c2", skill: { id: "s2", name: "Node.js" }, declared_level: "beginner", verification_status: "unverified", verified_level: null },
];

function setup() {
  candidateApi.skills.mockResolvedValue({ items });
  candidateApi.profile.mockResolvedValue({ profile: { headline: "Dev", location: "Pune", bio: "" } });
  skillsApi.list.mockResolvedValue({ items: [{ id: "s1", name: "React" }, { id: "s3", name: "Go" }] });
  return render(<MemoryRouter><SkillsPage /></MemoryRouter>);
}

describe("skills page", () => {
  it("groups skills, summarises verification and links to assessments", async () => {
    setup();
    expect(await screen.findByText("1 of 2 skills verified")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Skills verified" })).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByText(/cannot be edited/i)).toBeInTheDocument();
    expect(screen.getByText("✓ Verified")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Verify this skill" })).toHaveAttribute("href", "/assessments");
    // Verified skills have no editable level.
    expect(screen.queryByLabelText("Declared level for React")).not.toBeInTheDocument();
  });

  it("changes a declared level and removes a skill after confirming", async () => {
    candidateApi.updateSkill.mockResolvedValue({});
    candidateApi.removeSkill.mockResolvedValue({});
    const user = userEvent.setup();
    setup();
    await user.selectOptions(await screen.findByLabelText("Declared level for Node.js"), "advanced");
    expect(candidateApi.updateSkill).toHaveBeenCalledWith("c2", "advanced");

    await user.click(await screen.findByRole("button", { name: "Remove Node.js" }));
    expect(candidateApi.removeSkill).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole("group", { name: /confirm removing node/i })).getByRole("button", { name: "Yes, remove" }));
    expect(candidateApi.removeSkill).toHaveBeenCalledWith("c2");
  });

  it("adds a skill from the picker, excluding ones already added", async () => {
    candidateApi.addSkill.mockResolvedValue({});
    const user = userEvent.setup();
    setup();
    const picker = await screen.findByLabelText("Skill");
    await waitFor(() => expect(within(picker).getByRole("option", { name: "Go" })).toBeInTheDocument());
    expect(within(picker).queryByRole("option", { name: "React" })).not.toBeInTheDocument();
    await user.selectOptions(picker, "s3");
    await user.selectOptions(screen.getByLabelText("Your level"), "intermediate");
    await user.click(screen.getByRole("button", { name: "Add skill" }));
    expect(candidateApi.addSkill).toHaveBeenCalledWith({ skill_id: "s3", declared_level: "intermediate" });
  });

  it("saves the profile", async () => {
    candidateApi.updateProfile.mockResolvedValue({});
    const user = userEvent.setup();
    setup();
    const headline = await screen.findByLabelText("Headline");
    await user.clear(headline);
    await user.type(headline, "Senior dev");
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(candidateApi.updateProfile).toHaveBeenCalledWith({ headline: "Senior dev", location: "Pune", bio: "" });
    expect(await screen.findByText("Profile saved.")).toBeInTheDocument();
  });

  it("shows an error state", async () => {
    candidateApi.skills.mockRejectedValue(new Error("boom"));
    candidateApi.profile.mockResolvedValue({ profile: {} });
    render(<MemoryRouter><SkillsPage /></MemoryRouter>);
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });
});
